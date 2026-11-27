package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.UserTenderRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Cienki orkiestrator (fasada) koordynujący wykonywanie wyszukiwań przetargów,
 * uruchamianie profili automatyzacji oraz delegujący wyspecjalizowane zadania
 * do dedykowanych serwisów domenowych.
 */
@Service
public class TenderExecutionService {

    private final ApiEndpointRepository endpointRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final TenderRepository tenderRepository;
    private final UserTenderRepository userTenderRepository;
    private final FetchRunRepository fetchRunRepository;
    private final AutomationProfileRepository profileRepository;

    private final TenderDateService dateService;
    private final TenderSourceFetchService sourceFetchService;
    private final KeywordMatchingService keywordMatchingService;
    private final CategoryQueryService categoryQueryService;
    private final ObservedTenderUpdateService observedUpdateService;
    private final ReportExportService reportExportService;
    private final ReportEmailService reportEmailService;
    private final AutomationNotificationService notificationService;
    private final CurrentUserService currentUserService;

    public TenderExecutionService(
            ApiEndpointRepository endpointRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            TenderRepository tenderRepository,
            UserTenderRepository userTenderRepository,
            FetchRunRepository fetchRunRepository,
            AutomationProfileRepository profileRepository,
            TenderDateService dateService,
            TenderSourceFetchService sourceFetchService,
            KeywordMatchingService keywordMatchingService,
            CategoryQueryService categoryQueryService,
            ObservedTenderUpdateService observedUpdateService,
            ReportExportService reportExportService,
            ReportEmailService reportEmailService,
            AutomationNotificationService notificationService,
            CurrentUserService currentUserService
    ) {
        this.endpointRepository = endpointRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.tenderRepository = tenderRepository;
        this.userTenderRepository = userTenderRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.profileRepository = profileRepository;
        this.dateService = dateService;
        this.sourceFetchService = sourceFetchService;
        this.keywordMatchingService = keywordMatchingService;
        this.categoryQueryService = categoryQueryService;
        this.observedUpdateService = observedUpdateService;
        this.reportExportService = reportExportService;
        this.reportEmailService = reportEmailService;
        this.notificationService = notificationService;
        this.currentUserService = currentUserService;
    }

    public ExecutionSummary executeProfileNow(Long profileId) {
        return executeProfileNow(profileId, true);
    }

