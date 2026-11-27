package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import com.przetargi.java_backend.repository.UserTenderRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class ObservedTenderUpdateService {

    private final TenderRepository tenderRepository;
    private final UserTenderRepository userTenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final ApiEndpointRepository endpointRepository;
    private final TenderSourceFetchService sourceFetchService;
    private final TenderDateService dateService;

    public ObservedTenderUpdateService(
            TenderRepository tenderRepository,
            UserTenderRepository userTenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            ApiEndpointRepository endpointRepository,
            TenderSourceFetchService sourceFetchService,
            TenderDateService dateService
    ) {
        this.tenderRepository = tenderRepository;
        this.userTenderRepository = userTenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.endpointRepository = endpointRepository;
        this.sourceFetchService = sourceFetchService;
        this.dateService = dateService;
    }

    /**
     * Sprawdza aktualizacje dla wszystkich unikalnych przetargów obserwowanych (INTERESTED)
     * przez przynajmniej jednego użytkownika w user_tenders.
     * Każdy unikalny przetarg jest sprawdzany zewnętrznie dokładnie RAZ, a wykryte zmiany
     * powiadamiają wszystkich obserwujących go użytkowników.
     */
    public TenderExecutionService.ObservedCheckSummary checkUpdatesForObservedTenders() {
        List<Tender> observedTenders = userTenderRepository.findDistinctTendersByStatus(TenderStatus.INTERESTED);
        return checkUpdatesForTenderList(observedTenders);
    }

    /**
     * Sprawdza aktualizacje wyłącznie dla przetargów obserwowanych przez wskazanego użytkownika.
     */
    public TenderExecutionService.ObservedCheckSummary checkUpdatesForUser(Long userId) {
        if (userId == null) {
            return new TenderExecutionService.ObservedCheckSummary(0, 0, 0, List.of());
        }
        Map<Long, Tender> distinct = new LinkedHashMap<>();
        for (UserTender ut : userTenderRepository.findByUserIdAndStatusOrderByIdAsc(userId, TenderStatus.INTERESTED)) {
            if (ut.getTender() != null && ut.getTender().getId() != null) {
                distinct.putIfAbsent(ut.getTender().getId(), ut.getTender());
            }
        }
        return checkUpdatesForTenderList(new ArrayList<>(distinct.values()));
    }

    private TenderExecutionService.ObservedCheckSummary checkUpdatesForTenderList(List<Tender> observedTenders) {
        if (observedTenders == null || observedTenders.isEmpty()) {
            return new TenderExecutionService.ObservedCheckSummary(0, 0, 0, List.of());
        }

        List<ApiEndpoint> activeEndpoints = endpointRepository.findByIsActiveTrue();
        if (activeEndpoints.isEmpty()) {
            return new TenderExecutionService.ObservedCheckSummary(0, observedTenders.size(), 0, List.of());
        }

        OffsetDateTime nowPl = dateService.nowPoland();
        int totalUpdatesFound = 0;
        List<TenderExecutionService.SourceLog> logs = new ArrayList<>();

        for (ApiEndpoint ep : activeEndpoints) {
            try {
                List<TenderSourceFetchService.RawItem> rawItems = sourceFetchService.fetchItems(ep);

                int epUpdates = 0;
                for (TenderSourceFetchService.RawItem item : rawItems) {
                    String title = (item.title() != null && !item.title().isBlank()) ? item.title().trim() : "Ogloszenie przetargowe";
                    String description = item.description() != null ? item.description().trim() : "";
                    String externalId = sourceFetchService.normalizeExternalId(item.externalId(), title, ep.getId());
                    String groupKey = sourceFetchService.normalizeGroupKey(item.groupKey(), title);
                    OffsetDateTime deadline = item.submissionDeadline() != null
                            ? item.submissionDeadline() : dateService.extractDeadlineFromText(description);

                    Optional<Tender> matchedOpt = findMatchingObservedTender(observedTenders, externalId, groupKey, title);
                    if (matchedOpt.isEmpty()) continue;

                    if (recordObservedUpdateIfChanged(matchedOpt.get(), externalId, title, description, deadline, groupKey, nowPl)) {
                        epUpdates++;
                        totalUpdatesFound++;
                    }
                }

                ep.setLastSyncAt(nowPl);
                endpointRepository.save(ep);
                logs.add(new TenderExecutionService.SourceLog(ep.getName(), true, epUpdates,
                        epUpdates > 0
                                ? "Wykryto " + epUpdates + " aktualizacji dla obserwowanych przetargów."
                                : "Brak nowych zmian wśród " + rawItems.size() + " sprawdzonych ogłoszeń."));
            } catch (Exception e) {
                logs.add(new TenderExecutionService.SourceLog(ep.getName(), false, 0, "Błąd: " + e.getMessage()));
            }
        }

        return new TenderExecutionService.ObservedCheckSummary(activeEndpoints.size(), observedTenders.size(), totalUpdatesFound, logs);
    }

    public Optional<Tender> findMatchingObservedTender(
            List<Tender> observedTenders,
            String externalId,
            String groupKey,
            String title
    ) {
        if (observedTenders == null || observedTenders.isEmpty()) return Optional.empty();
        for (Tender t : observedTenders) {
            if (externalId != null && externalId.equalsIgnoreCase(t.getExternalId())) return Optional.of(t);
        }
        if (groupKey != null && !groupKey.isBlank()) {
            for (Tender t : observedTenders) {
                if (groupKey.equals(t.getGroupKey())) return Optional.of(t);
            }
        }
        String normTitle = sourceFetchService.normalizeTitleForGrouping(title);
        if (normTitle.length() >= 18) {
            for (Tender t : observedTenders) {
                if (normTitle.equals(sourceFetchService.normalizeTitleForGrouping(t.getTitle()))) return Optional.of(t);
            }
        }
        return Optional.empty();
    }

    public boolean recordObservedUpdateIfChanged(
            Tender observed,
            String incomingExtId,
            String incomingTitle,
            String incomingDescription,
            OffsetDateTime incomingDeadline,
            String incomingGroupKey,
            OffsetDateTime nowPl
    ) {
        if (observed == null || observed.getId() == null) return false;

        boolean metaTouched = false;
        if ((observed.getGroupKey() == null || observed.getGroupKey().isBlank()) && incomingGroupKey != null) {
            observed.setGroupKey(incomingGroupKey);
            metaTouched = true;
        }

        List<TenderUpdate> existingUpdates = tenderUpdateRepository.findByTenderIdOrderByVersionNumberDesc(observed.getId());
        TenderUpdate latest = existingUpdates.isEmpty() ? null : existingUpdates.get(0);

        String baseExtId = latest != null ? latest.getExternalId() : observed.getExternalId();
        String baseTitle = latest != null ? latest.getTitle() : observed.getTitle();
        String baseDesc = latest != null ? latest.getDescription() : observed.getDescription();
        OffsetDateTime baseDeadline = latest != null ? latest.getSubmissionDeadline() : observed.getSubmissionDeadline();

        boolean extIdChanged = incomingExtId != null && !incomingExtId.equalsIgnoreCase(baseExtId);
        boolean titleChanged = !normalizeForDiff(incomingTitle).equals(normalizeForDiff(baseTitle));
        boolean deadlineChanged = incomingDeadline != null && !dateService.sameInstant(baseDeadline, incomingDeadline);
        boolean descChanged = !normalizeDescriptionForDiff(incomingDescription).equals(normalizeDescriptionForDiff(baseDesc));

        if (!extIdChanged && !titleChanged && !deadlineChanged && !descChanged) {
            if (metaTouched) tenderRepository.save(observed);
            return false;
        }

        String incomingNormDesc = normalizeDescriptionForDiff(incomingDescription);
        String incomingNormTitle = normalizeForDiff(incomingTitle);
        for (TenderUpdate prev : existingUpdates) {
            if (Objects.equals(prev.getExternalId(), incomingExtId)
                    && normalizeForDiff(prev.getTitle()).equals(incomingNormTitle)
                    && dateService.sameInstant(prev.getSubmissionDeadline(), incomingDeadline)
                    && normalizeDescriptionForDiff(prev.getDescription()).equals(incomingNormDesc)) {
                return false;
            }
        }

        List<String> changes = new ArrayList<>();
        if (deadlineChanged && incomingDeadline != null) {
            String oldStr = baseDeadline != null ? dateService.formatPolandDateTime(baseDeadline) : "brak";
            String newStr = dateService.formatPolandDateTime(incomingDeadline);
            changes.add("Zmiana terminu składania ofert: " + oldStr + " → " + newStr);
        }
        if (extIdChanged) changes.add("Nowe powiązane ogłoszenie (ID: " + incomingExtId + ")");
        if (titleChanged) changes.add("Zmiana tytułu postępowania");
        if (descChanged) changes.add("Zaktualizowano treść / parametry ogłoszenia");

        String changeSummary = String.join(" • ", changes);

        TenderUpdate update = new TenderUpdate();
        update.setTenderId(observed.getId());
        update.setVersionNumber(latest != null ? (latest.getVersionNumber() + 1) : 1);
        update.setExternalId(sourceFetchService.truncateString(incomingExtId, 150));
        update.setTitle(incomingTitle);
        update.setDescription(incomingDescription);
        update.setSubmissionDeadline(incomingDeadline != null ? incomingDeadline : baseDeadline);
        update.setChangeSummary(changeSummary);
        update.setIsRead(false);
        update.setDetectedAt(nowPl);
        tenderUpdateRepository.save(update);

        observed.setHasUnreadUpdate(true);
        observed.setLastUpdatedAt(nowPl);
        if (observed.getSubmissionDeadline() == null && incomingDeadline != null) {
            observed.setSubmissionDeadline(incomingDeadline);
        }
        tenderRepository.save(observed);

        List<UserTender> observers = userTenderRepository.findByTenderIdAndStatus(observed.getId(), TenderStatus.INTERESTED);
        if (!observers.isEmpty()) {
            for (UserTender ut : observers) {
                ut.setHasUnreadUpdate(true);
                ut.setUpdatedAt(nowPl);
            }
            userTenderRepository.saveAll(observers);
        }
        return true;
    }

    private String normalizeForDiff(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim().toLowerCase();
    }

    private String normalizeDescriptionForDiff(String desc) {
        if (desc == null || desc.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (String line : desc.split("\n")) {
            String t = line.trim();
            if (t.isEmpty() || t.toLowerCase().startsWith("punktacja kategorii:")) continue;
            sb.append(t).append(" ");
        }
        return sb.toString().replaceAll("\\s+", " ").trim().toLowerCase();
    }
}
