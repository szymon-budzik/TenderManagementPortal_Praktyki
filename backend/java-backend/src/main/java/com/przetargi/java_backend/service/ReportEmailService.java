package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.json.JsonParserFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ReportEmailService {

    private final SmtpAccountRepository smtpAccountRepository;
    private final FetchRunRepository fetchRunRepository;
    private final ReportExportService reportExportService;
    private final HttpClient httpClient;

    @Value("${SCRAPER_SERVICE_URL:http://ingestion-worker:8000}")
    private String scraperServiceUrl;

    public ReportEmailService(
            SmtpAccountRepository smtpAccountRepository,
            FetchRunRepository fetchRunRepository,
            ReportExportService reportExportService
    ) {
        this.smtpAccountRepository = smtpAccountRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.reportExportService = reportExportService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    public TenderExecutionService.EmailDispatchResult sendRunsToEmails(
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
        String payloadJson = reportExportService.buildWorkerExcelPayload(runs, emails, subject, smtpAccount);

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(scraperServiceUrl + "/excel/email"))
                .timeout(Duration.ofSeconds(25))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payloadJson))
                .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        Map<String, Object> map = JsonParserFactory.getJsonParser().parseMap(resp.body());
        if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
            throw new IllegalArgumentException(map.get("detail") != null ? String.valueOf(map.get("detail")) : resp.body());
        }

        return new TenderExecutionService.EmailDispatchResult(
                Boolean.TRUE.equals(map.get("sent")),
                String.valueOf(map.get("message")),
                map.get("base64") != null ? String.valueOf(map.get("base64")) : "",
                map.get("filename") != null ? String.valueOf(map.get("filename")) : "raport_przetargi.xlsx"
        );
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
}
