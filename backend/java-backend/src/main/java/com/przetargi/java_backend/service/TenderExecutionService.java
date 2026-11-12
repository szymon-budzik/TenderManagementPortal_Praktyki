package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.CronConfig;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.CronConfigRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
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
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@EnableScheduling
public class TenderExecutionService {

    private final ApiEndpointRepository endpointRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final TenderRepository tenderRepository;
    private final FetchRunRepository fetchRunRepository;
    private final CronConfigRepository cronConfigRepository;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    private String lastTriggeredMinute = "";

    public TenderExecutionService(
            ApiEndpointRepository endpointRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            TenderRepository tenderRepository,
            FetchRunRepository fetchRunRepository,
            CronConfigRepository cronConfigRepository
    ) {
        this.endpointRepository = endpointRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.tenderRepository = tenderRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.cronConfigRepository = cronConfigRepository;
    }

    public CronConfig getOrCreateCronConfig() {
        return cronConfigRepository.findById(1L).orElseGet(() -> {
            CronConfig cfg = new CronConfig();
            cfg.setId(1L);
            return cronConfigRepository.save(cfg);
        });
    }

    @Scheduled(fixedRate = 30000)
    public void checkAndRunScheduledCron() {
        CronConfig cfg = getOrCreateCronConfig();
        if (!Boolean.TRUE.equals(cfg.getEnabled())) {
            return;
        }
        String nowHm = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
        if (nowHm.equals(cfg.getCronTime()) && !nowHm.equals(lastTriggeredMinute)) {
            lastTriggeredMinute = nowHm;
            executeCronJobNow();
        }
    }

    public ExecutionSummary executeCronJobNow() {
        CronConfig cfg = getOrCreateCronConfig();
        List<Long> epIds = parseIds(cfg.getEndpointIds());
        if (epIds.isEmpty()) {
            for (ApiEndpoint ep : endpointRepository.findAll()) {
                if (Boolean.TRUE.equals(ep.getIsActive())) {
                    epIds.add(ep.getId());
                }
            }
        }

        List<Long> catIds = parseIds(cfg.getCategoryIds());
        if (catIds.isEmpty()) {
            for (KeywordCategory cat : keywordCategoryRepository.findAll()) {
                catIds.add(cat.getId());
            }
        }

        ExecutionSummary summary = executeSearch(epIds, catIds, cfg.getMatchMode(), "CRON");
        String statusMsg = "Zapisano: " + summary.savedCount() + " (Pobrano: " + summary.totalFetched() + ")";

        List<String> emails = parseEmails(cfg.getRecipientEmails());
        if (!emails.isEmpty() && summary.fetchRunId() != null) {
            try {
                EmailDispatchResult mailRes = sendRunsToEmails(
                        List.of(summary.fetchRunId()),
                        emails,
                        "Automatyczny raport Cron - Przetargi"
                );
                statusMsg += " | Email: " + mailRes.message();
            } catch (Exception e) {
                statusMsg += " | Blad email: " + e.getMessage();
            }
        }

        cfg.setLastRunAt(OffsetDateTime.now());
        cfg.setLastRunStatus(statusMsg);
        cronConfigRepository.save(cfg);

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

        List<KeywordCategory> excludedCategories = new ArrayList<>();
        List<KeywordCategory> scoringCategories = new ArrayList<>();
        for (KeywordCategory c : selectedCategories) {
            if (Boolean.TRUE.equals(c.getIsExcluded())) {
                excludedCategories.add(c);
            } else {
                scoringCategories.add(c);
            }
        }

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
                    rawItems = callStandardHttpApi(client, jsonParser, ep);
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

                    boolean excluded = false;
                    for (KeywordCategory exCat : excludedCategories) {
                        if (matchesCategory(combinedText, exCat, requireAllWords)) {
                            excluded = true;
                            break;
                        }
                    }

                    if (excluded) {
                        excludedCount++;
                        continue;
                    }

                    int calculatedScore = 0;
                    List<String> matchedCatNames = new ArrayList<>();
                    for (KeywordCategory scCat : scoringCategories) {
                        if (matchesCategory(combinedText, scCat, requireAllWords)) {
                            int pts = scCat.getScore() != null ? scCat.getScore() : 0;
                            calculatedScore += pts;
                            matchedCatNames.add(scCat.getName() + " (+" + pts + " pkt)");
                        }
                    }

                    if (calculatedScore <= 0) {
                        zeroScoreSkippedCount++;
                        continue;
                    }

                    final String finalExtId = externalId;
                    final String finalTitle = title.trim();
                    final String matchedInfo = "Dopasowane kategorie: " + String.join(", ", matchedCatNames);
                    final String finalDesc = (description != null && !description.isBlank())
                            ? description.trim() + "\n" + matchedInfo
                            : matchedInfo;

                    Tender tender = tenderRepository.findByExternalId(finalExtId)
                            .orElseGet(() -> {
                                Tender newTender = new Tender();
                                newTender.setExternalId(finalExtId);
                                newTender.setStatus(TenderStatus.NEW);
                                newTender.setPublicationDate(OffsetDateTime.now());
                                return newTender;
                            });

                    tender.setTitle(finalTitle);
                    tender.setDescription(finalDesc);
                    tender.setScore(calculatedScore);

                    Tender savedTender = tenderRepository.save(tender);
                    savedTendersInRun.add(savedTender);
                    savedCount++;
                    epSaved++;
                }

