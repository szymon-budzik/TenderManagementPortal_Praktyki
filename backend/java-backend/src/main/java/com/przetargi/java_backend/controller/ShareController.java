package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.*;
import com.przetargi.java_backend.service.ShareService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shares")
public class ShareController {

    private final ShareService shareService;

    public ShareController(ShareService shareService) {
        this.shareService = shareService;
    }

    @GetMapping("/peers")
    public List<SharePeerDto> getEligiblePeers(Authentication auth) {
        return shareService.getEligiblePeers(auth.getName());
    }

    @GetMapping("/tenders")
    public List<SharedTenderDto> getReceivedTenders(Authentication auth) {
        return shareService.getReceivedTenders(auth.getName());
    }

    @GetMapping("/tenders/badge")
    public SharedBadgeDto getBadge(Authentication auth) {
        return shareService.getBadge(auth.getName());
    }

    @PostMapping("/tenders")
    public ResponseEntity<ShareActionResultDto> shareTenders(
            Authentication auth,
            @RequestBody ShareTendersRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shareService.shareTenders(auth.getName(), request));
    }

    @PatchMapping("/tenders/read-all")
    public ResponseEntity<Void> markAllRead(Authentication auth) {
        shareService.markAllTendersRead(auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/tenders/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, Authentication auth) {
        shareService.markTenderRead(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/tenders/{id}")
    public ResponseEntity<Void> deleteReceivedTender(@PathVariable Long id, Authentication auth) {
        shareService.deleteReceivedTender(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tenders/report")
    public ResponseEntity<CreatedReportDto> createReportFromShared(
            Authentication auth,
            @RequestBody CreateSharedReportRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(shareService.createReportFromShared(auth.getName(), request));
    }

    @PostMapping("/reports")
    public ResponseEntity<ShareActionResultDto> shareReports(
            Authentication auth,
            @RequestBody ShareReportsRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shareService.shareReports(auth.getName(), request));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ErrorMessage> handleError(RuntimeException ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
}
