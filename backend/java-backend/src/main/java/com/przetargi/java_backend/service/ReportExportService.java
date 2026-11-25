package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ReportExportService {

    private static final DateTimeFormatter FILE_TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm");

    private final FetchRunRepository fetchRunRepository;
    private final TenderRepository tenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final KeywordMatchingService keywordMatchingService;
    private final TenderDateService dateService;
    private final HttpClient httpClient;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    public ReportExportService(
            FetchRunRepository fetchRunRepository,
            TenderRepository tenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            KeywordMatchingService keywordMatchingService,
            TenderDateService dateService
    ) {
        this.fetchRunRepository = fetchRunRepository;
        this.tenderRepository = tenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.keywordMatchingService = keywordMatchingService;
        this.dateService = dateService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
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
        run.setCreatedAt(dateService.nowPoland());
        run.setTenders(new ArrayList<>(selectedTenders));
        run.setTenderUpdates(new LinkedHashSet<>(selectedUpdates));

        return fetchRunRepository.save(run);
    }

    public TenderExecutionService.ExcelExportResult generateExcelForRuns(List<Long> runIds) throws Exception {
        List<FetchRun> runs = fetchRunRepository.findAllById(runIds);
        String payloadJson = buildWorkerExcelPayload(runs, null, null, null);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/excel/export"))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalArgumentException("Blad generowania pliku Excel: " + resp.body());
        }

        Map<String, Object> map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        String defaultName = "raport_przetargi_" + dateService.nowPolandLocal().format(FILE_TS_FMT) + ".xlsx";
        String filename = map.get("filename") != null ? String.valueOf(map.get("filename")) : defaultName;
        int count = map.get("count") instanceof Number n ? n.intValue() : 0;
        return new TenderExecutionService.ExcelExportResult(filename, String.valueOf(map.get("base64")), count);
    }

    public String buildWorkerExcelPayload(
            List<FetchRun> runs,
            List<String> emails,
            String subject,
            SmtpAccount smtpAcc
    ) {
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
                        + dateService.formatPolandDateTime(t.getSubmissionDeadline())
                        + (desc.isBlank() ? "" : "\n" + desc);
            }
            sb.append("{")
                    .append("\"externalId\":\"").append(escapeJson(t.getExternalId())).append("\",")
                    .append("\"title\":\"").append(escapeJson(t.getTitle())).append("\",")
                    .append("\"score\":").append(t.getScore() != null ? t.getScore() : 0).append(",")
                    .append("\"scoreBreakdown\":\"").append(escapeJson(keywordMatchingService.extractScoreBreakdown(t))).append("\",")
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
            String breakdown = parent != null ? keywordMatchingService.extractScoreBreakdown(parent) : "0 pkt";

            StringBuilder updDesc = new StringBuilder();
            if (u.getChangeSummary() != null && !u.getChangeSummary().isBlank()) {
                updDesc.append("Zmiany: ").append(u.getChangeSummary()).append("\n");
            }
            if (u.getSubmissionDeadline() != null) {
                updDesc.append("Termin składania ofert: ")
                        .append(dateService.formatPolandDateTime(u.getSubmissionDeadline()))
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
                        .append("\"host\":\"").append(escapeJson(smtpAcc.getSmtpHost())).append("\",")
                        .append("\"port\":").append(smtpAcc.getSmtpPort() != null ? smtpAcc.getSmtpPort() : 587).append(",")
                        .append("\"username\":\"").append(escapeJson(smtpAcc.getSmtpUsername())).append("\",")
                        .append("\"password\":\"").append(escapeJson(smtpAcc.getSmtpPassword())).append("\"")
                        .append("}");
            }
        }
        return sb.append("}").toString();
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

    private String truncateString(String text, int maxLen) {
        return (text == null || text.length() <= maxLen) ? text : text.substring(0, maxLen);
    }

    private String escapeJson(String s) {
        return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "").replace("\n", "\\n");
    }
}
