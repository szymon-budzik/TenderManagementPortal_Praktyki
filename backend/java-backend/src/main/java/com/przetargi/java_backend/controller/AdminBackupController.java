package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.service.BackupService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/backup")
public class AdminBackupController {

    private final BackupService backupService;

    public AdminBackupController(BackupService backupService) {
        this.backupService = backupService;
    }

    @GetMapping("/export")
    public ResponseEntity<BackupService.ConfigBackupDto> exportConfig() {
        return ResponseEntity.ok(backupService.exportConfig());
    }

    @PostMapping("/import")
    public ResponseEntity<BackupService.ImportSummaryDto> importConfig(
            @RequestBody BackupService.ConfigImportRequest request
    ) {
        return ResponseEntity.ok(backupService.importConfig(request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorDto> handleError(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorDto(ex.getMessage()));
    }

    public record ErrorDto(String message) {}
}
