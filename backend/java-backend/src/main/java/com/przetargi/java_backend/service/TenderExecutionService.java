package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.AutomationNotification;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.CronConfig;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.AutomationNotificationRepository;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.CronConfigRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.LinkedHashSet;
import java.util.Set;

@Service
@EnableScheduling
public class TenderExecutionService {

    private static final ZoneId POLAND_ZONE = ZoneId.of("Europe/Warsaw");
    private static final DateTimeFormatter PL_DT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final List<DateTimeFormatter> LOCAL_DT_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm:ss"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy HH:mm"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")
    );

    private static final List<DateTimeFormatter> LOCAL_DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd.MM.yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );

    private static final Pattern DEADLINE_HINT_PATTERN = Pattern.compile(
            "(?i)(?:termin(?:\\s+sk[łl]adania\\s+ofert)?|sk[łl]adania\\s+ofert|deadline|closing\\s*date|submission\\s*deadline|do\\s+dnia|wa[żz]ne\\s+do)\\s*[:\\-]?\\s*(\\d{4}-\\d{2}-\\d{2}(?:[T\\s]\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:?\\d{2})?)?|\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}(?:[\\s,]+(?:godz\\.?\\s*)?\\d{2}:\\d{2}(?::\\d{2})?)?)"
    );

    private static final Pattern DATE_EXTRACT_PATTERN = Pattern.compile(
            "(\\d{4}-\\d{2}-\\d{2}(?:[T\\s]\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:?\\d{2})?)?|\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}(?:[\\s,]+(?:godz\\.?\\s*)?\\d{2}:\\d{2}(?::\\d{2})?)?)"
    );

    private static final Pattern DYNAMIC_DATE_TOKEN_PATTERN = Pattern.compile(
            "\\{(TODAY|YESTERDAY|TOMORROW|NOW)(?:([+-])(\\d+)D)?(?:_(COMPACT|START|END|ISO))?\\}",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern LINK_PLACEHOLDER_PATTERN = Pattern.compile("\\{([^{}]+)\\}");

    private final ApiEndpointRepository endpointRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final TenderRepository tenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final FetchRunRepository fetchRunRepository;
    private final CronConfigRepository cronConfigRepository;
    private final AutomationProfileRepository profileRepository;
    private final SmtpAccountRepository smtpAccountRepository;
    private final AutomationNotificationRepository notificationRepository;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    private final Map<Long, String> lastTriggeredMinuteByProfile = new ConcurrentHashMap<>();
    private final Map<Long, OffsetDateTime> lastIntervalTriggerByProfile = new ConcurrentHashMap<>();

    public TenderExecutionService(
            ApiEndpointRepository endpointRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            TenderRepository tenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            FetchRunRepository fetchRunRepository,
            CronConfigRepository cronConfigRepository,
            AutomationProfileRepository profileRepository,
            SmtpAccountRepository smtpAccountRepository,
            AutomationNotificationRepository notificationRepository
    ) {
        this.endpointRepository = endpointRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.tenderRepository = tenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.cronConfigRepository = cronConfigRepository;
        this.profileRepository = profileRepository;
        this.smtpAccountRepository = smtpAccountRepository;
        this.notificationRepository = notificationRepository;
    }

    public CronConfig getOrCreateCronConfig() {
        return cronConfigRepository.findById(1L).orElseGet(() -> {
            CronConfig cfg = new CronConfig();
            cfg.setId(1L);
            return cronConfigRepository.save(cfg);
        });
    }

    @Scheduled(fixedRate = 20000)
    public void checkAndRunScheduledProfiles() {
        ZonedDateTime nowPl = ZonedDateTime.now(POLAND_ZONE);
        String nowHm = nowPl.format(DateTimeFormatter.ofPattern("HH:mm"));
        String minuteKey = nowPl.toLocalDate() + " " + nowHm;
        int todayDow = nowPl.getDayOfWeek().getValue();
        OffsetDateTime nowOffset = nowPl.toOffsetDateTime();

        for (AutomationProfile profile : profileRepository.findAll()) {
            if (!Boolean.TRUE.equals(profile.getEnabled())) continue;
            String scheduleType = profile.getScheduleType() != null
                    ? profile.getScheduleType().trim().toUpperCase() : "SCHEDULE";
            try {
                if ("INTERVAL".equals(scheduleType)) {
                    int intervalMin = (profile.getIntervalMinutes() != null && profile.getIntervalMinutes() > 0)
                            ? profile.getIntervalMinutes() : 60;
                    OffsetDateTime lastRun = lastIntervalTriggerByProfile.getOrDefault(profile.getId(), profile.getLastRunAt());
                    if (lastRun == null || Duration.between(lastRun, nowOffset).toMinutes() >= intervalMin) {
                        lastIntervalTriggerByProfile.put(profile.getId(), nowOffset);
                        executeProfileNow(profile.getId(), true);
                    }
                } else {
                    String lastMinute = lastTriggeredMinuteByProfile.getOrDefault(profile.getId(), "");
                    if (!minuteKey.equals(lastMinute) && matchesScheduleExpression(profile.getCronTime(), nowHm, todayDow)) {
                        lastTriggeredMinuteByProfile.put(profile.getId(), minuteKey);
                        executeProfileNow(profile.getId(), true);
                    }
                }
            } catch (Exception ignored) {
            }
        }
    }

    private boolean matchesScheduleExpression(String rawExpr, String nowHm, int todayDow) {
        if (rawExpr == null || rawExpr.isBlank()) return false;
        for (String token : rawExpr.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            String[] parts = trimmed.split("/");
            if (!nowHm.equals(normalizeHm(parts[0].trim()))) continue;
            if (parts.length == 1 || parts[1].isBlank()) return true;
            for (String d : parts[1].trim().split(";")) {
                try {
                    if (Integer.parseInt(d.trim()) == todayDow) return true;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return false;
    }

    private String normalizeHm(String rawTime) {
        if (rawTime == null) return "";
        String[] hm = rawTime.split(":");
        if (hm.length != 2) return rawTime;
        try {
            return String.format("%02d:%02d", Integer.parseInt(hm[0].trim()), Integer.parseInt(hm[1].trim()));
        } catch (NumberFormatException e) {
            return rawTime;
        }
    }

    public ExecutionSummary executeProfileNow(Long profileId) {
        return executeProfileNow(profileId, true);
    }

    public ExecutionSummary executeProfileNow(Long profileId, boolean createNotification) {
        AutomationProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + profileId));
        OffsetDateTime nowPl = OffsetDateTime.now(POLAND_ZONE);

        try {
            List<Long> epIds = parseIds(profile.getEndpointIds());
            Map<Long, String> catModes = parseCategoryIdsWithModes(profile.getCategoryIds(), profile.getMatchMode());
            List<Long> catIds = new ArrayList<>(catModes.keySet());

            if (epIds.isEmpty()) throw new IllegalArgumentException("Profil nie ma przypisanych żadnych endpointów.");
            if (catIds.isEmpty()) throw new IllegalArgumentException("Profil nie ma przypisanych żadnych kategorii słów kluczowych.");

            ExecutionSummary summary = executeSearch(epIds, catIds, profile.getMatchMode(), catModes, "CRON [" + profile.getName() + "]");

            String statusMsg = "Zapisano: " + summary.savedCount() + " (Pobrano: " + summary.totalFetched() + ")";
            boolean hasErrors = false;
            List<String> errorReasons = new ArrayList<>();

            StringBuilder details = new StringBuilder();
            details.append("Profil: ").append(profile.getName()).append("\n")
                    .append("Pobrano ogłoszeń: ").append(summary.totalFetched())
                    .append(" | Zapisano (>0 pkt): ").append(summary.savedCount())
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
            List<String> emails = parseEmails(profile.getRecipientEmails());
            if (smtpId != null && !emails.isEmpty() && summary.fetchRunId() != null) {
                details.append("\n--- Wysyłka e-mail (SMTP) ---\n");
                try {
                    EmailDispatchResult mailRes = sendRunsToEmails(
                            List.of(summary.fetchRunId()), emails, "Raport Cron [" + profile.getName() + "] - Przetargi", smtpId);
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
            lastIntervalTriggerByProfile.put(profile.getId(), nowPl);

            if (createNotification && !Boolean.FALSE.equals(profile.getNotificationsEnabled())) {
                AutomationNotification notif = new AutomationNotification();
                notif.setProfileId(profile.getId());
                notif.setProfileName(profile.getName());
                notif.setSuccess(!hasErrors);
                notif.setTitle(hasErrors ? "Błąd automatyzacji: " + profile.getName() : "Automatyzacja zakończona: " + profile.getName());
                notif.setSummary(hasErrors
                        ? "Wystąpiły błędy (" + errorReasons.size() + "). " + errorReasons.get(0)
                        : "Pobrano: " + summary.totalFetched() + ", zapisano: " + summary.savedCount() + " przetargów.");
                notif.setDetails(details.toString().trim());
                notif.setIsRead(false);
                notif.setCreatedAt(nowPl);
                notificationRepository.save(notif);
            }

            return summary;
        } catch (Exception e) {
            String errMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            profile.setLastRunAt(nowPl);
            profile.setLastRunStatus("Błąd: " + errMsg);
            profileRepository.save(profile);

            if (createNotification && !Boolean.FALSE.equals(profile.getNotificationsEnabled())) {
                AutomationNotification notif = new AutomationNotification();
                notif.setProfileId(profile.getId());
                notif.setProfileName(profile.getName());
                notif.setSuccess(false);
                notif.setTitle("Niepowodzenie automatyzacji: " + profile.getName());
                notif.setSummary("Przyczyna: " + errMsg);
                notif.setDetails("Profil: " + profile.getName() + "\nTyp błędu: " + e.getClass().getSimpleName() + "\nSzczegóły: " + errMsg);
                notif.setIsRead(false);
                notif.setCreatedAt(nowPl);
                notificationRepository.save(notif);
            }
            throw e;
        }
    }

    /**
     * Sprawdza wyłącznie aktualizacje dla obserwowanych (INTERESTED) przetargów ze wszystkich aktywnych źródeł.
     * Nie dodaje nowych przetargów do głównej listy i nie tworzy wpisu w historii Raportów.
     */
    public ObservedCheckSummary checkUpdatesForObservedTenders() {
        List<Tender> observedTenders = tenderRepository.findByStatusOrderByIdAsc(TenderStatus.INTERESTED);
        if (observedTenders.isEmpty()) {
            return new ObservedCheckSummary(0, 0, 0, List.of());
        }

        List<ApiEndpoint> activeEndpoints = endpointRepository.findByIsActiveTrue();
        if (activeEndpoints.isEmpty()) {
            return new ObservedCheckSummary(0, observedTenders.size(), 0, List.of());
        }

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JsonParser jsonParser = JsonParserFactory.getJsonParser();
        OffsetDateTime nowPl = OffsetDateTime.now(POLAND_ZONE);

        int totalUpdatesFound = 0;
        List<SourceLog> logs = new ArrayList<>();

        for (ApiEndpoint ep : activeEndpoints) {
            try {
                List<RawItem> rawItems = "SCRAPER".equalsIgnoreCase(ep.getHttpMethod())
                        ? callPythonScraper(client, jsonParser, ep)
                        : callStandardHttpApiWithPagination(client, jsonParser, ep);

                int epUpdates = 0;
                for (RawItem item : rawItems) {
                    String title = (item.title() != null && !item.title().isBlank()) ? item.title().trim() : "Ogloszenie przetargowe";
                    String description = item.description() != null ? item.description().trim() : "";
                    String externalId = normalizeExternalId(item.externalId(), title, ep.getId());
                    String groupKey = normalizeGroupKey(item.groupKey(), title);
                    OffsetDateTime deadline = item.submissionDeadline() != null
                            ? item.submissionDeadline() : extractDeadlineFromText(description);

                    Optional<Tender> matchedOpt = findMatchingObservedTender(observedTenders, externalId, groupKey, title);
                    if (matchedOpt.isEmpty()) continue;

                    if (recordObservedUpdateIfChanged(matchedOpt.get(), externalId, title, description, deadline, groupKey, nowPl)) {
                        epUpdates++;
                        totalUpdatesFound++;
                    }
                }

                ep.setLastSyncAt(nowPl);
                endpointRepository.save(ep);
                logs.add(new SourceLog(ep.getName(), true, epUpdates,
                        epUpdates > 0
                                ? "Wykryto " + epUpdates + " aktualizacji dla obserwowanych przetargów."
                                : "Brak nowych zmian wśród " + rawItems.size() + " sprawdzonych ogłoszeń."));
            } catch (Exception e) {
                logs.add(new SourceLog(ep.getName(), false, 0, "Błąd: " + e.getMessage()));
            }
        }

        return new ObservedCheckSummary(activeEndpoints.size(), observedTenders.size(), totalUpdatesFound, logs);
    }

    public ExecutionSummary executeSearch(List<Long> endpointIds, List<Long> categoryIds, String matchMode, String sourceType) {
        return executeSearch(endpointIds, categoryIds, matchMode, null, sourceType);
    }

    public FetchRun createReportFromObserved(List<Long> tenderIds, List<Long> updateIds, String reportName) {
        List<Tender> selectedTenders = (tenderIds != null && !tenderIds.isEmpty())
                ? tenderRepository.findAllById(tenderIds)
                : List.of();
        List<TenderUpdate> selectedUpdates = (updateIds != null && !updateIds.isEmpty())
                ? tenderUpdateRepository.findAllById(updateIds)
                : List.of();

        int totalItems = selectedTenders.size() + selectedUpdates.size();
        if (totalItems == 0) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jeden przetarg lub aktualizację.");
        }

        Set<String> sources = new LinkedHashSet<>();
        for (Tender t : selectedTenders) {
            String s = extractSourceLabel(t.getDescription());
            if (s != null) sources.add(s);
        }
        for (TenderUpdate u : selectedUpdates) {
            String s = extractSourceLabel(u.getDescription());
            if (s != null) sources.add(s);
        }

        String label = (reportName != null && !reportName.isBlank())
                ? "OBSERWOWANE [" + truncateString(reportName.trim(), 120) + "]"
                : "OBSERWOWANE";

        StringBuilder summary = new StringBuilder();
        summary.append("Wybrane z Obserwowanych (oryginały: ")
                .append(selectedTenders.size())
                .append(", aktualizacje: ")
                .append(selectedUpdates.size())
                .append(")");
        if (!sources.isEmpty()) {
            summary.append(" — ").append(String.join(", ", sources));
        }

        FetchRun run = new FetchRun();
        run.setSourceType(label);
        run.setSourcesSummary(summary.toString());
        run.setTotalFetched(totalItems);
        run.setSavedCount(totalItems);
        run.setExcludedCount(0);
        run.setZeroScoreCount(0);
        run.setCreatedAt(OffsetDateTime.now(POLAND_ZONE));
        run.setTenders(new ArrayList<>(selectedTenders));
        run.setTenderUpdates(new LinkedHashSet<>(selectedUpdates));

        return fetchRunRepository.save(run);
    }

    public OffsetDateTime extractDeadlineFromDescription(String desc) {
        if (desc == null || desc.isBlank()) return null;
        for (String line : desc.split("\n")) {
            int idx = line.indexOf(':');
            if (idx > 0) {
                String keyNorm = line.substring(0, idx).toLowerCase().replaceAll("[_\\-\\s]", "");
                if (keyNorm.contains("publication") || keyNorm.contains("publish")
                        || keyNorm.contains("created") || keyNorm.contains("updated")
                        || keyNorm.contains("modified") || keyNorm.contains("start")) {
                    continue;
                }
                if (keyNorm.contains("deadline") || keyNorm.contains("submitting")
                        || keyNorm.contains("submission") || keyNorm.contains("closing")
                        || keyNorm.contains("expir") || keyNorm.contains("validuntil")
                        || keyNorm.contains("enddate") || keyNorm.contains("duedate")
                        || keyNorm.contains("termin")) {
                    OffsetDateTime parsed = parseFlexibleDateTime(line.substring(idx + 1).trim());
                    if (parsed != null) return parsed;
                }
            }
        }
        return extractDeadlineFromText(desc);
    }

    private String extractSourceLabel(String desc) {
        if (desc == null || desc.isBlank()) return null;
        for (String line : desc.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith("źródło:") || trimmed.toLowerCase().startsWith("zrodlo:")) {
                String val = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                if (!val.isEmpty()) return val;
            }
        }
        return null;
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String sourceType
    ) {
        String fallbackMode = (matchMode != null && !matchMode.isBlank()) ? matchMode : "OR";
        List<ApiEndpoint> selectedEndpoints = endpointRepository.findAllById(endpointIds != null ? endpointIds : List.of());
        List<KeywordCategory> selectedCategories = keywordCategoryRepository.findAllById(categoryIds != null ? categoryIds : List.of());
        List<Tender> observedTenders = tenderRepository.findByStatusOrderByIdAsc(TenderStatus.INTERESTED);

        int totalFetched = 0;
        int savedCount = 0;
        int excludedCount = 0;
        int zeroScoreSkippedCount = 0;
        List<SourceLog> logs = new ArrayList<>();
        Map<Long, Tender> savedTendersInRun = new LinkedHashMap<>();
        List<String> sourceNames = new ArrayList<>();

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JsonParser jsonParser = JsonParserFactory.getJsonParser();
        OffsetDateTime nowPl = OffsetDateTime.now(POLAND_ZONE);

        for (ApiEndpoint ep : selectedEndpoints) {
            sourceNames.add(ep.getName());
            try {
                List<RawItem> rawItems = "SCRAPER".equalsIgnoreCase(ep.getHttpMethod())
                        ? callPythonScraper(client, jsonParser, ep)
                        : callStandardHttpApiWithPagination(client, jsonParser, ep);

                int epSaved = 0;
                int epObservedUpdates = 0;

                for (RawItem item : rawItems) {
                    totalFetched++;
                    String title = (item.title() != null && !item.title().isBlank()) ? item.title().trim() : "Ogloszenie przetargowe";
                    String description = item.description() != null ? item.description().trim() : "";
                    String externalId = normalizeExternalId(item.externalId(), title, ep.getId());
                    String groupKey = normalizeGroupKey(item.groupKey(), title);
                    OffsetDateTime submissionDeadline = item.submissionDeadline() != null
                            ? item.submissionDeadline() : extractDeadlineFromText(description);

                    // Wykryj aktualizację dla już obserwowanego (INTERESTED) przetargu (niezależnie od punktacji)
                    Optional<Tender> matchedObserved = findMatchingObservedTender(observedTenders, externalId, groupKey, title);
                    if (matchedObserved.isPresent()) {
                        if (recordObservedUpdateIfChanged(matchedObserved.get(), externalId, title, description, submissionDeadline, groupKey, nowPl)) {
                            epObservedUpdates++;
                        }
                    }

                    String combinedText = (title + " " + description).toLowerCase();
                    if (containsAnyExcludedWord(combinedText, selectedCategories)) {
                        excludedCount++;
                        continue;
                    }

                    int totalScore = 0;
                    List<String> categoryBreakdowns = new ArrayList<>();
                    for (KeywordCategory cat : selectedCategories) {
                        String catMode = (categoryMatchModes != null && categoryMatchModes.containsKey(cat.getId()))
                                ? categoryMatchModes.get(cat.getId()) : fallbackMode;
                        boolean requireAllWords = "ALL".equalsIgnoreCase(catMode) || "AND".equalsIgnoreCase(catMode);
                        int catScore = calculateCategoryScore(combinedText, cat, requireAllWords);
                        if (catScore > 0) {
                            totalScore += catScore;
                            categoryBreakdowns.add(cat.getName() + ": " + catScore);
                        }
                    }

                    if (totalScore <= 0 || categoryBreakdowns.isEmpty()) {
                        zeroScoreSkippedCount++;
                        continue;
                    }

                    // Nie nadpisujemy pierwotnej treści obserwowanego przetargu — aktualizacje trafiają do tender_updates
                    if (matchedObserved.isPresent()) {
                        Tender obs = matchedObserved.get();
                        if (savedTendersInRun.put(obs.getId(), obs) == null) {
                            savedCount++;
                            epSaved++;
                        }
                        continue;
                    }

                    String breakdownLine = "Punktacja kategorii: " + String.join(" / ", categoryBreakdowns);
                    String finalDesc = !description.isBlank() ? breakdownLine + "\n" + description : breakdownLine;

                    Tender tender = tenderRepository.findByExternalId(externalId).orElseGet(() -> {
                        Tender t = new Tender();
                        t.setExternalId(externalId);
                        t.setStatus(TenderStatus.NEW);
                        t.setHasUnreadUpdate(false);
                        t.setPublicationDate(nowPl);
                        return t;
                    });

                    if (tender.getId() != null && tender.getStatus() == TenderStatus.INTERESTED) {
                        if (recordObservedUpdateIfChanged(tender, externalId, title, description, submissionDeadline, groupKey, nowPl)) {
                            epObservedUpdates++;
                        }
                        if (savedTendersInRun.put(tender.getId(), tender) == null) {
                            savedCount++;
                            epSaved++;
                        }
                        continue;
                    }

                    tender.setTitle(title);
                    tender.setDescription(finalDesc);
                    tender.setScore(totalScore);
                    if (submissionDeadline != null) tender.setSubmissionDeadline(submissionDeadline);
                    if (groupKey != null) tender.setGroupKey(groupKey);
                    if (tender.getHasUnreadUpdate() == null) tender.setHasUnreadUpdate(false);

                    Tender savedTender = tenderRepository.save(tender);
                    if (savedTendersInRun.put(savedTender.getId(), savedTender) == null) {
                        savedCount++;
                        epSaved++;
                    }
                }

                ep.setLastSyncAt(OffsetDateTime.now(POLAND_ZONE));
                endpointRepository.save(ep);
                String msg = "Zapisano " + epSaved + " przetargow (>0 pkt) z " + rawItems.size() + " pobranych.";
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
        run.setCreatedAt(OffsetDateTime.now(POLAND_ZONE));
        run.setTenders(new ArrayList<>(savedTendersInRun.values()));
        FetchRun savedRun = fetchRunRepository.save(run);

        return new ExecutionSummary(savedRun.getId(), totalFetched, savedCount, excludedCount, zeroScoreSkippedCount, logs);
    }

    private Optional<Tender> findMatchingObservedTender(
            List<Tender> observedTenders, String externalId, String groupKey, String title
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
        String normTitle = normalizeTitleForGrouping(title);
        if (normTitle.length() >= 18) {
            for (Tender t : observedTenders) {
                if (normTitle.equals(normalizeTitleForGrouping(t.getTitle()))) return Optional.of(t);
            }
        }
        return Optional.empty();
    }

    private boolean recordObservedUpdateIfChanged(
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
        boolean deadlineChanged = incomingDeadline != null && !sameInstant(baseDeadline, incomingDeadline);
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
                    && sameInstant(prev.getSubmissionDeadline(), incomingDeadline)
                    && normalizeDescriptionForDiff(prev.getDescription()).equals(incomingNormDesc)) {
                return false;
            }
        }

        List<String> changes = new ArrayList<>();
        if (deadlineChanged && incomingDeadline != null) {
            String oldStr = baseDeadline != null ? baseDeadline.atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT) : "brak";
            String newStr = incomingDeadline.atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT);
            changes.add("Zmiana terminu składania ofert: " + oldStr + " → " + newStr);
        }
        if (extIdChanged) changes.add("Nowe powiązane ogłoszenie (ID: " + incomingExtId + ")");
        if (titleChanged) changes.add("Zmiana tytułu postępowania");
        if (descChanged) changes.add("Zaktualizowano treść / parametry ogłoszenia");

        TenderUpdate update = new TenderUpdate();
        update.setTenderId(observed.getId());
        update.setVersionNumber(latest != null ? (latest.getVersionNumber() + 1) : 1);
        update.setExternalId(truncateString(incomingExtId, 150));
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

    private List<ParsedKeyword> parseCategoryKeywords(KeywordCategory cat) {
        List<ParsedKeyword> list = new ArrayList<>();
        if (cat.getKeywords() == null || cat.getKeywords().isBlank()) return list;
        boolean wholeCatExcluded = Boolean.TRUE.equals(cat.getIsExcluded());
        int fallbackScore = cat.getScore() != null ? cat.getScore() : 50;

        for (String part : cat.getKeywords().split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;

            boolean isWildcard = false;
            if (trimmed.toUpperCase().endsWith(":WILDCARD")) {
                isWildcard = true;
                trimmed = trimmed.substring(0, trimmed.length() - ":WILDCARD".length()).trim();
            }

            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                String word = trimmed.substring(0, colonIdx).trim().toLowerCase();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) continue;
                if ("EXCLUDED".equals(suffix) || wholeCatExcluded) {
                    list.add(new ParsedKeyword(word, 0, true, isWildcard));
                } else {
                    try {
                        list.add(new ParsedKeyword(word, Math.max(1, Math.min(100, Integer.parseInt(suffix))), false, isWildcard));
                    } catch (NumberFormatException e) {
                        list.add(new ParsedKeyword(word, fallbackScore, false, isWildcard));
                    }
                }
            } else {
                list.add(new ParsedKeyword(trimmed.toLowerCase(), fallbackScore, wholeCatExcluded, isWildcard));
            }
        }
        return list;
    }

    private boolean matchesKeyword(String text, ParsedKeyword pk) {
        if (text == null || text.isEmpty() || pk.word() == null || pk.word().isEmpty()) return false;
        if (pk.wildcard() && pk.word().endsWith("*")) {
            String stem = pk.word().substring(0, pk.word().length() - 1).trim();
            if (stem.isEmpty()) return false;
            String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(stem) + "[\\p{L}\\p{N}]*";
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text).find();
        }
        String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(pk.word()) + "(?![\\p{L}\\p{N}_])";
        return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text).find();
    }

    private boolean containsAnyExcludedWord(String text, List<KeywordCategory> categories) {
        for (KeywordCategory cat : categories) {
            for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
                if (pk.excluded() && matchesKeyword(text, pk)) return true;
            }
        }
        return false;
    }

    private int calculateCategoryScore(String text, KeywordCategory cat, boolean requireAllWords) {
        List<ParsedKeyword> positiveWords = new ArrayList<>();
        for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
            if (!pk.excluded()) positiveWords.add(pk);
        }
        if (positiveWords.isEmpty()) return 0;

        int sum = 0;
        int matchedCount = 0;
        for (ParsedKeyword pk : positiveWords) {
            if (matchesKeyword(text, pk)) {
                matchedCount++;
                sum += pk.weight();
            }
        }
        return (requireAllWords && matchedCount < positiveWords.size()) ? 0 : sum;
    }

    private String extractScoreBreakdown(Tender t) {
        if (t.getDescription() != null) {
            for (String line : t.getDescription().split("\n")) {
                if (line.startsWith("Punktacja kategorii:")) {
                    return line.substring("Punktacja kategorii:".length()).trim();
                }
            }
        }
        return (t.getScore() != null ? t.getScore() : 0) + " pkt";
    }

    public String testScraperConnection(ApiEndpoint ep) throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        JsonParser parser = JsonParserFactory.getJsonParser();
        List<RawItem> items = callPythonScraper(client, parser, ep);

        StringBuilder sb = new StringBuilder();
        sb.append("Web Scraper połączył się pomyślnie! Wykryto ").append(items.size())
                .append(" pozycji na stronie (bez zapisywania do bazy).");
        if (!items.isEmpty()) {
            sb.append("\n\n--- Przykładowe wyłapane pozycje (pierwsze ").append(Math.min(5, items.size())).append(") ---");
            for (int i = 0; i < Math.min(5, items.size()); i++) {
                sb.append("\n").append(i + 1).append(". ").append(items.get(i).title());
            }
        }
        return sb.toString();
    }

    private List<RawItem> callPythonScraper(HttpClient client, JsonParser parser, ApiEndpoint ep) throws Exception {
        String resolvedUrl = resolveDynamicTokens(ep.getUrl());
        String selector = ep.getPayload() != null ? ep.getPayload().trim() : "";
        String reqJson = "{\"url\":\"" + escapeJson(resolvedUrl) + "\",\"selector\":\"" + escapeJson(selector) + "\"}";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/scrape"))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(reqJson))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalArgumentException("Blad scrapera HTTP " + resp.statusCode() + ": " + resp.body());
        }

        Map<String, Object> root = parser.parseMap(resp.body());
        List<RawItem> result = new ArrayList<>();
        if (root.get("items") instanceof List<?> listObj) {
            for (Object o : listObj) {
                if (o instanceof Map<?, ?> m) {
                    String extId = firstNonNullString(m, "externalId", "id");
                    String title = firstNonNullString(m, "title", "name");
                    String desc = firstNonNullString(m, "description");
                    String decoratedDesc = "Źródło: " + ep.getName() + "\n" + (desc != null ? desc : "");
                    result.add(new RawItem(extId, title, decoratedDesc.trim(), extractDeadlineFromText(desc), normalizeGroupKey(null, title)));
                }
            }
        }
        return result;
    }

    private List<RawItem> callStandardHttpApiWithPagination(HttpClient client, JsonParser parser, ApiEndpoint ep) throws Exception {
        String resolvedUrl = resolveDynamicTokens(ep.getUrl());
        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(resolvedUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("User-Agent", "TenderSearchEngine/1.0");

        if ("POST".equalsIgnoreCase(ep.getHttpMethod())) {
            String rawPayload = (ep.getPayload() != null && !ep.getPayload().isBlank()) ? ep.getPayload() : "{}";
            String resolvedPayload = resolveDynamicTokens(rawPayload);
            reqBuilder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(resolvedPayload));
        } else {
            reqBuilder.GET();
        }

        HttpResponse<String> response = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("Błąd HTTP " + response.statusCode());
        }
        return extractItems(parser, response.body(), ep.getName(), ep.getLinkTemplate());
    }

    public ExcelExportResult generateExcelForRuns(List<Long> runIds) throws Exception {
        List<FetchRun> runs = fetchRunRepository.findAllById(runIds);
        String payloadJson = buildWorkerExcelPayload(runs, null, null, null);

        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/excel/export"))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalArgumentException("Blad generowania pliku Excel: " + resp.body());
        }

        Map<String, Object> map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        String defaultName = "raport_przetargi_" + LocalDateTime.now(POLAND_ZONE).format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm")) + ".xlsx";
        String filename = map.get("filename") != null ? String.valueOf(map.get("filename")) : defaultName;
        int count = map.get("count") instanceof Number n ? n.intValue() : 0;
        return new ExcelExportResult(filename, String.valueOf(map.get("base64")), count);
    }

    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject) throws Exception {
        return sendRunsToEmails(runIds, emails, subject, null);
    }

    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject, Long smtpAccountId) throws Exception {
        if (smtpAccountId == null) throw new IllegalArgumentException("Nie wybrano konta SMTP.");
        SmtpAccount smtpAccount = smtpAccountRepository.findById(smtpAccountId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono wybranego konta SMTP."));

        List<FetchRun> runs = fetchRunRepository.findAllById(runIds);
        String payloadJson = buildWorkerExcelPayload(runs, emails, subject, smtpAccount);

        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/excel/email"))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalArgumentException(map.get("detail") != null ? String.valueOf(map.get("detail")) : resp.body());
        }

        return new EmailDispatchResult(
                Boolean.TRUE.equals(map.get("sent")),
                String.valueOf(map.get("message")),
                map.get("base64") != null ? String.valueOf(map.get("base64")) : "",
                map.get("filename") != null ? String.valueOf(map.get("filename")) : "raport_przetargi.xlsx"
        );
    }

    private String buildWorkerExcelPayload(List<FetchRun> runs, List<String> emails, String subject, SmtpAccount smtpAcc) {
        Map<Long, Tender> uniqueTenders = new LinkedHashMap<>();
        Map<Long, String> runLabels = new LinkedHashMap<>();
        Map<Long, TenderUpdate> uniqueUpdates = new LinkedHashMap<>();
        Map<Long, String> updateRunLabels = new LinkedHashMap<>();

        for (FetchRun run : runs) {
            String label = "#" + run.getId() + " (" + run.getSourceType() + ")";
            if (run.getTenders() != null) {
                for (Tender t : run.getTenders()) {
                    uniqueTenders.put(t.getId(), t);
                    runLabels.put(t.getId(), label);
                }
            }
            if (run.getTenderUpdates() != null) {
                for (TenderUpdate u : run.getTenderUpdates()) {
                    uniqueUpdates.put(u.getId(), u);
                    updateRunLabels.put(u.getId(), label + " — Akt. v" + u.getVersionNumber());
                }
            }
        }

        StringBuilder sb = new StringBuilder("{\"tenders\":[");
        boolean first = true;

        for (Tender t : uniqueTenders.values()) {
            if (!first) sb.append(",");
            first = false;
            String desc = t.getDescription() != null ? t.getDescription() : "";
            if (t.getSubmissionDeadline() != null && !desc.toLowerCase().contains("termin składania ofert:")) {
                desc = "Termin składania ofert: "
                        + t.getSubmissionDeadline().atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT)
                        + (desc.isBlank() ? "" : "\n" + desc);
            }
            sb.append("{")
                    .append("\"externalId\":\"").append(escapeJson(t.getExternalId())).append("\",")
                    .append("\"title\":\"").append(escapeJson(t.getTitle())).append("\",")
                    .append("\"score\":").append(t.getScore() != null ? t.getScore() : 0).append(",")
                    .append("\"scoreBreakdown\":\"").append(escapeJson(extractScoreBreakdown(t))).append("\",")
                    .append("\"status\":\"").append(t.getStatus() != null ? t.getStatus().name() : "NEW").append("\",")
                    .append("\"publicationDate\":\"").append(t.getPublicationDate() != null ? t.getPublicationDate().toString() : "").append("\",")
                    .append("\"runInfo\":\"").append(escapeJson(runLabels.getOrDefault(t.getId(), ""))).append("\",")
                    .append("\"description\":\"").append(escapeJson(desc)).append("\"")
                    .append("}");
        }

        for (TenderUpdate u : uniqueUpdates.values()) {
            if (!first) sb.append(",");
            first = false;
            Tender parent = tenderRepository.findById(u.getTenderId()).orElse(null);
            String extId = (u.getExternalId() != null && !u.getExternalId().isBlank())
                    ? u.getExternalId()
                    : (parent != null ? parent.getExternalId() : "UPD-" + u.getId());
            int score = (parent != null && parent.getScore() != null) ? parent.getScore() : 0;
            String breakdown = parent != null ? extractScoreBreakdown(parent) : "0 pkt";

            StringBuilder updDesc = new StringBuilder();
            if (u.getChangeSummary() != null && !u.getChangeSummary().isBlank()) {
                updDesc.append("Zmiany: ").append(u.getChangeSummary()).append("\n");
            }
            if (u.getSubmissionDeadline() != null) {
                updDesc.append("Termin składania ofert: ")
                        .append(u.getSubmissionDeadline().atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT))
                        .append("\n");
            }
            if (u.getDescription() != null && !u.getDescription().isBlank()) {
                updDesc.append(u.getDescription());
            }

            sb.append("{")
                    .append("\"externalId\":\"").append(escapeJson(extId)).append("\",")
                    .append("\"title\":\"").append(escapeJson("[AKTUALIZACJA v" + u.getVersionNumber() + "] " + u.getTitle())).append("\",")
                    .append("\"score\":").append(score).append(",")
                    .append("\"scoreBreakdown\":\"").append(escapeJson(breakdown)).append("\",")
                    .append("\"status\":\"INTERESTED\",")
                    .append("\"publicationDate\":\"").append(u.getDetectedAt() != null ? u.getDetectedAt().toString() : "").append("\",")
                    .append("\"runInfo\":\"").append(escapeJson(updateRunLabels.getOrDefault(u.getId(), ""))).append("\",")
                    .append("\"description\":\"").append(escapeJson(updDesc.toString().trim())).append("\"")
                    .append("}");
        }

        sb.append("]");

        if (emails != null) {
            sb.append(",\"emails\":[");
            for (int i = 0; i < emails.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("\"").append(escapeJson(emails.get(i))).append("\"");
            }
            sb.append("],\"subject\":\"").append(escapeJson(subject != null ? subject : "Raport przetargow")).append("\"");

            if (smtpAcc != null) {
                sb.append(",\"smtp\":{")
                        .append("\"host\":\"").append(escapeJson(readStringProp(smtpAcc, "getSmtpHost", "getHost"))).append("\",")
                        .append("\"port\":").append(readIntProp(smtpAcc, "getSmtpPort", "getPort")).append(",")
                        .append("\"username\":\"").append(escapeJson(readStringProp(smtpAcc, "getSmtpUsername", "getUsername"))).append("\",")
                        .append("\"password\":\"").append(escapeJson(readStringProp(smtpAcc, "getSmtpPassword", "getPassword"))).append("\"")
                        .append("}");
            }
        }
        return sb.append("}").toString();
    }

    private String readStringProp(Object obj, String... methodNames) {
        for (String name : methodNames) {
            try {
                Method m = obj.getClass().getMethod(name);
                Object val = m.invoke(obj);
                if (val != null) return val.toString();
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    private Integer readIntProp(Object obj, String... methodNames) {
        for (String name : methodNames) {
            try {
                Method m = obj.getClass().getMethod(name);
                Object val = m.invoke(obj);
                if (val instanceof Number n) return n.intValue();
            } catch (Exception ignored) {
            }
        }
        return 587;
    }

    private record JsonRecord(Map<?, ?> fields) {}

    private List<RawItem> extractItems(JsonParser parser, String body, String sourceName, String linkTemplate) {
        if (body == null || body.isBlank()) return List.of();
        String trimmed = body.trim();
        List<RawItem> result = new ArrayList<>();

        if (trimmed.startsWith("[")) {
            for (Object obj : parser.parseList(trimmed)) {
                if (obj instanceof Map<?, ?> mapObj) result.add(toRawItem(mapObj, sourceName, linkTemplate));
            }
        } else if (trimmed.startsWith("{")) {
            var root = parser.parseMap(trimmed);
            List<JsonRecord> itemsList = findBestObjectList(root, 0);
            if (!itemsList.isEmpty()) {
                for (JsonRecord item : itemsList) result.add(toRawItem(item.fields(), sourceName, linkTemplate));
            } else if (!root.isEmpty()) {
                result.add(toRawItem(root, sourceName, linkTemplate));
            }
        }
        return result;
    }

    private List<JsonRecord> findBestObjectList(Map<?, ?> map, int depth) {
        if (map == null || depth > 4) return List.of();
        List<JsonRecord> bestList = List.of();
        for (Object value : map.values()) {
            if (value instanceof List<?> listObj && !listObj.isEmpty()) {
                List<JsonRecord> mapElements = new ArrayList<>();
                for (Object elem : listObj) {
                    if (elem instanceof Map<?, ?> m) mapElements.add(new JsonRecord(m));
                }
                if (mapElements.size() > bestList.size()) bestList = mapElements;
            } else if (value instanceof Map<?, ?> nestedMap) {
                List<JsonRecord> nestedResult = findBestObjectList(nestedMap, depth + 1);
                if (nestedResult.size() > bestList.size()) bestList = nestedResult;
            }
        }
        return bestList;
    }

    private RawItem toRawItem(Map<?, ?> rawMap, String sourceName, String linkTemplate) {
        Map<String, String> flatFields = new LinkedHashMap<>();
        flattenMap(rawMap, "", flatFields, 0);

        String extId = extractGenericId(flatFields);
        String title = extractGenericTitle(flatFields);
        String templateLink = applyLinkTemplate(linkTemplate, flatFields);
        String tenderLink = templateLink != null ? templateLink : extractGenericLink(flatFields);
        OffsetDateTime submissionDeadline = extractGenericDeadline(flatFields);
        String groupKey = extractGenericGroupKey(flatFields, title);

        StringBuilder details = new StringBuilder();
        details.append("Źródło: ").append(sourceName).append("\n");
        if (tenderLink != null) details.append("Link: ").append(tenderLink).append("\n");
        if (submissionDeadline != null) {
            details.append("Termin składania ofert: ")
                    .append(submissionDeadline.atZoneSameInstant(POLAND_ZONE).format(PL_DT_FMT)).append("\n");
        }

        int addedFields = 0;
        for (Map.Entry<String, String> entry : flatFields.entrySet()) {
            if (addedFields >= 30) break;
            String val = entry.getValue();
            if (val == null || val.isBlank() || val.equals(tenderLink)) continue;
            String cleanVal = stripHtml(val);
            if (cleanVal.isEmpty()) continue;
            if (cleanVal.length() > 500) cleanVal = cleanVal.substring(0, 500) + "...";
            details.append(entry.getKey()).append(": ").append(cleanVal).append("\n");
            addedFields++;
        }

        String descStr = details.toString().trim();
        if (submissionDeadline == null) submissionDeadline = extractDeadlineFromText(descStr);
        return new RawItem(extId, title, descStr, submissionDeadline, groupKey);
    }

    /**
     * Podmienia dynamiczne zmienne daty w URL i payloadzie (strefa Europe/Warsaw):
     * {TODAY}, {YESTERDAY}, {TOMORROW}, {TODAY-7D}, {TODAY+3D},
     * {TODAY_COMPACT}, {TODAY-7D_COMPACT}, {TODAY_START}, {TODAY_END}, {TODAY-1D_START}, {NOW_ISO}
     */
    public String resolveDynamicTokens(String raw) {
        if (raw == null || raw.isBlank() || !raw.contains("{")) {
            return raw;
        }
        ZonedDateTime nowPl = ZonedDateTime.now(POLAND_ZONE);
        Matcher matcher = DYNAMIC_DATE_TOKEN_PATTERN.matcher(raw);
        StringBuilder sb = new StringBuilder();

        while (matcher.find()) {
            String base = matcher.group(1).toUpperCase();
            String sign = matcher.group(2);
            String daysStr = matcher.group(3);
            String format = matcher.group(4) != null ? matcher.group(4).toUpperCase() : "";

            LocalDate date = nowPl.toLocalDate();
            if ("YESTERDAY".equals(base)) {
                date = date.minusDays(1);
            } else if ("TOMORROW".equals(base)) {
                date = date.plusDays(1);
            }
            if (sign != null && daysStr != null) {
                long offset = Long.parseLong(daysStr);
                date = "-".equals(sign) ? date.minusDays(offset) : date.plusDays(offset);
            }

            String replacement;
            if ("NOW".equals(base) || "ISO".equals(format)) {
                replacement = nowPl.toLocalDateTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"));
            } else if ("COMPACT".equals(format)) {
                replacement = date.format(DateTimeFormatter.BASIC_ISO_DATE);
            } else if ("START".equals(format)) {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE) + "T00:00:00";
            } else if ("END".equals(format)) {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE) + "T23:59:59";
            } else {
                replacement = date.format(DateTimeFormatter.ISO_LOCAL_DATE);
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    /**
     * Buduje klikalny link z konfigurowalnego szablonu endpointu, np.
     * https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/{objectId}
     */
    private String applyLinkTemplate(String template, Map<String, String> flatFields) {
        if (template == null || template.isBlank() || flatFields == null || flatFields.isEmpty()) {
            return null;
        }
        Matcher matcher = LINK_PLACEHOLDER_PATTERN.matcher(template.trim());
        StringBuilder sb = new StringBuilder();
        boolean foundAnyPlaceholder = false;

        while (matcher.find()) {
            foundAnyPlaceholder = true;
            String fieldName = matcher.group(1).trim();
            String value = resolveFieldFromFlatMap(flatFields, fieldName);
            if (value == null || value.isBlank()) {
                return null;
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(value.trim()));
        }
        matcher.appendTail(sb);

        if (!foundAnyPlaceholder) {
            return isUrl(template.trim()) ? template.trim() : null;
        }
        String resolved = sb.toString().trim();
        return isUrl(resolved) ? resolved : null;
    }

    private String resolveFieldFromFlatMap(Map<String, String> flatFields, String fieldName) {
        if (fieldName == null || fieldName.isBlank()) return null;
        String targetLower = fieldName.toLowerCase();
        String targetCompact = targetLower.replace("_", "").replace("-", "");

        // 1. Dokładne dopasowanie pełnej ścieżki (np. "objectId" lub "attributes.slug")
        for (Map.Entry<String, String> e : flatFields.entrySet()) {
            if (e.getKey().equalsIgnoreCase(fieldName) && e.getValue() != null && !e.getValue().isBlank()) {
                return e.getValue();
            }
        }
        // 2. Dopasowanie po nazwie liścia (np. "publication-number", "id", "tenderId")
        for (Map.Entry<String, String> e : flatFields.entrySet()) {
            String leaf = extractLeafKey(e.getKey());
            if ((leaf.equals(targetLower) || leaf.replace("_", "").replace("-", "").equals(targetCompact))
                    && e.getValue() != null && !e.getValue().isBlank()) {
                return e.getValue();
            }
        }
        return null;
    }

    private void flattenMap(Map<?, ?> map, String prefix, Map<String, String> out, int depth) {
        if (map == null || depth > 4 || out.size() >= 60) return;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (out.size() >= 60) return;
            Object val = entry.getValue();
            if (val == null) continue;
            String key = String.valueOf(entry.getKey()).trim();
            String path = prefix.isEmpty() ? key : prefix + "." + key;

            if (val instanceof Map<?, ?> nestedMap) {
                flattenMap(nestedMap, path, out, depth + 1);
            } else if (val instanceof List<?> listObj) {
                List<String> primitives = new ArrayList<>();
                int nestedMapIdx = 0;
                for (Object elem : listObj) {
                    if (elem == null) continue;
                    if (elem instanceof Map<?, ?> elemMap) {
                        if (nestedMapIdx < 3) {
                            flattenMap(elemMap, path + "[" + nestedMapIdx + "]", out, depth + 1);
                            nestedMapIdx++;
                        }
                    } else {
                        String s = String.valueOf(elem).trim();
                        if (!s.isEmpty() && primitives.size() < 10) primitives.add(s);
                    }
                }
                if (!primitives.isEmpty()) out.put(path, String.join(", ", primitives));
            } else {
                String str = String.valueOf(val).trim();
                if (!str.isEmpty() && !"null".equalsIgnoreCase(str)) out.put(path, str);
            }
        }
    }

    private String extractGenericId(Map<String, String> flat) {
        List<String> exactKeys = List.of("id", "externalid", "uuid", "guid", "number", "identifier", "code", "ref");
        for (String target : exactKeys) {
            for (Map.Entry<String, String> e : flat.entrySet()) {
                if (isTopLevelKey(e.getKey()) && extractLeafKey(e.getKey()).equals(target) && isValidIdCandidate(e.getValue())) {
                    return e.getValue().trim();
                }
            }
        }
        for (Map.Entry<String, String> e : flat.entrySet()) {
            String leaf = extractLeafKey(e.getKey());
            if (isTopLevelKey(e.getKey()) && (leaf.endsWith("id") || leaf.endsWith("number")) && isValidIdCandidate(e.getValue())) {
                return e.getValue().trim();
            }
        }
        for (String target : List.of("id", "externalid", "uuid", "guid", "identifier")) {
            for (Map.Entry<String, String> e : flat.entrySet()) {
                if (extractLeafKey(e.getKey()).equals(target) && isValidIdCandidate(e.getValue())) {
                    return e.getValue().trim();
                }
            }
        }
        return null;
    }

    private String extractGenericGroupKey(Map<String, String> flat, String title) {
        List<String> groupKeys = List.of(
                "tenderid", "ocid", "procedureid", "groupid", "parentid",
                "referencenumber", "reference", "caseid", "casenumber", "auctionid", "projectid", "lotid"
        );
        for (String target : groupKeys) {
            for (Map.Entry<String, String> e : flat.entrySet()) {
                String leaf = extractLeafKey(e.getKey()).replace("_", "").replace("-", "");
                if (leaf.equals(target) && isValidIdCandidate(e.getValue())) {
                    return truncateString("GRP:" + e.getValue().trim().toLowerCase(), 250);
                }
            }
        }
        return normalizeGroupKey(null, title);
    }

    private OffsetDateTime extractGenericDeadline(Map<String, String> flat) {
        for (Map.Entry<String, String> e : flat.entrySet()) {
            String keyNorm = e.getKey().toLowerCase().replace("_", "").replace("-", "");
            if (keyNorm.contains("publication") || keyNorm.contains("publish")
                    || keyNorm.contains("created") || keyNorm.contains("updated")
                    || keyNorm.contains("modified") || keyNorm.contains("start")) {
                continue;
            }
            if (keyNorm.contains("deadline") || keyNorm.contains("submitting")
                    || keyNorm.contains("submission") || keyNorm.contains("closing")
                    || keyNorm.contains("expir") || keyNorm.contains("validuntil")
                    || keyNorm.contains("enddate") || keyNorm.contains("duedate")
                    || keyNorm.contains("termin")) {
                OffsetDateTime parsed = parseFlexibleDateTime(e.getValue());
                if (parsed != null) return parsed;
            }
        }
        return null;
    }

    private OffsetDateTime extractDeadlineFromText(String text) {
        if (text == null || text.isBlank()) return null;
        Matcher m = DEADLINE_HINT_PATTERN.matcher(text);
        return m.find() ? parseFlexibleDateTime(m.group(1)) : null;
    }

    public OffsetDateTime parseFlexibleDateTime(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String candidate = raw.trim().replaceAll("(?i)godz\\.?\\s*", "").replace(",", " ").replaceAll("\\s+", " ");
        Matcher m = DATE_EXTRACT_PATTERN.matcher(candidate);
        if (m.find()) {
            candidate = m.group(1).trim().replaceAll("(?i)godz\\.?\\s*", "").replace(",", " ").replaceAll("\\s+", " ");
        }
        try { return OffsetDateTime.parse(candidate); } catch (Exception ignored) {}
        try { return ZonedDateTime.parse(candidate).toOffsetDateTime(); } catch (Exception ignored) {}
        try { return LocalDateTime.parse(candidate).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        for (DateTimeFormatter fmt : LOCAL_DT_FORMATS) {
            try { return LocalDateTime.parse(candidate, fmt).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        }
        for (DateTimeFormatter fmt : LOCAL_DATE_FORMATS) {
            try { return LocalDate.parse(candidate, fmt).atTime(23, 59).atZone(POLAND_ZONE).toOffsetDateTime(); } catch (Exception ignored) {}
        }
        return null;
    }

    private String extractGenericTitle(Map<String, String> flat) {
        for (String target : List.of("title", "subject", "headline", "summary")) {
            for (Map.Entry<String, String> e : flat.entrySet()) {
                if (extractLeafKey(e.getKey()).equals(target)) {
                    String cleaned = stripHtml(e.getValue());
                    if (!cleaned.isEmpty() && !isUrl(cleaned)) return truncateTitle(cleaned);
                }
            }
        }
        for (Map.Entry<String, String> e : flat.entrySet()) {
            String fullLower = e.getKey().toLowerCase();
            String leaf = extractLeafKey(e.getKey());
            if (leaf.endsWith("id") || leaf.endsWith("url") || leaf.endsWith("link") || leaf.endsWith("code")) continue;
            if (fullLower.contains("title") || fullLower.contains("subject")
                    || fullLower.contains("headline") || fullLower.contains("object")) {
                String cleaned = stripHtml(e.getValue());
                if (cleaned.length() >= 3 && !isUrl(cleaned)) return truncateTitle(cleaned);
            }
        }
        for (Map.Entry<String, String> e : flat.entrySet()) {
            if (extractLeafKey(e.getKey()).equals("name") && !e.getKey().contains("[")) {
                String cleaned = stripHtml(e.getValue());
                if (cleaned.length() >= 3 && !isUrl(cleaned)) return truncateTitle(cleaned);
            }
        }
        String bestText = null;
        for (String rawVal : flat.values()) {
            String cleaned = stripHtml(rawVal);
            if (cleaned.length() < 8 || isUrl(cleaned)
                    || "true".equalsIgnoreCase(cleaned) || "false".equalsIgnoreCase(cleaned)) continue;
            if (bestText == null || cleaned.length() > bestText.length()) bestText = cleaned;
        }
        return bestText != null ? truncateTitle(bestText) : null;
    }

    private String extractGenericLink(Map<String, String> flat) {
        for (Map.Entry<String, String> e : flat.entrySet()) {
            String keyLower = e.getKey().toLowerCase();
            String val = e.getValue().trim();
            if (isUrl(val) && (keyLower.contains("url") || keyLower.contains("link")
                    || keyLower.contains("href") || keyLower.contains("web")
                    || keyLower.contains("html") || keyLower.contains("self"))) {
                return val;
            }
        }
        for (String val : flat.values()) {
            if (isUrl(val.trim())) return val.trim();
        }
        return null;
    }

    private boolean isTopLevelKey(String path) { return path != null && !path.contains(".") && !path.contains("["); }

    private String extractLeafKey(String path) {
        if (path == null) return "";
        int dot = path.lastIndexOf('.');
        String leaf = dot >= 0 ? path.substring(dot + 1) : path;
        int bracket = leaf.indexOf('[');
        if (bracket >= 0) leaf = leaf.substring(0, bracket);
        return leaf.trim().toLowerCase();
    }

    private boolean isValidIdCandidate(String val) {
        return val != null && !val.trim().isEmpty() && val.trim().length() <= 100 && !isUrl(val);
    }

    private boolean isUrl(String val) {
        if (val == null) return false;
        String lower = val.trim().toLowerCase();
        return (lower.startsWith("http://") || lower.startsWith("https://")) && !lower.contains(" ");
    }

    private String stripHtml(String raw) {
        return raw == null ? "" : raw.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }

    private String truncateTitle(String text) { return text.length() > 260 ? text.substring(0, 260) + "..." : text; }

    private String truncateString(String text, int maxLen) {
        return (text == null || text.length() <= maxLen) ? text : text.substring(0, maxLen);
    }

    private String normalizeExternalId(String rawExtId, String title, Long endpointId) {
        if (rawExtId != null && !rawExtId.isBlank()) return truncateString(rawExtId.trim(), 100);
        return "GEN-" + Math.abs(((title != null ? title : "") + endpointId).hashCode());
    }

    private String normalizeGroupKey(String explicitGroupKey, String title) {
        if (explicitGroupKey != null && !explicitGroupKey.isBlank()) return truncateString(explicitGroupKey.trim(), 250);
        String normTitle = normalizeTitleForGrouping(title);
        return normTitle.length() >= 18 ? truncateString("TTL:" + normTitle, 250) : null;
    }

    private String normalizeTitleForGrouping(String title) {
        return title == null ? "" : title.toLowerCase().replaceAll("[^\\p{L}\\p{N}]+", " ").replaceAll("\\s+", " ").trim();
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

    private boolean sameInstant(OffsetDateTime a, OffsetDateTime b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.toInstant().equals(b.toInstant());
    }

    private String firstNonNullString(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null && !val.toString().isBlank()) return val.toString();
        }
        return null;
    }

    private List<Long> parseIds(String raw) {
        List<Long> res = new ArrayList<>();
        if (raw == null || raw.isBlank()) return res;
        for (String part : raw.split(",")) {
            try { res.add(Long.parseLong(part.split(":")[0].trim())); } catch (NumberFormatException ignored) {}
        }
        return res;
    }

    private Map<Long, String> parseCategoryIdsWithModes(String raw, String fallbackMode) {
        Map<Long, String> map = new LinkedHashMap<>();
        String def = (fallbackMode != null && !fallbackMode.isBlank()) ? fallbackMode : "OR";
        if (raw == null || raw.isBlank()) return map;
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            String[] pieces = trimmed.split(":");
            try {
                Long id = Long.parseLong(pieces[0].trim());
                String mode = (pieces.length > 1 && !pieces[1].isBlank()) ? pieces[1].trim().toUpperCase() : def;
                map.put(id, mode);
            } catch (NumberFormatException ignored) {
            }
        }
        return map;
    }

    public List<String> parseEmails(String raw) {
        List<String> res = new ArrayList<>();
        if (raw == null || raw.isBlank()) return res;
        for (String part : raw.split("[,;]")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty() && trimmed.contains("@")) res.add(trimmed);
        }
        return res;
    }

    private String escapeJson(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "").replace("\n", "\\n");
    }

    public record ParsedKeyword(String word, int weight, boolean excluded, boolean wildcard) {}
    public record RawItem(String externalId, String title, String description, OffsetDateTime submissionDeadline, String groupKey) {}
    public record SourceLog(String sourceName, boolean success, int savedCount, String message) {}
    public record ExecutionSummary(Long fetchRunId, int totalFetched, int savedCount, int excludedCount, int zeroScoreSkippedCount, List<SourceLog> logs) {}
    public record ObservedCheckSummary(int checkedEndpoints, int observedTendersCount, int updatesFound, List<SourceLog> logs) {}
    public record ExcelExportResult(String filename, String base64, int count) {}
    public record EmailDispatchResult(boolean sent, String message, String base64, String filename) {}
}