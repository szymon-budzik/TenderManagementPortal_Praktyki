package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.entity.CronConfig;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.repository.CronConfigRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/automation")
public class AutomationController {

    private final TenderExecutionService executionService;
    private final FetchRunRepository fetchRunRepository;
    private final CronConfigRepository cronConfigRepository;

    public AutomationController(
            TenderExecutionService executionService,
            FetchRunRepository fetchRunRepository,
            CronConfigRepository cronConfigRepository
    ) {
        this.executionService = executionService;
        this.fetchRunRepository = fetchRunRepository;
        this.cronConfigRepository = cronConfigRepository;
    }

    @GetMapping("/runs")
    public ResponseEntity<List<FetchRunDto>> getRuns() {
        List<FetchRun> runs = fetchRunRepository.findAllByOrderByCreatedAtDesc();
        List<FetchRunDto> result = new ArrayList<>();
        for (FetchRun r : runs) {
            result.add(new FetchRunDto(
                    r.getId(),
                    r.getSourceType(),
                    r.getSourcesSummary(),
                    r.getTotalFetched(),
                    r.getSavedCount(),
                    r.getExcludedCount(),
                    r.getZeroScoreCount(),
                    r.getCreatedAt()
            ));
        }
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/runs/{id}")
    public ResponseEntity<Void> deleteRun(@PathVariable Long id) {
        if (fetchRunRepository.existsById(id)) {
            fetchRunRepository.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/cron")
    public ResponseEntity<CronConfig> getCronConfig() {
        return ResponseEntity.ok(executionService.getOrCreateCronConfig());
    }

    @PutMapping("/cron")
    public ResponseEntity<CronConfig> updateCronConfig(@RequestBody CronConfig incoming) {
        CronConfig cfg = executionService.getOrCreateCronConfig();
        cfg.setEnabled(Boolean.TRUE.equals(incoming.getEnabled()));
        if (incoming.getCronTime() != null && !incoming.getCronTime().isBlank()) {
            cfg.setCronTime(incoming.getCronTime().trim());
        }
        if (incoming.getMatchMode() != null) {
            cfg.setMatchMode(incoming.getMatchMode());
        }
        cfg.setEndpointIds(incoming.getEndpointIds() != null ? incoming.getEndpointIds() : "");
        cfg.setCategoryIds(incoming.getCategoryIds() != null ? incoming.getCategoryIds() : "");
        cfg.setRecipientEmails(incoming.getRecipientEmails() != null ? incoming.getRecipientEmails() : "");
        cfg.setSmtpHost(incoming.getSmtpHost() != null ? incoming.getSmtpHost().trim() : "");
        cfg.setSmtpPort(incoming.getSmtpPort() != null ? incoming.getSmtpPort() : 587);
        cfg.setSmtpUsername(incoming.getSmtpUsername() != null ? incoming.getSmtpUsername().trim() : "");
        cfg.setSmtpPassword(incoming.getSmtpPassword() != null ? incoming.getSmtpPassword() : "");

        return ResponseEntity.ok(cronConfigRepository.save(cfg));
    }

    @PostMapping("/cron/trigger")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> triggerCronNow() {
        return ResponseEntity.ok(executionService.executeCronJobNow());
    }

    @PostMapping("/runs/export")
    public ResponseEntity<TenderExecutionService.ExcelExportResult> exportRunsToExcel(
            @RequestBody ExportRunsRequest request
    ) throws Exception {
        if (request.runIds() == null || request.runIds().isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        return ResponseEntity.ok(executionService.generateExcelForRuns(request.runIds()));
    }

    @PostMapping("/runs/email")
    public ResponseEntity<TenderExecutionService.EmailDispatchResult> sendRunsByEmail(
            @RequestBody SendRunsEmailRequest request
    ) throws Exception {
        if (request.runIds() == null || request.runIds().isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        List<String> emails = executionService.parseEmails(request.emails());
        if (emails.isEmpty()) {
            throw new IllegalArgumentException("Podaj przynajmniej jeden poprawny adres e-mail.");
        }
        return ResponseEntity.ok(executionService.sendRunsToEmails(
                request.runIds(),
                emails,
                "Raport przetargow z wybranych pobran"
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorMessage> handleError(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
    public record ExportRunsRequest(List<Long> runIds) {}
    public record SendRunsEmailRequest(List<Long> runIds, String emails) {}
    public record FetchRunDto(
            Long id,
            String sourceType,
            String sourcesSummary,
            Integer totalFetched,
            Integer savedCount,
            Integer excludedCount,
            Integer zeroScoreCount,
            OffsetDateTime createdAt
    ) {}
}