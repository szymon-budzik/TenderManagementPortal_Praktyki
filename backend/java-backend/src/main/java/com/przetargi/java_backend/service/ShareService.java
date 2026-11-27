package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.*;
import com.przetargi.java_backend.entity.*;
import com.przetargi.java_backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ShareService {

    private final SharedTenderRepository sharedTenderRepository;
    private final AppGroupRepository groupRepository;
    private final AppGroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;
    private final TenderRepository tenderRepository;
    private final UserTenderRepository userTenderRepository;
    private final FetchRunRepository fetchRunRepository;
    private final AutomationNotificationService notificationService;
    private final TenderDateService dateService;

    public ShareService(
            SharedTenderRepository sharedTenderRepository,
            AppGroupRepository groupRepository,
            AppGroupMemberRepository groupMemberRepository,
            UserRepository userRepository,
            TenderRepository tenderRepository,
            UserTenderRepository userTenderRepository,
            FetchRunRepository fetchRunRepository,
            AutomationNotificationService notificationService,
            TenderDateService dateService
    ) {
        this.sharedTenderRepository = sharedTenderRepository;
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.userRepository = userRepository;
        this.tenderRepository = tenderRepository;
        this.userTenderRepository = userTenderRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.notificationService = notificationService;
        this.dateService = dateService;
    }

    @Transactional(readOnly = true)
    public List<SharePeerDto> getEligiblePeers(String username) {
        User currentUser = requireUser(username);
        return computePeersForUser(currentUser);
    }

    @Transactional(readOnly = true)
    public List<SharedTenderDto> getReceivedTenders(String username) {
        User currentUser = requireUser(username);
        List<SharedTender> shares = sharedTenderRepository.findByRecipientUserIdOrderByCreatedAtDesc(currentUser.getId());
        if (shares.isEmpty()) {
            return List.of();
        }

        Set<Long> tenderIds = shares.stream().map(SharedTender::getTenderId).collect(Collectors.toSet());
        Set<Long> senderIds = shares.stream().map(SharedTender::getSenderUserId).collect(Collectors.toSet());

        Map<Long, Tender> tendersById = tenderRepository.findAllById(tenderIds).stream()
                .collect(Collectors.toMap(Tender::getId, Function.identity()));
        Map<Long, UserTender> myUserTendersByTenderId = userTenderRepository
                .findByUserIdAndTenderIdIn(currentUser.getId(), tenderIds)
                .stream()
                .collect(Collectors.toMap(ut -> ut.getTender().getId(), Function.identity()));
        Map<Long, User> sendersById = userRepository.findAllById(senderIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<SharedTenderDto> result = new ArrayList<>();
        for (SharedTender st : shares) {
            Tender tender = tendersById.get(st.getTenderId());
            if (tender == null) {
                continue;
            }
            User sender = sendersById.get(st.getSenderUserId());
            String senderName = sender != null ? sender.getUsername() : "Użytkownik #" + st.getSenderUserId();
            UserTender myUt = myUserTendersByTenderId.get(tender.getId());
            TenderResponseDto tenderDto = myUt != null
                    ? TenderResponseDto.fromUserTender(myUt)
                    : TenderResponseDto.fromCatalogForRecipient(tender);
            result.add(new SharedTenderDto(
                    st.getId(),
                    st.getTenderId(),
                    st.getSenderUserId(),
                    senderName,
                    st.getNote(),
                    Boolean.TRUE.equals(st.getIsRead()),
                    st.getCreatedAt(),
                    tenderDto
            ));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public SharedBadgeDto getBadge(String username) {
        User currentUser = requireUser(username);
        long total = sharedTenderRepository.countByRecipientUserId(currentUser.getId());
        long unread = sharedTenderRepository.countByRecipientUserIdAndIsReadFalse(currentUser.getId());
        return new SharedBadgeDto(total, unread);
    }

    @Transactional
    public ShareActionResultDto shareTenders(String username, ShareTendersRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Brak danych żądania przesłania przetargów.");
        }
        User sender = requireUser(username);
        List<Long> recipientIds = distinctNonNull(req.recipientUserIds());
        List<Long> tenderIds = distinctNonNull(req.tenderIds());

        if (recipientIds.isEmpty()) {
            throw new IllegalArgumentException("Wybierz przynajmniej jednego odbiorcę ze swojej grupy lub podgrupy.");
        }
        if (tenderIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jeden przetarg do przesłania.");
        }

        Map<Long, SharePeerDto> eligiblePeers = computePeersForUser(sender).stream()
                .collect(Collectors.toMap(SharePeerDto::userId, Function.identity()));
        for (Long rid : recipientIds) {
            if (!eligiblePeers.containsKey(rid)) {
                throw new IllegalArgumentException("Możesz przesyłać przetargi wyłącznie do użytkowników z Twojej grupy lub podgrupy.");
            }
        }

        List<Tender> tenders = tenderRepository.findAllById(tenderIds);
        if (tenders.isEmpty()) {
            throw new IllegalArgumentException("Nie znaleziono wybranych przetargów.");
        }

        String note = trimOrNull(req.note());
        OffsetDateTime nowPl = dateService.nowPoland();

        int totalCreated = 0;
        int skippedCount = 0;
        int notifiedRecipients = 0;
        for (Long recipientId : recipientIds) {
            List<Tender> createdForRecipient = new ArrayList<>();
            for (Tender tender : tenders) {
                if (sharedTenderRepository.existsByRecipientUserIdAndTenderId(recipientId, tender.getId())) {
                    skippedCount++;
                    continue;
                }
                SharedTender st = new SharedTender();
                st.setTenderId(tender.getId());
                st.setSenderUserId(sender.getId());
                st.setRecipientUserId(recipientId);
                st.setNote(note);
                st.setIsRead(false);
                st.setCreatedAt(nowPl);
                sharedTenderRepository.save(st);
                createdForRecipient.add(tender);
                totalCreated++;
            }

            if (createdForRecipient.isEmpty()) {
                continue;
            }
            notifiedRecipients++;

            String title = createdForRecipient.size() == 1
                    ? "Przesłano przetarg od " + sender.getUsername()
                    : "Przesłano " + createdForRecipient.size() + " przetargów od " + sender.getUsername();

            String summary;
            if (createdForRecipient.size() == 1) {
                summary = truncate(createdForRecipient.get(0).getTitle(), 140);
            } else {
                summary = "Otrzymano " + createdForRecipient.size() + " przetargów w zakładce Przesłane.";
            }
            if (note != null) {
                summary = summary + " • Wiadomość: " + truncate(note, 120);
            }

            StringBuilder details = new StringBuilder();
            details.append("Nadawca: ").append(sender.getUsername()).append("\n");
            if (note != null) {
                details.append("Wiadomość: ").append(note).append("\n");
            }
            details.append("\nPrzesłane przetargi:\n");
            for (Tender t : createdForRecipient) {
                details.append("• [").append(t.getExternalId()).append("] ")
                        .append(t.getTitle()).append("\n");
            }

            notificationService.notifyUser(
                    recipientId,
                    "SHARED_TENDER",
                    "Przesłane od " + sender.getUsername(),
                    title,
                    summary,
                    details.toString(),
                    nowPl
            );
        }

        String msg;
        if (totalCreated == 0 && skippedCount > 0) {
            msg = recipientIds.size() == 1
                    ? "Odbiorca już ma wybrane przetargi (pominięto: " + skippedCount + ")."
                    : "Wszyscy wybrani odbiorcy już mają wybrane przetargi (pominięto: " + skippedCount + ").";
        } else if (skippedCount > 0) {
            msg = "Udostępniono " + totalCreated + " przetarg(ów), pominięto " + skippedCount
                    + " (odbiorca już je posiada).";
        } else {
            msg = "Przesłano " + tenders.size() + " przetarg(ów) do " + notifiedRecipients + " użytkownik(ów).";
        }
        return new ShareActionResultDto(totalCreated, skippedCount, notifiedRecipients, msg);
    }

    @Transactional
    public void markAllTendersRead(String username) {
        User currentUser = requireUser(username);
        List<SharedTender> unread = sharedTenderRepository.findByRecipientUserIdAndIsReadFalse(currentUser.getId());
        if (!unread.isEmpty()) {
            unread.forEach(s -> s.setIsRead(true));
            sharedTenderRepository.saveAll(unread);
        }
    }

    @Transactional
    public void markTenderRead(Long sharedTenderId, String username) {
        User currentUser = requireUser(username);
        SharedTender st = sharedTenderRepository.findById(sharedTenderId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono przesłanego przetargu o id=" + sharedTenderId));
        if (!st.getRecipientUserId().equals(currentUser.getId())) {
            throw new IllegalArgumentException("Brak dostępu do tego wpisu.");
        }
        st.setIsRead(true);
        sharedTenderRepository.save(st);
    }

    @Transactional
    public void deleteReceivedTender(Long sharedTenderId, String username) {
        User currentUser = requireUser(username);
        sharedTenderRepository.findById(sharedTenderId).ifPresent(st -> {
            if (st.getRecipientUserId().equals(currentUser.getId())) {
                sharedTenderRepository.deleteById(sharedTenderId);
            }
        });
    }

    @Transactional
    public CreatedReportDto createReportFromShared(String username, CreateSharedReportRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Brak danych żądania utworzenia raportu.");
        }
        User currentUser = requireUser(username);
        List<Long> sharedIds = distinctNonNull(req.sharedTenderIds());
        if (sharedIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jeden przesłany przetarg.");
        }

        List<SharedTender> ownedShares = sharedTenderRepository.findAllById(sharedIds).stream()
                .filter(st -> st.getRecipientUserId().equals(currentUser.getId()))
                .toList();
        if (ownedShares.isEmpty()) {
            throw new IllegalArgumentException("Nie znaleziono wybranych przesłanych przetargów.");
        }

        Set<Long> tenderIds = ownedShares.stream()
                .map(SharedTender::getTenderId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<Tender> tenders = tenderRepository.findAllById(tenderIds);
        if (tenders.isEmpty()) {
            throw new IllegalArgumentException("Powiązane przetargi nie istnieją już w systemie.");
        }

        Set<Long> senderIds = ownedShares.stream().map(SharedTender::getSenderUserId).collect(Collectors.toSet());
        List<String> senderNames = userRepository.findAllById(senderIds).stream()
                .map(User::getUsername)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        String customName = trimOrNull(req.reportName());
        String sourceType = customName != null
                ? "PRZESŁANE [" + truncate(customName, 110) + "]"
                : "PRZESŁANE [z wybranych]";

        String summary = "Raport z zakładki Przesłane (" + tenders.size() + " przetargów"
                + (senderNames.isEmpty() ? "" : ", od: " + String.join(", ", senderNames))
                + ")";

        FetchRun run = new FetchRun();
        run.setSourceType(sourceType);
        run.setSourcesSummary(summary);
        run.setTotalFetched(tenders.size());
        run.setSavedCount(tenders.size());
        run.setExcludedCount(0);
        run.setZeroScoreCount(0);
        run.setCreatedAt(dateService.nowPoland());
        run.setOwnerUserId(currentUser.getId());
        run.setUserSeqNo(fetchRunRepository.nextUserSeqNo(currentUser.getId()));
        run.setTargetUserId(currentUser.getId());
        run.setSharedByUsername(senderNames.size() == 1 ? senderNames.get(0) : String.join(", ", senderNames));
        run.setTenders(new ArrayList<>(tenders));
        run.setTenderUpdates(new LinkedHashSet<>());

        FetchRun saved = fetchRunRepository.save(run);
        return new CreatedReportDto(
                saved.getId(),
                saved.getUserSeqNo(),
                saved.getSourceType(),
                tenders.size(),
                "Utworzono raport (#" + saved.getDisplayNumber() + ") w zakładce Raporty."
        );
    }

    @Transactional
    public ShareActionResultDto shareReports(String username, ShareReportsRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Brak danych żądania przesłania raportów.");
        }
        User sender = requireUser(username);
        List<Long> recipientIds = distinctNonNull(req.recipientUserIds());
        List<Long> runIds = distinctNonNull(req.runIds());

        if (recipientIds.isEmpty()) {
            throw new IllegalArgumentException("Wybierz przynajmniej jednego odbiorcę ze swojej grupy lub podgrupy.");
        }
        if (runIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jeden raport do przesłania.");
        }

        Map<Long, SharePeerDto> eligiblePeers = computePeersForUser(sender).stream()
                .collect(Collectors.toMap(SharePeerDto::userId, Function.identity()));
        for (Long rid : recipientIds) {
            if (!eligiblePeers.containsKey(rid)) {
                throw new IllegalArgumentException("Możesz przesyłać raporty wyłącznie do użytkowników z Twojej grupy lub podgrupy.");
            }
        }

        List<FetchRun> sourceRuns = fetchRunRepository.findAllById(runIds).stream()
                .filter(r -> sender.getId().equals(r.getOwnerUserId())
                        || sender.getId().equals(r.getTargetUserId()))
                .toList();
        if (sourceRuns.isEmpty()) {
            throw new IllegalArgumentException("Nie znaleziono wybranych raportów.");
        }

        String note = trimOrNull(req.note());
        OffsetDateTime nowPl = dateService.nowPoland();

        int totalCreated = 0;
        for (Long recipientId : recipientIds) {
            int nextSeq = fetchRunRepository.nextUserSeqNo(recipientId);
            for (FetchRun src : sourceRuns) {
                FetchRun copy = new FetchRun();
                copy.setSourceType("PRZESŁANE [od: " + truncate(sender.getUsername(), 90) + "]");
                String origSummary = src.getSourcesSummary() != null && !src.getSourcesSummary().isBlank()
                        ? src.getSourcesSummary()
                        : src.getSourceType();
                copy.setSourcesSummary(origSummary + (note != null ? " • Wiadomość: " + truncate(note, 160) : ""));
                copy.setTotalFetched(src.getTotalFetched());
                copy.setSavedCount(src.getSavedCount());
                copy.setExcludedCount(src.getExcludedCount());
                copy.setZeroScoreCount(src.getZeroScoreCount());
                copy.setCreatedAt(nowPl);
                copy.setOwnerUserId(recipientId);
                copy.setUserSeqNo(nextSeq++);
                copy.setTargetUserId(recipientId);
                copy.setSharedByUsername(sender.getUsername());
                copy.setSharedNote(note);
                copy.setTenders(src.getTenders() != null ? new ArrayList<>(src.getTenders()) : new ArrayList<>());
                copy.setTenderUpdates(src.getTenderUpdates() != null ? new LinkedHashSet<>(src.getTenderUpdates()) : new LinkedHashSet<>());
                fetchRunRepository.save(copy);
                totalCreated++;
            }

            String title = sourceRuns.size() == 1
                    ? "Przesłano raport od " + sender.getUsername()
                    : "Przesłano " + sourceRuns.size() + " raportów od " + sender.getUsername();

            String summary = sourceRuns.size() == 1
                    ? "Nowy raport w zakładce Raporty (" + sourceRuns.get(0).getSavedCount() + " pozycji)."
                    : "Otrzymano " + sourceRuns.size() + " raportów w zakładce Raporty.";
            if (note != null) {
                summary = summary + " • Wiadomość: " + truncate(note, 120);
            }

            StringBuilder details = new StringBuilder();
            details.append("Nadawca: ").append(sender.getUsername()).append("\n");
            if (note != null) {
                details.append("Wiadomość: ").append(note).append("\n");
            }
            details.append("\nPrzesłane raporty:\n");
            for (FetchRun r : sourceRuns) {
                details.append("• #").append(r.getDisplayNumber())
                        .append(" (").append(r.getSourceType()).append(") — ")
                        .append(r.getSavedCount()).append(" zapisanych\n");
            }

            notificationService.notifyUser(
                    recipientId,
                    "SHARED_REPORT",
                    "Raport od " + sender.getUsername(),
                    title,
                    summary,
                    details.toString(),
                    nowPl
            );
        }

        String msg = "Przesłano " + sourceRuns.size() + " raport(ów) do " + recipientIds.size() + " użytkownik(ów).";
        return new ShareActionResultDto(totalCreated, recipientIds.size(), msg);
    }

    List<SharePeerDto> computePeersForUser(User currentUser) {
        List<AppGroup> allGroups = groupRepository.findAllByOrderByIdAsc();
        if (allGroups.isEmpty()) {
            return List.of();
        }
        Map<Long, AppGroup> groupsById = allGroups.stream()
                .collect(Collectors.toMap(AppGroup::getId, Function.identity()));
        Map<Long, List<AppGroup>> childrenByParent = new HashMap<>();
        for (AppGroup g : allGroups) {
            if (g.getParentId() != null) {
                childrenByParent.computeIfAbsent(g.getParentId(), k -> new ArrayList<>()).add(g);
            }
        }

        List<AppGroupMember> allMembers = groupMemberRepository.findAll();
        Map<Long, Set<Long>> directGroupsByUser = new HashMap<>();
        for (AppGroupMember gm : allMembers) {
            directGroupsByUser.computeIfAbsent(gm.getUserId(), k -> new LinkedHashSet<>()).add(gm.getGroupId());
        }

        Set<Long> senderEffectiveScopes = computeEffectiveScopes(
                directGroupsByUser.getOrDefault(currentUser.getId(), Set.of()),
                groupsById,
                childrenByParent
        );
        if (senderEffectiveScopes.isEmpty()) {
            return List.of();
        }

        List<User> allUsers = userRepository.findAll();
        List<SharePeerDto> peers = new ArrayList<>();

        for (User candidate : allUsers) {
            if (candidate.getId().equals(currentUser.getId()) || !Boolean.TRUE.equals(candidate.getIsActive())) {
                continue;
            }
            Set<Long> candidateEffectiveScopes = computeEffectiveScopes(
                    directGroupsByUser.getOrDefault(candidate.getId(), Set.of()),
                    groupsById,
                    childrenByParent
            );
            Set<Long> intersection = new LinkedHashSet<>(senderEffectiveScopes);
            intersection.retainAll(candidateEffectiveScopes);
            if (intersection.isEmpty()) {
                continue;
            }

            List<String> sharedLabels = formatSharedScopeLabels(intersection, groupsById);
            peers.add(new SharePeerDto(
                    candidate.getId(),
                    candidate.getUsername(),
                    candidate.getEmail(),
                    sharedLabels
            ));
        }

        peers.sort(Comparator.comparing(SharePeerDto::username, String.CASE_INSENSITIVE_ORDER));
        return peers;
    }

    private Set<Long> computeEffectiveScopes(
            Set<Long> directGroupIds,
            Map<Long, AppGroup> groupsById,
            Map<Long, List<AppGroup>> childrenByParent
    ) {
        Set<Long> effective = new LinkedHashSet<>();
        for (Long gid : directGroupIds) {
            AppGroup g = groupsById.get(gid);
            if (g == null) continue;
            effective.add(gid);
            if (g.getParentId() == null) {
                for (AppGroup child : childrenByParent.getOrDefault(gid, List.of())) {
                    effective.add(child.getId());
                }
            }
        }
        return effective;
    }

    private List<String> formatSharedScopeLabels(Set<Long> sharedScopeIds, Map<Long, AppGroup> groupsById) {
        Set<Long> sharedRootIds = new HashSet<>();
        List<String> labels = new ArrayList<>();

        for (Long id : sharedScopeIds) {
            AppGroup g = groupsById.get(id);
            if (g != null && g.getParentId() == null) {
                sharedRootIds.add(g.getId());
                labels.add(g.getName() + " (grupa główna)");
            }
        }

        for (Long id : sharedScopeIds) {
            AppGroup g = groupsById.get(id);
            if (g != null && g.getParentId() != null && !sharedRootIds.contains(g.getParentId())) {
                AppGroup parent = groupsById.get(g.getParentId());
                String label = parent != null ? parent.getName() + " → " + g.getName() : g.getName();
                labels.add(label);
            }
        }

        labels.sort(String.CASE_INSENSITIVE_ORDER);
        return labels;
    }

    private User requireUser(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Brak uwierzytelnionego użytkownika.");
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono użytkownika: " + username));
    }

    private List<Long> distinctNonNull(List<Long> ids) {
        if (ids == null) return List.of();
        return ids.stream().filter(Objects::nonNull).distinct().toList();
    }

    private String trimOrNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
