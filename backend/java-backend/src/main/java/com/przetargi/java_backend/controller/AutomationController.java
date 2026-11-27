package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.AutomationNotificationDto;
import com.przetargi.java_backend.dto.AutomationProfileDto;
import com.przetargi.java_backend.dto.AutomationProfileRequest;
import com.przetargi.java_backend.dto.FetchRunDto;
import com.przetargi.java_backend.dto.ReportsBadgeDto;
import com.przetargi.java_backend.dto.SmtpAccountDto;
import com.przetargi.java_backend.dto.SmtpAccountRequest;
import com.przetargi.java_backend.service.AutomationNotificationService;
import com.przetargi.java_backend.service.AutomationService;
import com.przetargi.java_backend.service.SmtpAccountService;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
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
    public ResponseEntity<List<AutomationProfileDto>> getProfiles(Authentication auth) {
        return ResponseEntity.ok(automationService.getProfiles(auth != null ? auth.getName() : null));
    }

    @PostMapping("/profiles")
    public ResponseEntity<AutomationProfileDto> createProfile(
            @RequestBody AutomationProfileRequest incoming,
            Authentication auth
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(automationService.createProfile(incoming, auth != null ? auth.getName() : null));
    }

    @PutMapping("/profiles/{id}")
    public ResponseEntity<AutomationProfileDto> updateProfile(
            @PathVariable Long id,
            @RequestBody AutomationProfileRequest incoming,
            Authentication auth
    ) {
        return ResponseEntity.ok(automationService.updateProfile(id, incoming, auth != null ? auth.getName() : null));
    }

    @DeleteMapping("/profiles/{id}")
    public ResponseEntity<Void> deleteProfile(@PathVariable Long id, Authentication auth) {
        automationService.deleteProfile(id, auth != null ? auth.getName() : null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/profiles/{id}/trigger")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> triggerProfileNow(
            @PathVariable Long id,
            Authentication auth
    ) {
        return ResponseEntity.ok(automationService.triggerProfileNow(id, auth != null ? auth.getName() : null));
    }

    // --- HISTORIA POBRAŃ ---

    @GetMapping("/runs")
    public ResponseEntity<List<FetchRunDto>> getRuns(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(automationService.getRuns(username));
    }

    @GetMapping("/runs/badge")
    public ResponseEntity<ReportsBadgeDto> getReportsBadge(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(automationService.getReportsBadge(username));
    }

    @PatchMapping("/runs/read-all")
    public ResponseEntity<Void> markAllRunsRead(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        automationService.markAllRunsRead(username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/runs/{id}")
    public ResponseEntity<Void> deleteRun(@PathVariable Long id, Authentication auth) {
        automationService.deleteRun(id, auth != null ? auth.getName() : null);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/runs/export")
    public ResponseEntity<TenderExecutionService.ExcelExportResult> exportRunsToExcel(
            @RequestBody ExportRunsRequest request,
            Authentication auth
    ) throws Exception {
        return ResponseEntity.ok(automationService.exportRunsToExcel(
                request.runIds(),
                auth != null ? auth.getName() : null
        ));
    }

    @PostMapping("/runs/email")
    public ResponseEntity<TenderExecutionService.EmailDispatchResult> sendRunsByEmail(
            @RequestBody SendRunsEmailRequest request,
            Authentication auth
    ) throws Exception {
        return ResponseEntity.ok(automationService.sendRunsByEmail(
                request.runIds(),
                request.emails(),
                request.smtpAccountId(),
                auth != null ? auth.getName() : null
        ));
    }

    // --- POWIADOMIENIA ---

    @GetMapping("/notifications")
    public ResponseEntity<List<AutomationNotificationDto>> getNotifications(Authentication auth) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(notificationService.getLatestNotifications(username));
    }

    @GetMapping("/notifications/preferences")
    public ResponseEntity<AutomationNotificationService.NotificationPreferencesDto> getNotificationPreferences(
            Authentication auth
    ) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(notificationService.getNotificationPreferences(username));
    }

    @PatchMapping("/notifications/preferences")
    public ResponseEntity<AutomationNotificationService.NotificationPreferencesDto> updateNotificationPreferences(
            @RequestBody NotificationPreferencesRequest request,
            Authentication auth
    ) {
        String username = auth != null ? auth.getName() : null;
        return ResponseEntity.ok(notificationService.updateNotificationPreferences(
                username,
                request != null ? request.sharedTendersEnabled() : null,
                request != null ? request.sharedReportsEnabled() : null
        ));
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

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorMessage> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorMessage(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorMessage> handleError(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
    public record ExportRunsRequest(List<Long> runIds) {}
    public record SendRunsEmailRequest(List<Long> runIds, String emails, Long smtpAccountId) {}
    public record NotificationPreferencesRequest(Boolean sharedTendersEnabled, Boolean sharedReportsEnabled) {}
}