                ep.setLastSyncAt(OffsetDateTime.now());
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
        run.setCreatedAt(OffsetDateTime.now());
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

    @SuppressWarnings("rawtypes")
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

    private List<RawItem> callStandardHttpApi(HttpClient client, JsonParser parser, ApiEndpoint ep) throws Exception {
        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(ep.getUrl()))
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
        return extractItems(parser, response.body(), ep.getName());
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
        String base64 = String.valueOf(map.get("base64"));
        int count = map.get("count") instanceof Number n ? n.intValue() : 0;
        return new ExcelExportResult("raport_przetargi.xlsx", base64, count);
    }

    @SuppressWarnings("rawtypes")
    public EmailDispatchResult sendRunsToEmails(List<Long> runIds, List<String> emails, String subject) throws Exception {
        List<FetchRun> runs = fetchRunRepository.findAllById(runIds);
        CronConfig cfg = getOrCreateCronConfig();
        String payloadJson = buildWorkerExcelPayload(runs, emails, subject, cfg);

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
        return new EmailDispatchResult(sent, message, base64);
    }

    private String buildWorkerExcelPayload(
            List<FetchRun> runs,
            List<String> emails,
            String subject,
            CronConfig cfg
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
            sb.append("{")
                    .append("\"externalId\":\"").append(escapeJson(t.getExternalId())).append("\",")
                    .append("\"title\":\"").append(escapeJson(t.getTitle())).append("\",")
                    .append("\"score\":").append(t.getScore() != null ? t.getScore() : 0).append(",")
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

            if (cfg != null) {
                sb.append(",\"smtp\":{")
                        .append("\"host\":\"").append(escapeJson(cfg.getSmtpHost())).append("\",")
                        .append("\"port\":").append(cfg.getSmtpPort() != null ? cfg.getSmtpPort() : 587).append(",")
                        .append("\"username\":\"").append(escapeJson(cfg.getSmtpUsername())).append("\",")
                        .append("\"password\":\"").append(escapeJson(cfg.getSmtpPassword())).append("\"")
                        .append("}");
            }
        }

        sb.append("}");
        return sb.toString();
    }

    private boolean matchesCategory(String text, KeywordCategory category, boolean requireAllWords) {
        String[] split = category.getKeywords().split(",");
        List<String> words = new ArrayList<>();
        for (String s : split) {
            String w = s.trim().toLowerCase();
            if (!w.isEmpty()) {
                words.add(w);
            }
        }
        if (words.isEmpty()) {
            return false;
        }
        if (requireAllWords) {
            for (String w : words) {
                if (!text.contains(w)) return false;
            }
            return true;
        } else {
            for (String w : words) {
                if (text.contains(w)) return true;
            }
            return false;
        }
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
            for (String key : List.of("items", "content", "results", "data")) {
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
        String extId = firstNonNullString(map, "objectId", "noticeNumber", "bzpNumber", "id", "externalId");
        String title = firstNonNullString(map, "orderObject", "title", "name", "subject");
        String purchaser = firstNonNullString(map, "organizationName", "purchaserName", "buyerName", "client");
        String city = firstNonNullString(map, "organizationCity", "city", "location");
        String province = firstNonNullString(map, "organizationProvince", "province", "region");
        String noticeNo = firstNonNullString(map, "noticeNumber", "bzpNumber", "referenceNumber");
        String noticeType = firstNonNullString(map, "noticeType", "procedureType", "orderType");
        String cpv = firstNonNullString(map, "cpvCode", "cpv", "mainCpv");
        String deadline = firstNonNullString(map, "submittingOffersDate", "deadline", "submissionDeadline");
        String rawDesc = firstNonNullString(map, "shortDescription", "description", "summary");

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
    public record EmailDispatchResult(boolean sent, String message, String base64) {}
}