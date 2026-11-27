package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.AutomationNotificationDto;
import com.przetargi.java_backend.dto.AutomationProfileDto;
import com.przetargi.java_backend.dto.AutomationProfileRequest;
import com.przetargi.java_backend.dto.FetchRunDto;
import com.przetargi.java_backend.dto.SmtpAccountDto;
import com.przetargi.java_backend.dto.SmtpAccountRequest;
import com.przetargi.java_backend.service.AutomationNotificationService;
import com.przetargi.java_backend.service.AutomationService;
import com.przetargi.java_backend.service.SmtpAccountService;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/automation")
public class AutomationController {

    private final SmtpAccountService smtpAccountService;
    private final AutomationService automationService;
    private final AutomationNotificationService notificationService;

    public AutomationController(
            SmtpAccountService smtpAccountService,
            AutomationService automationService,
            AutomationNotificationService notificationService
    ) {
        this.smtpAccountService = smtpAccountService;
        this.automationService = automationService;
        this.notificationService = notificationService;
    }

    // --- KONFIGURACJE SERWERÓW SMTP (WIELE KONT) ---

    @GetMapping("/smtp-accounts")
    public ResponseEntity<List<SmtpAccountDto>> getSmtpAccounts() {
        return ResponseEntity.ok(smtpAccountService.getAllAccounts());
    }

    @PostMapping("/smtp-accounts")
    public ResponseEntity<SmtpAccountDto> createSmtpAccount(@RequestBody SmtpAccountRequest incoming) {
        return ResponseEntity.status(HttpStatus.CREATED).body(smtpAccountService.createAccount(incoming));
    }

    @PutMapping("/smtp-accounts/{id}")
    public ResponseEntity<SmtpAccountDto> updateSmtpAccount(
            @PathVariable Long id,
            @RequestBody SmtpAccountRequest incoming
    ) {
        return ResponseEntity.ok(smtpAccountService.updateAccount(id, incoming));
    }

    @DeleteMapping("/smtp-accounts/{id}")
    public ResponseEntity<Void> deleteSmtpAccount(@PathVariable Long id) {
        smtpAccountService.deleteAccount(id);
        return ResponseEntity.noContent().build();
    }

    // --- PROFILE AUTOMATYZACJI ---

    @GetMapping("/profiles")
    public ResponseEntity<List<AutomationProfileDto>> getProfiles() {
        return ResponseEntity.ok(automationService.getProfiles());
    }

    @PostMapping("/profiles")
    public ResponseEntity<AutomationProfileDto> createProfile(@RequestBody AutomationProfileRequest incoming) {
        return ResponseEntity.status(HttpStatus.CREATED).body(automationService.createProfile(incoming));
    }

    @PutMapping("/profiles/{id}")
    public ResponseEntity<AutomationProfileDto> updateProfile(
            @PathVariable Long id,
            @RequestBody AutomationProfileRequest incoming
    ) {
        return ResponseEntity.ok(automationService.updateProfile(id, incoming));
    }

    @DeleteMapping("/profiles/{id}")
    public ResponseEntity<Void> deleteProfile(@PathVariable Long id) {
        automationService.deleteProfile(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/profiles/{id}/trigger")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> triggerProfileNow(@PathVariable Long id) {
        return ResponseEntity.ok(automationService.triggerProfileNow(id));
    }

    // --- HISTORIA POBRAŃ ---

    @GetMapping("/runs")
    public ResponseEntity<List<FetchRunDto>> getRuns(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(automationService.getRuns(username));
    }

    @DeleteMapping("/runs/{id}")
    public ResponseEntity<Void> deleteRun(@PathVariable Long id) {
        automationService.deleteRun(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/runs/export")
    public ResponseEntity<TenderExecutionService.ExcelExportResult> exportRunsToExcel(
            @RequestBody ExportRunsRequest request
    ) throws Exception {
        return ResponseEntity.ok(automationService.exportRunsToExcel(request.runIds()));
    }

    @PostMapping("/runs/email")
    public ResponseEntity<TenderExecutionService.EmailDispatchResult> sendRunsByEmail(
            @RequestBody SendRunsEmailRequest request
    ) throws Exception {
        return ResponseEntity.ok(automationService.sendRunsByEmail(
                request.runIds(),
                request.emails(),
                request.smtpAccountId()
        ));
    }

    // --- POWIADOMIENIA ---

    @GetMapping("/notifications")
    public ResponseEntity<List<AutomationNotificationDto>> getNotifications(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(notificationService.getLatestNotifications(username));
    }

    @PatchMapping("/notifications/{id}/read")
    public ResponseEntity<AutomationNotificationDto> markNotificationRead(
            @PathVariable Long id,
            Authentication auth
    ) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(notificationService.markAsRead(id, username));
    }

    @PatchMapping("/notifications/read-all")
    public ResponseEntity<Void> markAllNotificationsRead(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        notificationService.markAllAsRead(username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/notifications/{id}")
    public ResponseEntity<Void> deleteNotification(@PathVariable Long id, Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        notificationService.deleteNotification(id, username);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorMessage> handleError(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
    public record ExportRunsRequest(List<Long> runIds) {}
    public record SendRunsEmailRequest(List<Long> runIds, String emails, Long smtpAccountId) {}
}
