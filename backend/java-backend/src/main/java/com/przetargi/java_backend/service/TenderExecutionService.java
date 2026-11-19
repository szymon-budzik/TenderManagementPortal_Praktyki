package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.CronConfig;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.CronConfigRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import com.przetargi.java_backend.repository.TenderRepository;
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
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import java.util.regex.Pattern;

@Service
@EnableScheduling
public class TenderExecutionService {

    private static final ZoneId POLAND_ZONE = ZoneId.of("Europe/Warsaw");

    private final ApiEndpointRepository endpointRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final TenderRepository tenderRepository;
    private final FetchRunRepository fetchRunRepository;
    private final CronConfigRepository cronConfigRepository;
    private final AutomationProfileRepository profileRepository;
    private final SmtpAccountRepository smtpAccountRepository;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    private final Map<Long, String> lastTriggeredMinuteByProfile = new ConcurrentHashMap<>();
    private final Map<Long, OffsetDateTime> lastIntervalTriggerByProfile = new ConcurrentHashMap<>();

    public TenderExecutionService(
            ApiEndpointRepository endpointRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            TenderRepository tenderRepository,
            FetchRunRepository fetchRunRepository,
            CronConfigRepository cronConfigRepository,
            AutomationProfileRepository profileRepository,
            SmtpAccountRepository smtpAccountRepository
    ) {
        this.endpointRepository = endpointRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.tenderRepository = tenderRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.cronConfigRepository = cronConfigRepository;
        this.profileRepository = profileRepository;
        this.smtpAccountRepository = smtpAccountRepository;
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
        int todayDow = nowPl.getDayOfWeek().getValue(); // 1=Pon ... 7=Nd
        OffsetDateTime nowOffset = nowPl.toOffsetDateTime();

        List<AutomationProfile> profiles = profileRepository.findAll();

        for (AutomationProfile profile : profiles) {
            if (!Boolean.TRUE.equals(profile.getEnabled())) {
                continue;
            }

            String scheduleType = profile.getScheduleType() != null
                    ? profile.getScheduleType().trim().toUpperCase()
                    : "SCHEDULE";

            if ("INTERVAL".equals(scheduleType)) {
                int intervalMin = (profile.getIntervalMinutes() != null && profile.getIntervalMinutes() > 0)
                        ? profile.getIntervalMinutes()
                        : 60;
                OffsetDateTime lastRun = lastIntervalTriggerByProfile.getOrDefault(
                        profile.getId(),
                        profile.getLastRunAt()
                );

                if (lastRun == null || Duration.between(lastRun, nowOffset).toMinutes() >= intervalMin) {
                    lastIntervalTriggerByProfile.put(profile.getId(), nowOffset);
                    executeProfileNow(profile.getId());
                }
            } else {
                String lastMinute = lastTriggeredMinuteByProfile.getOrDefault(profile.getId(), "");
                if (!minuteKey.equals(lastMinute)
                        && matchesScheduleExpression(profile.getCronTime(), nowHm, todayDow)) {
                    lastTriggeredMinuteByProfile.put(profile.getId(), minuteKey);
                    executeProfileNow(profile.getId());
                }
            }
        }
    }