    public ExecutionSummary executeProfileNow(Long profileId, boolean createNotification) {
        AutomationProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + profileId));
        OffsetDateTime nowPl = dateService.nowPoland();
        Long ownerUserId = profile.getOwnerUserId() != null
                ? profile.getOwnerUserId()
                : currentUserService.findFallbackAdminId().orElse(null);

        try {
            List<Long> epIds = keywordMatchingService.parseIds(profile.getEndpointIds());
            boolean useQuery = Boolean.TRUE.equals(profile.getUseCategoryQuery())
                    && profile.getCategoryQuery() != null
                    && !profile.getCategoryQuery().isBlank();
            Map<Long, String> catModes = keywordMatchingService.parseCategoryIdsWithModes(
                    profile.getCategoryIds(), profile.getMatchMode());
            List<Long> catIds = new ArrayList<>(catModes.keySet());

            if (epIds.isEmpty()) {
                throw new IllegalArgumentException("Profil nie ma przypisanych żadnych endpointów.");
            }
            if (!useQuery && catIds.isEmpty()) {
                throw new IllegalArgumentException("Profil nie ma przypisanych żadnych kategorii słów kluczowych.");
            }

            ExecutionSummary summary = executeSearch(
                    epIds,
                    catIds,
                    profile.getMatchMode(),
                    catModes,
                    useQuery ? profile.getCategoryQuery() : null,
                    "CRON [" + profile.getName() + "]",
                    ownerUserId
            );

            String statusMsg = "Zapisano: " + summary.savedCount()
                    + " (nowe: " + summary.newSavedCount()
                    + ", już w bazie: " + summary.existingUpdatedCount()
                    + " | Pobrano: " + summary.totalFetched() + ")";
            boolean hasErrors = false;
            List<String> errorReasons = new ArrayList<>();

            StringBuilder details = new StringBuilder();
            details.append("Profil: ").append(profile.getName()).append("\n")
                    .append("Pobrano ogłoszeń: ").append(summary.totalFetched())
                    .append(" | Zapisano (>0 pkt): ").append(summary.savedCount())
                    .append(" (nowe: ").append(summary.newSavedCount())
                    .append(", już w bazie / zakt.: ").append(summary.existingUpdatedCount()).append(")")
                    .append(" | Wykluczono: ").append(summary.excludedCount())
                    .append(" | Pominięto (0 pkt): ").append(summary.zeroScoreSkippedCount()).append("\n");

            if (summary.logs() != null && !summary.logs().isEmpty()) {
                details.append("\n--- Źródła danych ---\n");
                for (SourceLog log : summary.logs()) {
                    details.append(log.success() ? "[OK] " : "[BŁĄD] ")
                            .append(log.sourceName()).append(": ").append(log.message()).append("\n");
                    if (!log.success()) {
                        hasErrors = true;
                        errorReasons.add(log.sourceName() + " — " + log.message());
                    }
                }
            }

            Long smtpId = profile.getSmtpAccountId();
            List<String> emails = reportEmailService.parseEmails(profile.getRecipientEmails());
            if (smtpId != null && !emails.isEmpty() && summary.fetchRunId() != null) {
                details.append("\n--- Wysyłka e-mail (SMTP) ---\n");
                try {
                    EmailDispatchResult mailRes = reportEmailService.sendRunsToEmails(
                            List.of(summary.fetchRunId()),
                            emails,
                            "Raport Cron [" + profile.getName() + "] - Przetargi",
                            smtpId
                    );
                    statusMsg += " | Email: " + mailRes.message();
                    details.append(mailRes.sent() ? "[OK] " : "[BŁĄD] ").append(mailRes.message()).append("\n");
                    if (!mailRes.sent()) {
                        hasErrors = true;
                        errorReasons.add("SMTP: " + mailRes.message());
                    }
                } catch (Exception e) {
                    String mailErr = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                    statusMsg += " | Błąd email: " + mailErr;
                    details.append("[BŁĄD] Nie udało się wysłać wiadomości e-mail: ").append(mailErr).append("\n");
                    hasErrors = true;
                    errorReasons.add("SMTP: " + mailErr);
                }
            } else {
                details.append("\n--- Wysyłka e-mail ---\nPominięto (brak SMTP lub brak odbiorców).\n");
            }

            profile.setLastRunAt(nowPl);
            profile.setLastRunStatus(statusMsg);
            profileRepository.save(profile);

            if (createNotification) {
                notificationService.notifyProfileExecution(
                        profile, summary, hasErrors, errorReasons, details.toString(), nowPl);
            }

            return summary;
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            profile.setLastRunAt(nowPl);
            profile.setLastRunStatus("Błąd: " + errMsg);
            profileRepository.save(profile);

            if (createNotification) {
                notificationService.notifyProfileFailure(profile, e, errMsg, nowPl);
            }
            throw e;
        }
    }

    public ExecutionSummary executeSearch(List<Long> endpointIds, List<Long> categoryIds, String matchMode, String sourceType) {
        return executeSearch(endpointIds, categoryIds, matchMode, null, null, sourceType, null);
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String sourceType
    ) {
        return executeSearch(endpointIds, categoryIds, matchMode, categoryMatchModes, null, sourceType, null);
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String categoryQuery,
            String sourceType
    ) {
        return executeSearch(endpointIds, categoryIds, matchMode, categoryMatchModes, categoryQuery, sourceType, null);
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String categoryQuery,
            String sourceType,
            Long ownerUserId
    ) {
        Long effectiveUserId = ownerUserId != null
                ? ownerUserId
                : currentUserService.resolveUserId(null).orElse(null);

        String fallbackMode = (matchMode != null && !matchMode.isBlank()) ? matchMode : "OR";
        List<ApiEndpoint> selectedEndpoints = endpointRepository.findAllById(endpointIds != null ? endpointIds : List.of());
        boolean usingQuery = categoryQuery != null && !categoryQuery.isBlank();
        List<KeywordCategory> selectedCategories;
        CategoryQueryService.ParsedQuery parsedQuery = null;

        if (usingQuery) {
            List<KeywordCategory> availableCategories = (categoryIds != null && !categoryIds.isEmpty())
                    ? keywordCategoryRepository.findAllById(categoryIds)
                    : keywordCategoryRepository.findAll();
            parsedQuery = categoryQueryService.parse(categoryQuery, availableCategories);
            selectedCategories = parsedQuery.referencedCategories();
        } else {
            selectedCategories = keywordCategoryRepository.findAllById(categoryIds != null ? categoryIds : List.of());
        }

        List<Tender> userObservedTenders = effectiveUserId != null
                ? userTenderRepository.findByUserIdAndStatusOrderByIdAsc(effectiveUserId, TenderStatus.INTERESTED)
                        .stream()
                        .map(UserTender::getTender)
                        .toList()
                : List.of();

        int totalFetched = 0;
        int savedCount = 0;
        int newSavedCount = 0;
        int existingUpdatedCount = 0;
        int excludedCount = 0;
        int zeroScoreSkippedCount = 0;
        List<SourceLog> logs = new ArrayList<>();
        Map<Long, Tender> savedTendersInRun = new LinkedHashMap<>();
        List<String> sourceNames = new ArrayList<>();

        OffsetDateTime nowPl = dateService.nowPoland();

        for (ApiEndpoint ep : selectedEndpoints) {
            sourceNames.add(ep.getName());
            try {
                List<TenderSourceFetchService.RawItem> rawItems = sourceFetchService.fetchItems(ep);

                int epSaved = 0;
                int epNewSaved = 0;
                int epExistingUpdated = 0;
                int epObservedUpdates = 0;

                for (TenderSourceFetchService.RawItem item : rawItems) {
                    totalFetched++;
                    String title = (item.title() != null && !item.title().isBlank()) ? item.title().trim() : "Ogloszenie przetargowe";
                    String description = item.description() != null ? item.description().trim() : "";
                    String externalId = sourceFetchService.normalizeExternalId(item.externalId(), title, ep.getId());
                    String groupKey = sourceFetchService.normalizeGroupKey(item.groupKey(), title);
                    OffsetDateTime submissionDeadline = item.submissionDeadline() != null
                            ? item.submissionDeadline() : dateService.extractDeadlineFromText(description);

                    // Wykryj aktualizację dla już obserwowanego (INTERESTED) przetargu bieżącego użytkownika
                    Optional<Tender> matchedObserved = observedUpdateService.findMatchingObservedTender(
                            userObservedTenders, externalId, groupKey, title);
                    if (matchedObserved.isPresent()) {
                        if (observedUpdateService.recordObservedUpdateIfChanged(
                                matchedObserved.get(), externalId, title, description, submissionDeadline, groupKey, nowPl)) {
                            epObservedUpdates++;
                        }
                    }

                    KeywordMatchingService.ScoreEvaluation evaluation = (parsedQuery != null)
                            ? categoryQueryService.evaluate(title, description, parsedQuery)
                            : keywordMatchingService.evaluate(
                                    title, description, selectedCategories, categoryMatchModes, fallbackMode);
                    if (evaluation.excluded()) {
                        excludedCount++;
                        continue;
                    }
                    if (evaluation.totalScore() <= 0 || evaluation.categoryBreakdowns().isEmpty()) {
                        zeroScoreSkippedCount++;
                        continue;
                    }

                    // Nie nadpisujemy pierwotnej treści obserwowanego przetargu — aktualizacje trafiają do tender_updates
                    if (matchedObserved.isPresent()) {
                        Tender obs = matchedObserved.get();
                        if (savedTendersInRun.put(obs.getId(), obs) == null) {
                            savedCount++;
                            existingUpdatedCount++;
                            epSaved++;
                            epExistingUpdated++;
                        }
                        continue;
                    }

                    String breakdownLine = "Punktacja kategorii: " + String.join(" / ", evaluation.categoryBreakdowns());

                    // 1. Deduplikowany upsert w globalnym katalogu tenders (bez per-user punktacji w opisie!)
                    Tender tender = tenderRepository.findByExternalId(externalId).orElseGet(() -> {
                        Tender t = new Tender();
                        t.setExternalId(externalId);
                        t.setStatus(TenderStatus.NEW);
                        t.setHasUnreadUpdate(false);
                        t.setPublicationDate(nowPl);
                        return t;
                    });
                    boolean isNewCatalogTender = (tender.getId() == null);

                    Tender savedTender;
                    if (isNewCatalogTender) {
                        tender.setTitle(title);
                        tender.setDescription(description);
                        tender.setScore(evaluation.totalScore());
                        if (submissionDeadline != null) tender.setSubmissionDeadline(submissionDeadline);
                        if (groupKey != null) tender.setGroupKey(groupKey);
                        if (tender.getHasUnreadUpdate() == null) tender.setHasUnreadUpdate(false);
                        savedTender = tenderRepository.save(tender);
                    } else {
                        boolean observedByAnyone = !userTenderRepository
                                .findByTenderIdAndStatus(tender.getId(), TenderStatus.INTERESTED)
                                .isEmpty();
                        if (observedByAnyone) {
                            if (observedUpdateService.recordObservedUpdateIfChanged(
                                    tender, externalId, title, description, submissionDeadline, groupKey, nowPl)) {
                                epObservedUpdates++;
                            }
                            savedTender = tender;
                        } else {
                            tender.setTitle(title);
                            if (!description.isBlank()) {
                                tender.setDescription(description);
                            }
                            if (submissionDeadline != null) tender.setSubmissionDeadline(submissionDeadline);
                            if (groupKey != null) tender.setGroupKey(groupKey);
                            savedTender = tenderRepository.save(tender);
                        }
                    }

                    // 2. Lekki wpis w przestrzeni roboczej użytkownika (user_tenders)
                    boolean isNewForUser;
                    if (effectiveUserId != null) {
                        Optional<UserTender> existingUtOpt = userTenderRepository
                                .findByUserIdAndTenderId(effectiveUserId, savedTender.getId());
                        if (existingUtOpt.isEmpty()) {
                            UserTender ut = new UserTender();
                            ut.setUserId(effectiveUserId);
                            ut.setTender(savedTender);
                            ut.setStatus(TenderStatus.NEW);
                            ut.setScore(evaluation.totalScore());
                            ut.setScoreBreakdown(breakdownLine);
                            ut.setHasUnreadUpdate(false);
                            ut.setLastReadUpdateVersion(0);
                            ut.setCreatedAt(nowPl);
                            ut.setUpdatedAt(nowPl);
                            userTenderRepository.save(ut);
                            isNewForUser = true;
                        } else {
                            UserTender ut = existingUtOpt.get();
                            // Zachowujemy status użytkownika (np. INTERESTED / DISCARDED nigdy nie wraca na NEW)
                            if (ut.getStatus() != TenderStatus.INTERESTED) {
                                ut.setScore(evaluation.totalScore());
                                ut.setScoreBreakdown(breakdownLine);
                                ut.setUpdatedAt(nowPl);
                                userTenderRepository.save(ut);
                            }
                            isNewForUser = false;
                        }
                    } else {
                        isNewForUser = isNewCatalogTender;
                    }

                    if (savedTendersInRun.put(savedTender.getId(), savedTender) == null) {
                        savedCount++;
                        epSaved++;
                        if (isNewForUser) {
                            newSavedCount++;
                            epNewSaved++;
                        } else {
                            existingUpdatedCount++;
                            epExistingUpdated++;
                        }
                    }
                }

                ep.setLastSyncAt(dateService.nowPoland());
                endpointRepository.save(ep);
                String msg = "Zapisano " + epSaved + " przetargów (>0 pkt) z " + rawItems.size()
                        + " pobranych (nowych: " + epNewSaved
                        + ", już w bazie / zakt.: " + epExistingUpdated + ").";
                if (epObservedUpdates > 0) msg += " Wykryto " + epObservedUpdates + " aktualizacji obserwowanych.";
                logs.add(new SourceLog(ep.getName(), true, epSaved, msg));
            } catch (Exception e) {
                logs.add(new SourceLog(ep.getName(), false, 0, "Blad: " + e.getMessage()));
            }
        }

        FetchRun run = new FetchRun();
        run.setSourceType(sourceType != null ? sourceType : "MANUAL");
        run.setSourcesSummary(String.join(", ", sourceNames));
        run.setTotalFetched(totalFetched);
        run.setSavedCount(savedCount);
        run.setExcludedCount(excludedCount);
        run.setZeroScoreCount(zeroScoreSkippedCount);
        run.setCreatedAt(dateService.nowPoland());
        run.setOwnerUserId(effectiveUserId);
        run.setTenders(new ArrayList<>(savedTendersInRun.values()));
        FetchRun savedRun = fetchRunRepository.save(run);

        return new ExecutionSummary(
                savedRun.getId(),
                totalFetched,
                savedCount,
                newSavedCount,
                existingUpdatedCount,
                excludedCount,
                zeroScoreSkippedCount,
                logs
        );
    }

    // --- Delegacje fasadowe do wyspecjalizowanych serwisów ---

    public ObservedCheckSummary checkUpdatesForObservedTenders() {
        return observedUpdateService.checkUpdatesForObservedTenders();
    }

    public FetchRun createReportFromObserved(List<Long> tenderIds, List<Long> updateIds, String reportName) {
        return reportExportService.createReportFromObserved(tenderIds, updateIds, reportName);
    }

    public ExcelExportResult generateExcelForRuns(List<Long> runIds) throws Exception {
        return reportExportService.generateExcelForRuns(runIds);
    }

    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject) throws Exception {
        return reportEmailService.sendRunsToEmails(runIds, emails, subject, null);
    }

    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject, Long smtpAccountId) throws Exception {
        return reportEmailService.sendRunsToEmails(runIds, emails, subject, smtpAccountId);
    }

    public List<String> parseEmails(String raw) {
        return reportEmailService.parseEmails(raw);
    }

    public String testScraperConnection(ApiEndpoint ep) throws Exception {
        return sourceFetchService.testScraperConnection(ep);
    }

    public String resolveDynamicTokens(String raw) {
        return dateService.resolveDynamicTokens(raw);
    }

    public OffsetDateTime extractDeadlineFromDescription(String desc) {
        return dateService.extractDeadlineFromDescription(desc);
    }

    public OffsetDateTime parseFlexibleDateTime(String raw) {
        return dateService.parseFlexibleDateTime(raw);
    }

    public record SourceLog(String sourceName, boolean success, int savedCount, String message) {}
    public record ExecutionSummary(
            Long fetchRunId,
            int totalFetched,
            int savedCount,
            int newSavedCount,
            int existingUpdatedCount,
            int excludedCount,
            int zeroScoreSkippedCount,
            List<SourceLog> logs
    ) {}
    public record ObservedCheckSummary(int checkedEndpoints, int observedTendersCount, int updatesFound, List<SourceLog> logs) {}
    public record ExcelExportResult(String filename, String base64, int count) {}
    public record EmailDispatchResult(boolean sent, String message, String base64, String filename) {}
}
