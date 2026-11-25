package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParser;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class TenderSourceFetchService {

    private static final Pattern LINK_PLACEHOLDER_PATTERN = Pattern.compile("\\{([^{}]+)\\}");

    private final TenderDateService dateService;
    private final HttpClient httpClient;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    public TenderSourceFetchService(TenderDateService dateService) {
        this.dateService = dateService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public List<RawItem> fetchItems(ApiEndpoint ep) throws Exception {
        JsonParser jsonParser = JsonParserFactory.getJsonParser();
        return "SCRAPER".equalsIgnoreCase(ep.getHttpMethod())
                ? callPythonScraper(jsonParser, ep)
                : callStandardHttpApi(jsonParser, ep);
    }

    public String testScraperConnection(ApiEndpoint ep) throws Exception {
        JsonParser parser = JsonParserFactory.getJsonParser();
        List<RawItem> items = callPythonScraper(parser, ep);

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

    private List<RawItem> callPythonScraper(JsonParser parser, ApiEndpoint ep) throws Exception {
        String resolvedUrl = dateService.resolveDynamicTokens(ep.getUrl());
        String selector = ep.getPayload() != null ? ep.getPayload().trim() : "";
        String reqJson = "{\"url\":\"" + escapeJson(resolvedUrl) + "\",\"selector\":\"" + escapeJson(selector) + "\"}";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/scrape"))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(reqJson))
                .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
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
                    result.add(new RawItem(
                            extId,
                            title,
                            decoratedDesc.trim(),
                            dateService.extractDeadlineFromText(desc),
                            normalizeGroupKey(null, title)
                    ));
                }
            }
        }
        return result;
    }

    private List<RawItem> callStandardHttpApi(JsonParser parser, ApiEndpoint ep) throws Exception {
        String resolvedUrl = dateService.resolveDynamicTokens(ep.getUrl());
        HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                .uri(URI.create(resolvedUrl))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .header("User-Agent", "TenderSearchEngine/1.0");

        if ("POST".equalsIgnoreCase(ep.getHttpMethod())) {
            String rawPayload = (ep.getPayload() != null && !ep.getPayload().isBlank()) ? ep.getPayload() : "{}";
            String resolvedPayload = dateService.resolveDynamicTokens(rawPayload);
            reqBuilder.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(resolvedPayload));
        } else {
            reqBuilder.GET();
        }

        HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalArgumentException("Błąd HTTP " + response.statusCode());
        }
        return extractItems(parser, response.body(), ep.getName(), ep.getLinkTemplate());
    }

    List<RawItem> extractItems(JsonParser parser, String body, String sourceName, String linkTemplate) {
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
                    .append(dateService.formatPolandDateTime(submissionDeadline)).append("\n");
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
        if (submissionDeadline == null) submissionDeadline = dateService.extractDeadlineFromText(descStr);
        return new RawItem(extId, title, descStr, submissionDeadline, groupKey);
    }

    /**
     * Buduje klikalny link z konfigurowalnego szablonu endpointu, np.
     * https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/{objectId}
     */
    String applyLinkTemplate(String template, Map<String, String> flatFields) {
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

        for (Map.Entry<String, String> e : flatFields.entrySet()) {
            if (e.getKey().equalsIgnoreCase(fieldName) && e.getValue() != null && !e.getValue().isBlank()) {
                return e.getValue();
            }
        }
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
                OffsetDateTime parsed = dateService.parseFlexibleDateTime(e.getValue());
                if (parsed != null) return parsed;
            }
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

    public String normalizeExternalId(String rawExtId, String title, Long endpointId) {
        if (rawExtId != null && !rawExtId.isBlank()) return truncateString(rawExtId.trim(), 100);
        return "GEN-" + Math.abs(((title != null ? title : "") + endpointId).hashCode());
    }

    public String normalizeGroupKey(String explicitGroupKey, String title) {
        if (explicitGroupKey != null && !explicitGroupKey.isBlank()) return truncateString(explicitGroupKey.trim(), 250);
        String normTitle = normalizeTitleForGrouping(title);
        return normTitle.length() >= 18 ? truncateString("TTL:" + normTitle, 250) : null;
    }

    public String normalizeTitleForGrouping(String title) {
        return title == null ? "" : title.toLowerCase().replaceAll("[^\\p{L}\\p{N}]+", " ").replaceAll("\\s+", " ").trim();
    }

    public String truncateString(String text, int maxLen) {
        return (text == null || text.length() <= maxLen) ? text : text.substring(0, maxLen);
    }

    private boolean isTopLevelKey(String path) {
        return path != null && !path.contains(".") && !path.contains("[");
    }

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

    private String truncateTitle(String text) {
        return text.length() > 260 ? text.substring(0, 260) + "..." : text;
    }

    private String firstNonNullString(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object val = map.get(key);
            if (val != null && !val.toString().isBlank()) return val.toString();
        }
        return null;
    }

    private String escapeJson(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "").replace("\n", "\\n");
    }

    private record JsonRecord(Map<?, ?> fields) {}

    public record RawItem(
            String externalId,
            String title,
            String description,
            OffsetDateTime submissionDeadline,
            String groupKey
    ) {}
}
