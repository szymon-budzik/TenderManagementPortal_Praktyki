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
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

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

    @Scheduled(fixedRate = 15000)
    public void checkAndRunScheduledProfiles() {
        ZonedDateTime nowPl = ZonedDateTime.now(POLAND_ZONE);
        String nowHm = nowPl.format(DateTimeFormatter.ofPattern("HH:mm"));
        String stampKey = nowPl.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
        int currentDayOfWeek = nowPl.getDayOfWeek().getValue(); // 1 (Pon) - 7 (Nd)

        List<AutomationProfile> profiles = profileRepository.findAll();

        for (AutomationProfile profile : profiles) {
            if (!Boolean.TRUE.equals(profile.getEnabled())) {
                continue;
            }

            String type = profile.getScheduleType() != null
                    ? profile.getScheduleType().toUpperCase()
                    : "DAILY";

            if ("INTERVAL".equals(type)) {
                int intervalMins = profile.getIntervalMinutes() != null && profile.getIntervalMinutes() > 0
                        ? profile.getIntervalMinutes()
                        : 60;
                OffsetDateTime lastRun = profile.getLastRunAt();
                boolean shouldRun = (lastRun == null)
                        || Duration.between(lastRun, nowPl.toOffsetDateTime()).toMinutes() >= intervalMins;

                if (shouldRun && !stampKey.equals(lastTriggeredMinuteByProfile.get(profile.getId()))) {
                    lastTriggeredMinuteByProfile.put(profile.getId(), stampKey);
                    executeProfileNow(profile.getId());
                }
            } else if ("WEEKLY".equals(type)) {
                List<Integer> allowedDays = parseDayNumbers(profile.getCronDays());
                if (allowedDays.contains(currentDayOfWeek) && matchesAnyTime(nowHm, profile.getCronTime())) {
                    if (!stampKey.equals(lastTriggeredMinuteByProfile.get(profile.getId()))) {
                        lastTriggeredMinuteByProfile.put(profile.getId(), stampKey);
                        executeProfileNow(profile.getId());
                    }
                }
            } else {
                // DAILY oraz MULTI_TIME (wiele godzin po przecinku, np. "08:00, 12:00, 16:00")
                if (matchesAnyTime(nowHm, profile.getCronTime())) {
                    if (!stampKey.equals(lastTriggeredMinuteByProfile.get(profile.getId()))) {
                        lastTriggeredMinuteByProfile.put(profile.getId(), stampKey);
                        executeProfileNow(profile.getId());
                    }
                }
            }
        }
    }

    private boolean matchesAnyTime(String nowHm, String cronTimeRaw) {
        if (cronTimeRaw == null || cronTimeRaw.isBlank()) return false;
        for (String part : cronTimeRaw.split("[,;]")) {
            if (nowHm.equals(part.trim())) {
                return true;
            }
        }
        return false;
    }

    private List<Integer> parseDayNumbers(String raw) {
        List<Integer> days = new ArrayList<>();
        if (raw == null || raw.isBlank()) return days;
        for (String part : raw.split(",")) {
            try {
                days.add(Integer.parseInt(part.trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        return days;
    }

    public ExecutionSummary executeProfileNow(Long profileId) {
        AutomationProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + profileId));

        List<Long> epIds = parseIds(profile.getEndpointIds());
        List<Long> catIds = parseIds(profile.getCategoryIds());

        String runSourceLabel = "CRON [" + profile.getName() + "]";
        ExecutionSummary summary = executeSearch(epIds, catIds, profile.getMatchMode(), runSourceLabel);

        String statusMsg = "Zapisano: " + summary.savedCount() + " (Pobrano: " + summary.totalFetched() + ")";

        List<String> emails = parseEmails(profile.getRecipientEmails());
        if (!emails.isEmpty() && summary.fetchRunId() != null) {
            try {
                EmailDispatchResult mailRes = sendRunsToEmails(
                        List.of(summary.fetchRunId()),
                        emails,
                        "Raport Cron [" + profile.getName() + "] - Przetargi",
                        profile.getSmtpAccountId()
                );
                statusMsg += " | Email: " + mailRes.message();
            } catch (Exception e) {
                statusMsg += " | Blad email: " + e.getMessage();
            }
        }

        profile.setLastRunAt(OffsetDateTime.now(POLAND_ZONE));
        profile.setLastRunStatus(statusMsg);
        profileRepository.save(profile);

        return summary;
    }

    public ExecutionSummary executeSearch(
            List<Long> endpointIds,
            List<Long> categoryIds,
            String matchMode,
            String sourceType
    ) {
        boolean requireAllWords = "ALL".equalsIgnoreCase(matchMode);
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
            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                String word = trimmed.substring(0, colonIdx).trim().toLowerCase();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) {
                    continue;
                }
                if ("EXCLUDED".equals(suffix) || wholeCatExcluded) {
                    list.add(new ParsedKeyword(word, 0, true));
                } else {
                    try {
                        int w = Math.max(1, Math.min(100, Integer.parseInt(suffix)));
                        list.add(new ParsedKeyword(word, w, false));
                    } catch (NumberFormatException e) {
                        list.add(new ParsedKeyword(word, fallbackScore, false));
                    }
                }
            } else {
                list.add(new ParsedKeyword(trimmed.toLowerCase(), fallbackScore, wholeCatExcluded));
            }
        }
        return list;
    }

    private boolean containsAnyExcludedWord(String text, List<KeywordCategory> categories) {
        for (KeywordCategory cat : categories) {
            for (ParsedKeyword pk : parseCategoryKeywords(cat)) {
                if (pk.excluded() && text.contains(pk.word())) {
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
            if (text.contains(pk.word())) {
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
                    result.add(new RawItem(extId, title, desc));
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

    @SuppressWarnings("rawtypes")
    public EmailDispatchResult sendRunsToEmails(
            List<Long> runIds,
            List<String> emails,
            String subject,
            Long smtpAccountId
    ) throws Exception {
        List<FetchRun> runs = fetchRunRepository.findAllById(runIds);
        SmtpCredentials creds = resolveSmtpCredentials(smtpAccountId);
        String payloadJson = buildWorkerExcelPayload(runs, emails, subject, creds);

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

    private SmtpCredentials resolveSmtpCredentials(Long smtpAccountId) {
        if (smtpAccountId != null) {
            Optional<SmtpAccount> found = smtpAccountRepository.findById(smtpAccountId);
            if (found.isPresent()) {
                SmtpAccount acc = found.get();
                return new SmtpCredentials(
                        acc.getSmtpHost(),
                        acc.getSmtpPort() != null ? acc.getSmtpPort() : 587,
                        acc.getSmtpUsername(),
                        acc.getSmtpPassword()
                );
            }
        }
        List<SmtpAccount> all = smtpAccountRepository.findAllByOrderByIdAsc();
        if (!all.isEmpty()) {
            SmtpAccount first = all.get(0);
            return new SmtpCredentials(
                    first.getSmtpHost(),
                    first.getSmtpPort() != null ? first.getSmtpPort() : 587,
                    first.getSmtpUsername(),
                    first.getSmtpPassword()
            );
        }
        CronConfig cfg = getOrCreateCronConfig();
        return new SmtpCredentials(
                cfg.getSmtpHost(),
                cfg.getSmtpPort() != null ? cfg.getSmtpPort() : 587,
                cfg.getSmtpUsername(),
                cfg.getSmtpPassword()
        );
    }

    private String buildWorkerExcelPayload(
            List<FetchRun> runs,
            List<String> emails,
            String subject,
            SmtpCredentials creds
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

            if (creds != null) {
                sb.append(",\"smtp\":{")
                        .append("\"host\":\"").append(escapeJson(creds.host())).append("\",")
                        .append("\"port\":").append(creds.port()).append(",")
                        .append("\"username\":\"").append(escapeJson(creds.username())).append("\",")
                        .append("\"password\":\"").append(escapeJson(creds.password())).append("\"")
                        .append("}");
            }
        }

        sb.append("}");
        return sb.toString();
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

        StringBuilder details = new StringBuilder();
        details.append("Źródło: ").append(sourceName).append("\n");
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
            try {
                res.add(Long.parseLong(part.trim()));
            } catch (NumberFormatException ignored) {
            }
        }
        return res;
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

    public record SmtpCredentials(String host, int port, String username, String password) {}
    public record ParsedKeyword(String word, int weight, boolean excluded) {}
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