    /**
     * Obsługuje reguły rozdzielane przecinkiem:
     * - "8:00, 16:00"      -> codziennie o 08:00 i 16:00
     * - "8:00/1"           -> w poniedziałki o 08:00
     * - "16:00/2;5"        -> we wtorki i piątki o 16:00
     */
    private boolean matchesScheduleExpression(String rawExpr, String nowHm, int todayDow) {
        if (rawExpr == null || rawExpr.isBlank()) {
            return false;
        }
        for (String token : rawExpr.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            String[] parts = trimmed.split("/");
            String normalizedTime = normalizeHm(parts[0].trim());
            if (!nowHm.equals(normalizedTime)) {
                continue;
            }
            if (parts.length == 1 || parts[1].isBlank()) {
                return true;
            }
            String[] days = parts[1].trim().split(";");
            for (String d : days) {
                try {
                    if (Integer.parseInt(d.trim()) == todayDow) {
                        return true;
                    }
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
            int h = Integer.parseInt(hm[0].trim());
            int m = Integer.parseInt(hm[1].trim());
            return String.format("%02d:%02d", h, m);
        } catch (NumberFormatException e) {
            return rawTime;
        }
    }

    public ExecutionSummary executeProfileNow(Long profileId) {
        AutomationProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + profileId));

        List<Long> epIds = parseIds(profile.getEndpointIds());
        Map<Long, String> catModes = parseCategoryIdsWithModes(profile.getCategoryIds(), profile.getMatchMode());
        List<Long> catIds = new ArrayList<>(catModes.keySet());

        String runSourceLabel = "CRON [" + profile.getName() + "]";
        ExecutionSummary summary = executeSearch(epIds, catIds, profile.getMatchMode(), catModes, runSourceLabel);

        String statusMsg = "Zapisano: " + summary.savedCount() + " (Pobrano: " + summary.totalFetched() + ")";

        // Wysyłka wyłącznie, gdy przypisano konkretne konto SMTP oraz podano adresy odbiorców
        Long smtpId = profile.getSmtpAccountId();
        List<String> emails = parseEmails(profile.getRecipientEmails());
        if (smtpId != null && !emails.isEmpty() && summary.fetchRunId() != null) {
            try {
                EmailDispatchResult mailRes = sendRunsToEmails(
                        List.of(summary.fetchRunId()),
                        emails,
                        "Raport Cron [" + profile.getName() + "] - Przetargi",
                        smtpId
                );
                statusMsg += " | Email: " + mailRes.message();
            } catch (Exception e) {
                statusMsg += " | Blad email: " + e.getMessage();
            }
        }

        OffsetDateTime nowPl = OffsetDateTime.now(POLAND_ZONE);
        profile.setLastRunAt(nowPl);
        profile.setLastRunStatus(statusMsg);
        profileRepository.save(profile);
        lastIntervalTriggerByProfile.put(profile.getId(), nowPl);

        return summary;
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            String sourceType
    ) {
        return executeSearch(endpointIds, categoryIds, matchMode, null, sourceType);
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String sourceType
    ) {
        String fallbackMode = (matchMode != null && !matchMode.isBlank()) ? matchMode : "OR";
        List<ApiEndpoint> selectedEndpoints = endpointRepository.findAllById(
                endpointIds != null ? endpointIds : List.of()
        );
        List<KeywordCategory> selectedCategories = keywordCategoryRepository.findAllById(
                categoryIds != null ? categoryIds : List.of()
        );

        int totalFetched = 0;
        int savedCount = 0;
        int excludedCount = 0;
        int zeroScoreSkippedCount = 0;
        List<SourceLog> logs = new ArrayList<>();
        List<Tender> savedTendersInRun = new ArrayList<>();
        List<String> sourceNames = new ArrayList<>();

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JsonParser jsonParser = JsonParserFactory.getJsonParser();

        for (ApiEndpoint ep : selectedEndpoints) {
            sourceNames.add(ep.getName());
            try {
                List<RawItem> rawItems;
                if ("SCRAPER".equalsIgnoreCase(ep.getHttpMethod())) {
                    rawItems = callPythonScraper(client, jsonParser, ep);
                } else {
                    rawItems = callStandardHttpApiWithPagination(client, jsonParser, ep);
                }

                int epSaved = 0;
                for (RawItem item : rawItems) {
                    totalFetched++;
                    String externalId = item.externalId();
                    String title = (item.title() != null && !item.title().isBlank())
                            ? item.title()
                            : "Ogloszenie przetargowe";
                    String description = item.description();

                    if (externalId == null || externalId.isBlank()) {
                        externalId = "GEN-" + Math.abs((title + ep.getId()).hashCode());
                    }

                    String combinedText = (title + " " + (description != null ? description : "")).toLowerCase();

                    if (containsAnyExcludedWord(combinedText, selectedCategories)) {
                        excludedCount++;
                        continue;
                    }

                    int totalScore = 0;
                    List<String> categoryBreakdowns = new ArrayList<>();

                    for (KeywordCategory cat : selectedCategories) {
                        String catMode = (categoryMatchModes != null && categoryMatchModes.containsKey(cat.getId()))
                                ? categoryMatchModes.get(cat.getId())
                                : fallbackMode;
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

                    final String finalExtId = externalId;
                    final String finalTitle = title.trim();
                    final String breakdownStr = String.join(" / ", categoryBreakdowns);
                    final String breakdownLine = "Punktacja kategorii: " + breakdownStr;
                    final String finalDesc = (description != null && !description.isBlank())
                            ? breakdownLine + "\n" + description.trim()
                            : breakdownLine;
                    final int finalScore = totalScore;

                    Tender tender = tenderRepository.findByExternalId(finalExtId)
                            .orElseGet(() -> {
                                Tender newTender = new Tender();
                                newTender.setExternalId(finalExtId);
                                newTender.setStatus(TenderStatus.NEW);
                                newTender.setPublicationDate(OffsetDateTime.now(POLAND_ZONE));
                                return newTender;
                            });

                    tender.setTitle(finalTitle);
                    tender.setDescription(finalDesc);
                    tender.setScore(finalScore);

                    Tender savedTender = tenderRepository.save(tender);
                    savedTendersInRun.add(savedTender);
                    savedCount++;
                    epSaved++;
                }

                ep.setLastSyncAt(OffsetDateTime.now(POLAND_ZONE));
                endpointRepository.save(ep);
                logs.add(new SourceLog(
                        ep.getName(),
                        true,
                        epSaved,
                        "Zapisano " + epSaved + " przetargow (>0 pkt) z " + rawItems.size() + " pobranych."
                ));

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
        run.setTenders(savedTendersInRun);
        FetchRun savedRun = fetchRunRepository.save(run);

        return new ExecutionSummary(
                savedRun.getId(),
                totalFetched,
                savedCount,
                excludedCount,
                zeroScoreSkippedCount,
                logs
        );
    }

    private List<ParsedKeyword> parseCategoryKeywords(KeywordCategory cat) {
        List<ParsedKeyword> list = new ArrayList<>();
        if (cat.getKeywords() == null || cat.getKeywords().isBlank()) {
            return list;
        }
        boolean wholeCatExcluded = Boolean.TRUE.equals(cat.getIsExcluded());
        int fallbackScore = cat.getScore() != null ? cat.getScore() : 50;

        for (String part : cat.getKeywords().split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }

            boolean isWildcard = false;
            if (trimmed.toUpperCase().endsWith(":WILDCARD")) {
                isWildcard = true;
                trimmed = trimmed.substring(0, trimmed.length() - ":WILDCARD".length()).trim();
            }

            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                String word = trimmed.substring(0, colonIdx).trim().toLowerCase();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) {
                    continue;
                }
                if ("EXCLUDED".equals(suffix) || wholeCatExcluded) {
                    list.add(new ParsedKeyword(word, 0, true, isWildcard));
                } else {
                    try {
                        int w = Math.max(1, Math.min(100, Integer.parseInt(suffix)));
                        list.add(new ParsedKeyword(word, w, false, isWildcard));
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
        if (text == null || text.isEmpty() || pk.word() == null || pk.word().isEmpty()) {
            return false;
        }
        // Odmiana końcówek (Wildcard *): jeśli opcja jest włączona i słowo kończy się na '*'
        if (pk.wildcard() && pk.word().endsWith("*")) {
            String stem = pk.word().substring(0, pk.word().length() - 1).trim();
            if (stem.isEmpty()) {
                return false;
            }
            String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(stem) + "[\\p{L}\\p{N}]*";
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                    .matcher(text)
                    .find();
        }
        // Standardowe dokładne dopasowanie słowa/frazy
        String regex = "(?<![\\p{L}\\p{N}_])" + Pattern.quote(pk.word()) + "(?![\\p{L}\\p{N}_])";
        return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                .matcher(text)
                .find();
    }

    private boolean containsAnyExcludedWord(String text, List<KeywordCategory> categories) {
        for (KeywordCategory cat : categories) {
            for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
                if (pk.excluded() && matchesKeyword(text, pk)) {
                    return true;
                }
            }
        }
        return false;
    }

    private int calculateCategoryScore(String text, KeywordCategory cat, boolean requireAllWords) {
        List<ParsedKeyword> positiveWords = new ArrayList<>();
        for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
            if (!pk.excluded()) {
                positiveWords.add(pk);
            }
        }
        if (positiveWords.isEmpty()) {
            return 0;
        }

        int sum = 0;
        int matchedCount = 0;
        for (ParsedKeyword pk : positiveWords) {
            if (matchesKeyword(text, pk)) {
                matchedCount++;
                sum += pk.weight();
            }
        }

        if (requireAllWords && matchedCount < positiveWords.size()) {
            return 0;
        }
        return sum;
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
        return "Web Scraper (BeautifulSoup + Pandas) polaczyl sie pomyslnie! Wykryto "
                + items.size() + " pozycji na stronie (bez zapisywania do bazy).";
    }

    @SuppressWarnings("rawtypes")
    private List<RawItem> callPythonScraper(HttpClient client, JsonParser parser, ApiEndpoint ep) throws Exception {
        String selector = ep.getPayload() != null ? ep.getPayload().trim() : "";
        String reqJson = "{\"url\":\"" + escapeJson(ep.getUrl()) + "\",\"selector\":\"" + escapeJson(selector) + "\"}";

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

        Map root = parser.parseMap(resp.body());
        List<RawItem> result = new ArrayList<>();
        Object itemsObj = root.get("items");
        if (itemsObj instanceof List listObj) {
            for (Object o : listObj) {
                if (o instanceof Map m) {
                    String extId = firstNonNullString(m, "externalId", "id");
                    String title = firstNonNullString(m, "title", "name");
                    String desc = firstNonNullString(m, "description");
                    String decoratedDesc = "Źródło: " + ep.getName() + "\n" + (desc != null ? desc : "");
                    result.add(new RawItem(extId, title, decoratedDesc.trim()));
                }
            }
        }
        return result;
    }

    private List<RawItem> callStandardHttpApiWithPagination(
            HttpClient client,
            JsonParser parser,
            ApiEndpoint ep
    ) throws Exception {
        int maxPages = 1;
        if ("GET".equalsIgnoreCase(ep.getHttpMethod()) && ep.getPayload() != null) {
            String p = ep.getPayload().trim().toLowerCase();
            if (p.startsWith("pages=")) {
                try {
                    maxPages = Math.max(1, Math.min(10, Integer.parseInt(p.substring(6).trim())));
                } catch (NumberFormatException ignored) {
                }
            }
        }

        List<RawItem> allItems = new ArrayList<>();
        for (int page = 1; page <= maxPages; page++) {
            String targetUrl = ep.getUrl();
            if (maxPages > 1 && !targetUrl.contains("PageNumber=")) {
                targetUrl += (targetUrl.contains("?") ? "&" : "?") + "PageNumber=" + page;
            }

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(targetUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("User-Agent", "TenderSearchEngine/1.0");

            if ("POST".equalsIgnoreCase(ep.getHttpMethod())) {
                String payload = (ep.getPayload() != null && !ep.getPayload().isBlank()) ? ep.getPayload() : "{}";
                reqBuilder.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload));
            } else {
                reqBuilder.GET();
            }

            HttpResponse<String> response = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalArgumentException("Blad HTTP " + response.statusCode());
            }
            List<RawItem> pageItems = extractItems(parser, response.body(), ep.getName());
            allItems.addAll(pageItems);
            if (pageItems.isEmpty()) {
                break;
            }
        }
        return allItems;
    }

