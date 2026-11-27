package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.CreatedReportDto;
import com.przetargi.java_backend.dto.ObservedBadgeDto;
import com.przetargi.java_backend.dto.ObservedTenderDto;
import com.przetargi.java_backend.dto.TenderResponseDto;
import com.przetargi.java_backend.dto.TenderUpdateDto;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.SharedTenderRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import com.przetargi.java_backend.repository.UserTenderRepository;
import com.przetargi.java_backend.repository.UserTenderSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class TenderService {

    private static final Set<String> TENDER_SORT_FIELDS = Set.of(
            "publicationDate",
            "title",
            "externalId",
            "submissionDeadline",
            "lastUpdatedAt",
            "groupKey"
    );

    private final TenderRepository tenderRepository;
    private final UserTenderRepository userTenderRepository;
    private final SharedTenderRepository sharedTenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final TenderDateService dateService;
    private final ObservedTenderUpdateService observedUpdateService;
    private final ReportExportService reportExportService;
    private final CurrentUserService currentUserService;

    public TenderService(
            TenderRepository tenderRepository,
            UserTenderRepository userTenderRepository,
            SharedTenderRepository sharedTenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            TenderDateService dateService,
            ObservedTenderUpdateService observedUpdateService,
            ReportExportService reportExportService,
            CurrentUserService currentUserService
    ) {
        this.tenderRepository = tenderRepository;
        this.userTenderRepository = userTenderRepository;
        this.sharedTenderRepository = sharedTenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.dateService = dateService;
        this.observedUpdateService = observedUpdateService;
        this.reportExportService = reportExportService;
        this.currentUserService = currentUserService;
    }

    @Transactional(readOnly = true)
    public Page<TenderResponseDto> getTendersPage(TenderStatus status, Integer minScore, String search, Pageable pageable) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return getTendersPageForUser(userId, status, minScore, search, pageable);
    }

    @Transactional(readOnly = true)
    public Page<TenderResponseDto> getTendersPageForUser(
            Long userId,
            TenderStatus status,
            Integer minScore,
            String search,
            Pageable pageable
    ) {
        Specification<UserTender> spec = UserTenderSpecifications.withFilters(userId, status, minScore, search);
        Pageable remapped = remapPageableForUserTender(pageable);
        return userTenderRepository.findAll(spec, remapped).map(TenderResponseDto::fromUserTender);
    }

    @Transactional
    public List<ObservedTenderDto> getObservedTenders() {
        Long userId = currentUserService.requireCurrentUser().getId();
        return getObservedTendersForUser(userId);
    }

    @Transactional
    public List<ObservedTenderDto> getObservedTendersForUser(Long userId) {
        List<UserTender> observed = userTenderRepository.findByUserIdAndStatusOrderByIdAsc(userId, TenderStatus.INTERESTED);
        if (observed.isEmpty()) {
            return List.of();
        }

        for (UserTender ut : observed) {
            Tender t = ut.getTender();
            if (t != null && t.getSubmissionDeadline() == null && t.getDescription() != null) {
                OffsetDateTime extracted = dateService.extractDeadlineFromDescription(t.getDescription());
                if (extracted != null) {
                    t.setSubmissionDeadline(extracted);
                    tenderRepository.save(t);
                }
            }
        }

        List<Long> ids = observed.stream()
                .map(ut -> ut.getTender().getId())
                .toList();
        List<TenderUpdate> allUpdates = tenderUpdateRepository.findByTenderIdInOrderByVersionNumberDesc(ids);

        Map<Long, List<TenderUpdate>> updatesByTender = new LinkedHashMap<>();
        for (TenderUpdate u : allUpdates) {
            updatesByTender.computeIfAbsent(u.getTenderId(), k -> new ArrayList<>()).add(u);
        }

        List<ObservedTenderDto> result = new ArrayList<>();
        for (UserTender ut : observed) {
            Tender t = ut.getTender();
            List<TenderUpdate> tenderUpdates = updatesByTender.getOrDefault(t.getId(), List.of());
            OffsetDateTime effectiveDeadline = t.getSubmissionDeadline();
            for (TenderUpdate u : tenderUpdates) {
                if (u.getSubmissionDeadline() != null) {
                    effectiveDeadline = u.getSubmissionDeadline();
                    break;
                }
            }
            int lastReadVer = ut.getLastReadUpdateVersion() != null ? ut.getLastReadUpdateVersion() : 0;
            long unreadCount = tenderUpdates.stream()
                    .filter(u -> u.getVersionNumber() == null || u.getVersionNumber() > lastReadVer)
                    .count();
            List<TenderUpdateDto> updateDtos = tenderUpdates.stream()
                    .map(u -> {
                        boolean isReadForUser = u.getVersionNumber() != null && u.getVersionNumber() <= lastReadVer;
                        return TenderUpdateDto.fromEntity(u, isReadForUser);
                    })
                    .toList();
            result.add(new ObservedTenderDto(
                    TenderResponseDto.fromUserTender(ut),
                    updateDtos,
                    effectiveDeadline,
                    unreadCount
            ));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public ObservedBadgeDto getObservedBadge() {
        Long userId = currentUserService.requireCurrentUser().getId();
        return getObservedBadgeForUser(userId);
    }

    @Transactional(readOnly = true)
    public ObservedBadgeDto getObservedBadgeForUser(Long userId) {
        long observedCount = userTenderRepository.countByUserIdAndStatus(userId, TenderStatus.INTERESTED);
        long unreadTendersCount = userTenderRepository.countByUserIdAndStatusAndHasUnreadUpdateTrue(userId, TenderStatus.INTERESTED);
        return new ObservedBadgeDto(observedCount, unreadTendersCount);
    }

    public TenderExecutionService.ObservedCheckSummary checkObservedUpdates() {
        Long userId = currentUserService.requireCurrentUser().getId();
        return observedUpdateService.checkUpdatesForUser(userId);
    }

    @Transactional
    public CreatedReportDto createObservedReport(List<Long> tenderIds, List<Long> updateIds, String reportName) {
        Long userId = currentUserService.requireCurrentUser().getId();
        FetchRun run = reportExportService.createReportFromObserved(tenderIds, updateIds, reportName, userId);
        return new CreatedReportDto(
                run.getId(),
                run.getUserSeqNo(),
                run.getSourceType(),
                run.getSavedCount(),
                "Utworzono raport #" + run.getDisplayNumber() + " (" + run.getSavedCount() + " poz.) — jest już dostępny w zakładce Raporty."
        );
    }

    @Transactional
    public boolean markTenderUpdatesRead(Long tenderId) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return markTenderUpdatesReadForUser(userId, tenderId);
    }

    @Transactional
    public boolean markTenderUpdatesReadForUser(Long userId, Long tenderId) {
        UserTender ut = userTenderRepository.findByUserIdAndTenderId(userId, tenderId).orElse(null);
        if (ut == null) {
            return false;
        }
        int maxVersion = getMaxUpdateVersion(tenderId);
        ut.setHasUnreadUpdate(false);
        ut.setLastReadUpdateVersion(maxVersion);
        ut.setUpdatedAt(dateService.nowPoland());
        userTenderRepository.save(ut);
        return true;
    }

    @Transactional
    public Optional<TenderResponseDto> updateDeadline(Long tenderId, String rawSubmissionDeadline) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return updateDeadlineForUser(userId, tenderId, rawSubmissionDeadline);
    }

    @Transactional
    public Optional<TenderResponseDto> updateDeadlineForUser(Long userId, Long tenderId, String rawSubmissionDeadline) {
        return userTenderRepository.findByUserIdAndTenderId(userId, tenderId).map(ut -> {
            Tender tender = ut.getTender();
            if (rawSubmissionDeadline == null || rawSubmissionDeadline.isBlank()) {
                tender.setSubmissionDeadline(null);
            } else {
                OffsetDateTime parsed = dateService.parseFlexibleDateTime(rawSubmissionDeadline);
                if (parsed == null) {
                    throw new IllegalArgumentException("Niepoprawny format daty terminu składania ofert.");
                }
                tender.setSubmissionDeadline(parsed);
            }
            tenderRepository.save(tender);
            return TenderResponseDto.fromUserTender(ut);
        });
    }

    @Transactional
    public boolean deleteUpdate(Long updateId) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return deleteUpdateForUser(userId, updateId);
    }

    @Transactional
    public boolean deleteUpdateForUser(Long userId, Long updateId) {
        TenderUpdate update = tenderUpdateRepository.findById(updateId).orElse(null);
        if (update == null) {
            return false;
        }
        Long tenderId = update.getTenderId();
        if (userTenderRepository.findByUserIdAndTenderId(userId, tenderId).isEmpty()) {
            throw new AccessDeniedException("Brak dostępu do tej aktualizacji.");
        }
        tenderUpdateRepository.deleteById(updateId);

        int remainingMaxVersion = getMaxUpdateVersion(tenderId);
        List<UserTender> observers = userTenderRepository.findByTenderIdAndStatus(tenderId, TenderStatus.INTERESTED);
        for (UserTender ut : observers) {
            int lastReadVer = ut.getLastReadUpdateVersion() != null ? ut.getLastReadUpdateVersion() : 0;
            ut.setHasUnreadUpdate(remainingMaxVersion > lastReadVer);
        }
        if (!observers.isEmpty()) {
            userTenderRepository.saveAll(observers);
        }
        return true;
    }

    @Transactional
    public Optional<TenderResponseDto> updateStatus(Long tenderId, TenderStatus status) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return updateStatusForUser(userId, tenderId, status);
    }

    @Transactional
    public Optional<TenderResponseDto> updateStatusForUser(Long userId, Long tenderId, TenderStatus status) {
        OffsetDateTime nowPl = dateService.nowPoland();
        UserTender ut = userTenderRepository.findByUserIdAndTenderId(userId, tenderId).orElse(null);
        if (ut == null) {
            if (!sharedTenderRepository.existsByRecipientUserIdAndTenderId(userId, tenderId)) {
                return Optional.empty();
            }
            Tender tender = tenderRepository.findById(tenderId).orElse(null);
            if (tender == null) {
                return Optional.empty();
            }
            ut = new UserTender();
            ut.setUserId(userId);
            ut.setTender(tender);
            ut.setStatus(status != null ? status : TenderStatus.NEW);
            ut.setScore(tender.getScore() != null ? tender.getScore() : 0);
            ut.setScoreBreakdown(extractBreakdownLineOrNull(tender.getDescription()));
            ut.setHasUnreadUpdate(false);
            ut.setLastReadUpdateVersion(getMaxUpdateVersion(tenderId));
            ut.setCreatedAt(nowPl);
            ut.setUpdatedAt(nowPl);
        } else if (status != null) {
            TenderStatus prevStatus = ut.getStatus();
            ut.setStatus(status);
            if (status == TenderStatus.INTERESTED && prevStatus != TenderStatus.INTERESTED) {
                ut.setLastReadUpdateVersion(getMaxUpdateVersion(tenderId));
                ut.setHasUnreadUpdate(false);
            }
            ut.setUpdatedAt(nowPl);
        }

        Tender tender = ut.getTender();
        if (status == TenderStatus.INTERESTED
                && tender.getSubmissionDeadline() == null
                && tender.getDescription() != null) {
            OffsetDateTime extracted = dateService.extractDeadlineFromDescription(tender.getDescription());
            if (extracted != null) {
                tender.setSubmissionDeadline(extracted);
                tenderRepository.save(tender);
            }
        }

        UserTender saved = userTenderRepository.save(ut);
        return Optional.of(TenderResponseDto.fromUserTender(saved));
    }

    @Transactional
    public boolean deleteTender(Long tenderId) {
        Long userId = currentUserService.requireCurrentUser().getId();
        return deleteTenderForUser(userId, tenderId);
    }

    @Transactional
    public boolean deleteTenderForUser(Long userId, Long tenderId) {
        UserTender ut = userTenderRepository.findByUserIdAndTenderId(userId, tenderId).orElse(null);
        if (ut == null) {
            return false;
        }
        // Usuwamy wyłącznie powiązanie użytkownika z katalogiem przetargów —
        // rekord w tabeli tenders pozostaje nietknięty dla innych użytkowników, raportów i przesłanych.
        userTenderRepository.delete(ut);
        return true;
    }

    private int getMaxUpdateVersion(Long tenderId) {
        List<TenderUpdate> updates = tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(tenderId);
        if (updates.isEmpty() || updates.get(0).getVersionNumber() == null) {
            return 0;
        }
        return updates.get(0).getVersionNumber();
    }

    private String extractBreakdownLineOrNull(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }
        for (String line : description.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("Punktacja kategorii:")) {
                return trimmed;
            }
        }
        return null;
    }

    private Pageable remapPageableForUserTender(Pageable pageable) {
        if (pageable == null || pageable.isUnpaged() || pageable.getSort().isUnsorted()) {
            return pageable;
        }
        List<Sort.Order> mappedOrders = new ArrayList<>();
        for (Sort.Order order : pageable.getSort()) {
            String prop = order.getProperty();
            String mappedProp = TENDER_SORT_FIELDS.contains(prop) ? "tender." + prop : prop;
            mappedOrders.add(new Sort.Order(order.getDirection(), mappedProp));
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(mappedOrders));
    }
}
