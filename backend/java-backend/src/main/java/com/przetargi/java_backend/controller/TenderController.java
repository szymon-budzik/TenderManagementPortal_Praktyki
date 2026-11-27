package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.CreatedReportDto;
import com.przetargi.java_backend.dto.ObservedBadgeDto;
import com.przetargi.java_backend.dto.ObservedTenderDto;
import com.przetargi.java_backend.dto.TenderResponseDto;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.service.TenderExecutionService;
import com.przetargi.java_backend.service.TenderService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tenders")
public class TenderController {

    private final TenderService tenderService;

    public TenderController(TenderService tenderService) {
        this.tenderService = tenderService;
    }

    @GetMapping
    public ResponseEntity<Page<TenderResponseDto>> getTenders(
            @RequestParam(required = false) TenderStatus status,
            @RequestParam(required = false) Integer minScore,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "publicationDate", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(tenderService.getTendersPage(status, minScore, search, pageable));
    }

    @GetMapping("/observed")
    public ResponseEntity<List<ObservedTenderDto>> getObservedTenders() {
        return ResponseEntity.ok(tenderService.getObservedTenders());
    }

    @GetMapping("/observed/badge")
    public ResponseEntity<ObservedBadgeDto> getObservedBadge() {
        return ResponseEntity.ok(tenderService.getObservedBadge());
    }

    @PostMapping("/observed/check-updates")
    public ResponseEntity<TenderExecutionService.ObservedCheckSummary> checkObservedUpdates() {
        return ResponseEntity.ok(tenderService.checkObservedUpdates());
    }

    @PostMapping("/observed/report")
    public ResponseEntity<CreatedReportDto> createObservedReport(
            @RequestBody CreateObservedReportRequest request
    ) {
        return ResponseEntity.ok(tenderService.createObservedReport(
                request.tenderIds(),
                request.updateIds(),
                request.reportName()
        ));
    }

    @PatchMapping("/{id}/updates/read")
    public ResponseEntity<Void> markTenderUpdatesRead(@PathVariable Long id) {
        return tenderService.markTenderUpdatesRead(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PatchMapping("/{id}/deadline")
    public ResponseEntity<TenderResponseDto> updateDeadline(
            @PathVariable Long id,
            @RequestBody DeadlineUpdateRequest request
    ) {
        return tenderService.updateDeadline(id, request.submissionDeadline())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/updates/{updateId}")
    public ResponseEntity<Void> deleteUpdate(@PathVariable Long updateId) {
        return tenderService.deleteUpdate(updateId)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<TenderResponseDto> updateStatus(
            @PathVariable Long id,
            @RequestBody StatusUpdateRequest request
    ) {
        return tenderService.updateStatus(id, request.status())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTender(@PathVariable Long id) {
        return tenderService.deleteTender(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorMessage> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ErrorMessage(ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorMessage> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
    public record StatusUpdateRequest(TenderStatus status) {}
    public record DeadlineUpdateRequest(String submissionDeadline) {}
    public record CreateObservedReportRequest(List<Long> tenderIds, List<Long> updateIds, String reportName) {}
}
