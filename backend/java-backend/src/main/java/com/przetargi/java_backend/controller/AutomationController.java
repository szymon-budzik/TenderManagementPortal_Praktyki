package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.HttpStatus;
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
    private final AutomationProfileRepository profileRepository;
    private final SmtpAccountRepository smtpAccountRepository;

    public AutomationController(
            TenderExecutionService executionService,
            FetchRunRepository fetchRunRepository,
            AutomationProfileRepository profileRepository,
            SmtpAccountRepository smtpAccountRepository
    ) {
        this.executionService = executionService;
        this.fetchRunRepository = fetchRunRepository;
        this.profileRepository = profileRepository;
        this.smtpAccountRepository = smtpAccountRepository;
    }

    // --- KONFIGURACJE SERWERÓW SMTP (WIELE KONT) ---

    @GetMapping("/smtp-accounts")
    public ResponseEntity<List<SmtpAccount>> getSmtpAccounts() {
        return ResponseEntity.ok(smtpAccountRepository.findAllByOrderByIdAsc());
    }

    @PostMapping("/smtp-accounts")
    public ResponseEntity<SmtpAccount> createSmtpAccount(@RequestBody SmtpAccount incoming) {
        SmtpAccount acc = new SmtpAccount();
        acc.setName(incoming.getName() != null ? incoming.getName().trim() : "Serwer SMTP");
        acc.setSmtpHost(incoming.getSmtpHost() != null ? incoming.getSmtpHost().trim() : "");
        acc.setSmtpPort(incoming.getSmtpPort() != null ? incoming.getSmtpPort() : 587);
        acc.setSmtpUsername(incoming.getSmtpUsername() != null ? incoming.getSmtpUsername().trim() : "");
        acc.setSmtpPassword(incoming.getSmtpPassword() != null ? incoming.getSmtpPassword() : "");
        return ResponseEntity.status(HttpStatus.CREATED).body(smtpAccountRepository.save(acc));
    }

    @PutMapping("/smtp-accounts/{id}")
    public ResponseEntity<SmtpAccount> updateSmtpAccount(
            @PathVariable Long id,
            @RequestBody SmtpAccount incoming
    ) {
        SmtpAccount acc = smtpAccountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono konta SMTP o ID: " + id));

        if (incoming.getName() != null) acc.setName(incoming.getName().trim());
        if (incoming.getSmtpHost() != null) acc.setSmtpHost(incoming.getSmtpHost().trim());
        if (incoming.getSmtpPort() != null) acc.setSmtpPort(incoming.getSmtpPort());
        if (incoming.getSmtpUsername() != null) acc.setSmtpUsername(incoming.getSmtpUsername().trim());
        if (incoming.getSmtpPassword() != null) acc.setSmtpPassword(incoming.getSmtpPassword());

        return ResponseEntity.ok(smtpAccountRepository.save(acc));
    }

    @DeleteMapping("/smtp-accounts/{id}")
    public ResponseEntity<Void> deleteSmtpAccount(@PathVariable Long id) {
        if (smtpAccountRepository.existsById(id)) {
            smtpAccountRepository.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    // --- PROFILE AUTOMATYZACJI ---

    @GetMapping("/profiles")
    public ResponseEntity<List<AutomationProfile>> getProfiles() {
        return ResponseEntity.ok(profileRepository.findAllByOrderByIdAsc());
    }

    @PostMapping("/profiles")
    public ResponseEntity<AutomationProfile> createProfile(@RequestBody AutomationProfile incoming) {
        if (incoming.getName() == null || incoming.getName().isBlank()) {
            throw new IllegalArgumentException("Nazwa profilu jest wymagana.");
        }
        AutomationProfile p = new AutomationProfile();
        p.setName(incoming.getName().trim());
        p.setEnabled(Boolean.TRUE.equals(incoming.getEnabled()));
        p.setScheduleType(incoming.getScheduleType() != null ? incoming.getScheduleType() : "DAILY");
        p.setCronTime(incoming.getCronTime() != null && !incoming.getCronTime().isBlank() ? incoming.getCronTime().trim() : "08:00");
        p.setIntervalMinutes(incoming.getIntervalMinutes() != null ? incoming.getIntervalMinutes() : 60);
        p.setCronDays(incoming.getCronDays() != null ? incoming.getCronDays() : "1,2,3,4,5");
        p.setSmtpAccountId(incoming.getSmtpAccountId());
        p.setMatchMode(incoming.getMatchMode() != null ? incoming.getMatchMode() : "ANY");
        p.setEndpointIds(incoming.getEndpointIds() != null ? incoming.getEndpointIds() : "");
        p.setCategoryIds(incoming.getCategoryIds() != null ? incoming.getCategoryIds() : "");
        p.setRecipientEmails(incoming.getRecipientEmails() != null ? incoming.getRecipientEmails().trim() : "");

        return ResponseEntity.status(HttpStatus.CREATED).body(profileRepository.save(p));
    }

    @PutMapping("/profiles/{id}")
    public ResponseEntity<AutomationProfile> updateProfile(
            @PathVariable Long id,
            @RequestBody AutomationProfile incoming
    ) {
        AutomationProfile p = profileRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + id));

        if (incoming.getName() != null && !incoming.getName().isBlank()) {
            p.setName(incoming.getName().trim());
        }
        if (incoming.getEnabled() != null) {
            p.setEnabled(incoming.getEnabled());
        }
        if (incoming.getScheduleType() != null) {
            p.setScheduleType(incoming.getScheduleType());
        }
        if (incoming.getCronTime() != null && !incoming.getCronTime().isBlank()) {
            p.setCronTime(incoming.getCronTime().trim());
        }
        if (incoming.getIntervalMinutes() != null) {
            p.setIntervalMinutes(incoming.getIntervalMinutes());
        }
        if (incoming.getCronDays() != null) {
            p.setCronDays(incoming.getCronDays());
        }
        p.setSmtpAccountId(incoming.getSmtpAccountId());

        if (incoming.getMatchMode() != null) {
            p.setMatchMode(incoming.getMatchMode());
        }
        if (incoming.getEndpointIds() != null) {
            p.setEndpointIds(incoming.getEndpointIds());
        }
        if (incoming.getCategoryIds() != null) {
            p.setCategoryIds(incoming.getCategoryIds());
        }
        if (incoming.getRecipientEmails() != null) {
            p.setRecipientEmails(incoming.getRecipientEmails().trim());
        }

        return ResponseEntity.ok(profileRepository.save(p));
    }

    @DeleteMapping("/profiles/{id}")
    public ResponseEntity<Void> deleteProfile(@PathVariable Long id) {
        if (profileRepository.existsById(id)) {
            profileRepository.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/profiles/{id}/trigger")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> triggerProfileNow(@PathVariable Long id) {
        return ResponseEntity.ok(executionService.executeProfileNow(id));
    }

    // --- HISTORIA POBRAŃ ---

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
                "Raport przetargow z wybranych pobran",
                request.smtpAccountId()
        ));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorMessage> handleError(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
    public record ExportRunsRequest(List<Long> runIds) {}
    public record SendRunsEmailRequest(List<Long> runIds, String emails, Long smtpAccountId) {}
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