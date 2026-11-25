package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class ObservedTenderUpdateService {

    private final TenderRepository tenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final ApiEndpointRepository endpointRepository;
    private final TenderSourceFetchService sourceFetchService;
    private final TenderDateService dateService;

    public ObservedTenderUpdateService(
            TenderRepository tenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            ApiEndpointRepository endpointRepository,
            TenderSourceFetchService sourceFetchService,
            TenderDateService dateService
    ) {
        this.tenderRepository = tenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.endpointRepository = endpointRepository;
        this.sourceFetchService = sourceFetchService;
        this.dateService = dateService;
    }

    /**
     * Sprawdza wyłącznie aktualizacje dla obserwowanych (INTERESTED) przetargów ze wszystkich aktywnych źródeł.
     * Nie dodaje nowych przetargów do głównej listy i nie tworzy wpisu w historii Raportów.
     */
    public TenderExecutionService.ObservedCheckSummary checkUpdatesForObservedTenders() {
        List<Tender> observedTenders = tenderRepository.findByStatusOrderByIdAsc(TenderStatus.INTERESTED);
        if (observedTenders.isEmpty()) {
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
            Optional<Tender> dbMatch = tenderRepository.findFirstByGroupKeyAndStatus(groupKey, TenderStatus.INTERESTED);
            if (dbMatch.isPresent()) return dbMatch;
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

        TenderUpdate update = new TenderUpdate();
        update.setTenderId(observed.getId());
        update.setVersionNumber(latest != null ? (latest.getVersionNumber() + 1) : 1);
        update.setExternalId(sourceFetchService.truncateString(incomingExtId, 150));
        update.setTitle(incomingTitle);
        update.setDescription(incomingDescription);
        update.setSubmissionDeadline(incomingDeadline != null ? incomingDeadline : baseDeadline);
        update.setChangeSummary(String.join(" • ", changes));
        update.setIsRead(false);
        update.setDetectedAt(nowPl);
        tenderUpdateRepository.save(update);

        observed.setHasUnreadUpdate(true);
        observed.setLastUpdatedAt(nowPl);
        if (observed.getSubmissionDeadline() == null && incomingDeadline != null) {
            observed.setSubmissionDeadline(incomingDeadline);
        }
        tenderRepository.save(observed);
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