    @SuppressWarnings("rawtypes")
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

        Map map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        String defaultName = "raport_przetargi_"
                + LocalDateTime.now(POLAND_ZONE).format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm"))
                + ".xlsx";
        String filename = map.get("filename") != null ? String.valueOf(map.get("filename")) : defaultName;
        String base64 = String.valueOf(map.get("base64"));
        int count = map.get("count") instanceof Number n ? n.intValue() : 0;
        return new ExcelExportResult(filename, base64, count);
    }

    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject) throws Exception {
        return sendRunsToEmails(runIds, emails, subject, null);
    }

    @SuppressWarnings("rawtypes")
    public EmailDispatchResult sendRunsToEmails(
            List<Long> runIds,
            List<String> emails,
            String subject,
            Long smtpAccountId
    ) throws Exception {
        if (smtpAccountId == null) {
            throw new IllegalArgumentException("Nie wybrano konta SMTP.");
        }
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
        Map map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            String detail = map.get("detail") != null ? String.valueOf(map.get("detail")) : resp.body();
            throw new IllegalArgumentException(detail);
        }

        boolean sent = Boolean.TRUE.equals(map.get("sent"));
        String message = String.valueOf(map.get("message"));
        String base64 = map.get("base64") != null ? String.valueOf(map.get("base64")) : "";
        String filename = map.get("filename") != null ? String.valueOf(map.get("filename")) : "raport_przetargi.xlsx";
        return new EmailDispatchResult(sent, message, base64, filename);
    }

    private String buildWorkerExcelPayload(
            List<FetchRun> runs,
            List<String> emails,
            String subject,
            SmtpAccount smtpAcc
    ) {
        Map<Long, Tender> uniqueTenders = new LinkedHashMap<>();
        Map<Long, String> runLabels = new LinkedHashMap<>();

        for (FetchRun run : runs) {
            String label = "#" + run.getId() + " (" + run.getSourceType() + ")";
            if (run.getTenders() != null) {
                for (Tender t : run.getTenders()) {
                    uniqueTenders.put(t.getId(), t);
                    runLabels.put(t.getId(), label);
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"tenders\":[");
        boolean first = true;
        for (Tender t : uniqueTenders.values()) {
            if (!first) sb.append(",");
            first = false;
            String breakdown = extractScoreBreakdown(t);
            sb.append("{")
                    .append("\"externalId\":\"").append(escapeJson(t.getExternalId())).append("\",")
                    .append("\"title\":\"").append(escapeJson(t.getTitle())).append("\",")
                    .append("\"score\":").append(t.getScore() != null ? t.getScore() : 0).append(",")
                    .append("\"scoreBreakdown\":\"").append(escapeJson(breakdown)).append("\",")
                    .append("\"status\":\"").append(t.getStatus() != null ? t.getStatus().name() : "NEW").append("\",")
                    .append("\"publicationDate\":\"").append(t.getPublicationDate() != null ? t.getPublicationDate().toString() : "").append("\",")
                    .append("\"runInfo\":\"").append(escapeJson(runLabels.getOrDefault(t.getId(), ""))).append("\",")
                    .append("\"description\":\"").append(escapeJson(t.getDescription())).append("\"")
                    .append("}");
        }
        sb.append("]");

        if (emails != null) {
            sb.append(",\"emails\":[");
            for (int i = 0; i < emails.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append("\"").append(escapeJson(emails.get(i))).append("\"");
            }
            sb.append("]");
            sb.append(",\"subject\":\"").append(escapeJson(subject != null ? subject : "Raport przetargow")).append("\"");

            if (smtpAcc != null) {
                String host = readStringProp(smtpAcc, "getSmtpHost", "getHost");
                Integer port = readIntProp(smtpAcc, "getSmtpPort", "getPort");
                String username = readStringProp(smtpAcc, "getSmtpUsername", "getUsername");
                String password = readStringProp(smtpAcc, "getSmtpPassword", "getPassword");

                sb.append(",\"smtp\":{")
                        .append("\"host\":\"").append(escapeJson(host)).append("\",")
                        .append("\"port\":").append(port != null ? port : 587).append(",")
                        .append("\"username\":\"").append(escapeJson(username)).append("\",")
                        .append("\"password\":\"").append(escapeJson(password)).append("\"")
                        .append("}");
            }
        }

        sb.append("}");
        return sb.toString();
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

    @SuppressWarnings("rawtypes")
    private List<RawItem> extractItems(JsonParser parser, String body, String sourceName) {
        if (body == null || body.isBlank()) {
            return List.of();
        }
        String trimmed = body.trim();
        List<RawItem> result = new ArrayList<>();

        if (trimmed.startsWith("[")) {
            List<Object> parsedList = parser.parseList(trimmed);
            for (Object obj : parsedList) {
                if (obj instanceof Map mapObj) {
                    result.add(toRawItem(mapObj, sourceName));
                }
            }
        } else if (trimmed.startsWith("{")) {
            Map root = parser.parseMap(trimmed);
            for (String key : List.of("items", "content", "results", "data", "notices")) {
                Object candidate = root.get(key);
                if (candidate instanceof List listObj) {
                    for (Object obj : listObj) {
                        if (obj instanceof Map mapObj) {
                            result.add(toRawItem(mapObj, sourceName));
                        }
                    }
                    break;
                }
            }
        }
        return result;
    }

    @SuppressWarnings("rawtypes")
    private RawItem toRawItem(Map map, String sourceName) {
        String extId = firstNonNullString(map, "objectId", "noticeNumber", "bzpNumber", "id", "externalId", "publication-number");
        String title = firstNonNullString(map, "orderObject", "title", "name", "subject", "BT-21-Procedure");
        String purchaser = firstNonNullString(map, "organizationName", "purchaserName", "buyerName", "client", "organisation-name-buyer");
        String city = firstNonNullString(map, "organizationCity", "city", "location");
        String province = firstNonNullString(map, "organizationProvince", "province", "region");
        String noticeNo = firstNonNullString(map, "noticeNumber", "bzpNumber", "referenceNumber");
        String noticeType = firstNonNullString(map, "noticeType", "procedureType", "orderType");
        String cpv = firstNonNullString(map, "cpvCode", "cpv", "mainCpv");
        String deadline = firstNonNullString(map, "submittingOffersDate", "deadline", "submissionDeadline");
        String rawDesc = firstNonNullString(map, "shortDescription", "description", "summary", "BT-24-Procedure");

        // Wyciąganie lub budowanie bezpośredniego linku do przetargu
        String tenderLink = firstNonNullString(map, "url", "link", "tenderUrl", "noticeUrl", "htmlUrl", "offerUrl");
        if (tenderLink == null) {
            String objectId = firstNonNullString(map, "objectId");
            String pubNo = firstNonNullString(map, "publication-number");
            if (objectId != null) {
                tenderLink = "https://ezamowienia.gov.pl/mp-client/search/list/" + objectId.trim();
            } else if (pubNo != null) {
                tenderLink = "https://ted.europa.eu/pl/notice/-/detail/" + pubNo.trim();
            }
        }

        StringBuilder details = new StringBuilder();
        details.append("Źródło: ").append(sourceName).append("\n");
        if (tenderLink != null) details.append("Link: ").append(tenderLink).append("\n");
        if (purchaser != null) details.append("Zamawiający: ").append(purchaser).append("\n");
        if (city != null || province != null) {
            details.append("Lokalizacja: ")
                    .append(city != null ? city : "")
                    .append(province != null ? " (" + province + ")" : "")
                    .append("\n");
        }
        if (noticeNo != null) details.append("Numer ogłoszenia: ").append(noticeNo).append("\n");
        if (noticeType != null) details.append("Typ ogłoszenia: ").append(noticeType).append("\n");
        if (cpv != null) details.append("Kody CPV: ").append(cpv).append("\n");
        if (deadline != null) details.append("Termin składania ofert: ").append(deadline).append("\n");
        if (rawDesc != null) details.append("Opis: ").append(rawDesc).append("\n");

        return new RawItem(extId, title, details.toString().trim());
    }

    @SuppressWarnings("rawtypes")
    private String firstNonNullString(Map map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null && !val.toString().isBlank()) {
                return val.toString();
            }
        }
        return null;
    }

    private List<Long> parseIds(String raw) {
        List<Long> res = new ArrayList<>();
        if (raw == null || raw.isBlank()) return res;
        for (String part : raw.split(",")) {
            String idPart = part.split(":")[0].trim();
            try {
                res.add(Long.parseLong(idPart));
            } catch (NumberFormatException ignored) {
            }
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
                String mode = (pieces.length > 1 && !pieces[1].isBlank())
                        ? pieces[1].trim().toUpperCase()
                        : def;
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
            if (!trimmed.isEmpty() && trimmed.contains("@")) {
                res.add(trimmed);
            }
        }
        return res;
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "")
                .replace("\n", "\\n");
    }

    public record ParsedKeyword(String word, int weight, boolean excluded, boolean wildcard) {}
    public record RawItem(String externalId, String title, String description) {}
    public record SourceLog(String sourceName, boolean success, int savedCount, String message) {}
    public record ExecutionSummary(
            Long fetchRunId,
            int totalFetched,
            int savedCount,
            int excludedCount,
            int zeroScoreSkippedCount,
            List<SourceLog> logs
    ) {}
    public record ExcelExportResult(String filename, String base64, int count) {}
    public record EmailDispatchResult(boolean sent, String message, String base64, String filename) {}
}