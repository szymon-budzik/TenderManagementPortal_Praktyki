package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import com.przetargi.java_backend.service.TenderExecutionService;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tenders")
public class TenderController {

    private final TenderRepository tenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final TenderExecutionService executionService;

    public TenderController(
            TenderRepository tenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            TenderExecutionService executionService
    ) {
        this.tenderRepository = tenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.executionService = executionService;
    }

    @GetMapping
    public ResponseEntity<Page<Tender>> getTenders(
            @RequestParam(required = false) TenderStatus status,
            @RequestParam(required = false) Integer minScore,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 20, sort = "publicationDate", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        Specification<Tender> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (minScore != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("score"), minScore));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate titleMatch = cb.like(cb.lower(root.get("title")), pattern);
                Predicate descMatch = cb.like(cb.lower(root.get("description")), pattern);
                predicates.add(cb.or(titleMatch, descMatch));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return ResponseEntity.ok(tenderRepository.findAll(spec, pageable));
    }

    @GetMapping("/observed")
    public ResponseEntity<List<ObservedTenderDto>> getObservedTenders() {
        List<Tender> observed = tenderRepository.findByStatusOrderByIdAsc(TenderStatus.INTERESTED);
        if (observed.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        // Dla starszych przetargów (pobranych przed V12) spróbuj jednorazowo uzupełnić termin z opisu
        for (Tender t : observed) {
            if (t.getSubmissionDeadline() == null && t.getDescription() != null) {
                OffsetDateTime extracted = executionService.extractDeadlineFromDescription(t.getDescription());
                if (extracted != null) {
                    t.setSubmissionDeadline(extracted);
                    tenderRepository.save(t);
                }
            }
        }

        List<Long> ids = observed.stream().map(Tender::getId).toList();
        List<TenderUpdate> allUpdates = tenderUpdateRepository.findByTenderIdInOrderByVersionNumberDesc(ids);

        Map<Long, List<TenderUpdate>> updatesByTender = new LinkedHashMap<>();
        for (TenderUpdate u : allUpdates) {
            updatesByTender.computeIfAbsent(u.getTenderId(), k -> new ArrayList<>()).add(u);
        }

        List<ObservedTenderDto> result = new ArrayList<>();
        for (Tender t : observed) {
            List<TenderUpdate> tenderUpdates = updatesByTender.getOrDefault(t.getId(), List.of());
            OffsetDateTime effectiveDeadline = t.getSubmissionDeadline();
            for (TenderUpdate u : tenderUpdates) {
                if (u.getSubmissionDeadline() != null) {
                    effectiveDeadline = u.getSubmissionDeadline();
                    break;
                }
            }
            long unreadCount = tenderUpdates.stream()
                    .filter(u -> !Boolean.TRUE.equals(u.getIsRead()))
                    .count();
            result.add(new ObservedTenderDto(t, tenderUpdates, effectiveDeadline, unreadCount));
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/observed/badge")
    public ResponseEntity<ObservedBadgeDto> getObservedBadge() {
        long observedCount = tenderRepository.countByStatus(TenderStatus.INTERESTED);
        long unreadTendersCount = tenderRepository.countByStatusAndHasUnreadUpdateTrue(TenderStatus.INTERESTED);
        return ResponseEntity.ok(new ObservedBadgeDto(observedCount, unreadTendersCount));
    }

    @PostMapping("/observed/check-updates")
    public ResponseEntity<TenderExecutionService.ObservedCheckSummary> checkObservedUpdates() {
        return ResponseEntity.ok(executionService.checkUpdatesForObservedTenders());
    }

    @PostMapping("/observed/report")
    public ResponseEntity<CreatedReportDto> createObservedReport(
            @RequestBody CreateObservedReportRequest request
    ) {
        FetchRun run = executionService.createReportFromObserved(
                request.tenderIds(),
                request.updateIds(),
                request.reportName()
        );
        return ResponseEntity.ok(new CreatedReportDto(
                run.getId(),
                run.getSourceType(),
                run.getSavedCount(),
                "Utworzono raport #" + run.getId() + " (" + run.getSavedCount() + " poz.) — jest już dostępny w zakładce Raporty."
        ));
    }

    @PatchMapping("/{id}/updates/read")
    public ResponseEntity<Void> markTenderUpdatesRead(@PathVariable Long id) {
        Tender tender = tenderRepository.findById(id).orElse(null);
        if (tender == null) {
            return ResponseEntity.notFound().build();
        }
        List<TenderUpdate> unread = tenderUpdateRepository.findByTenderIdAndIsReadFalse(id);
        for (TenderUpdate u : unread) {
            u.setIsRead(true);
        }
        if (!unread.isEmpty()) {
            tenderUpdateRepository.saveAll(unread);
        }
        tender.setHasUnreadUpdate(false);
        tenderRepository.save(tender);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/deadline")
    public ResponseEntity<Tender> updateDeadline(
            @PathVariable Long id,
            @RequestBody DeadlineUpdateRequest request
    ) {
        return tenderRepository.findById(id)
                .map(tender -> {
                    if (request.submissionDeadline() == null || request.submissionDeadline().isBlank()) {
                        tender.setSubmissionDeadline(null);
                    } else {
                        OffsetDateTime parsed = executionService.parseFlexibleDateTime(request.submissionDeadline());
                        if (parsed == null) {
                            throw new IllegalArgumentException("Niepoprawny format daty terminu składania ofert.");
                        }
                        tender.setSubmissionDeadline(parsed);
                    }
                    return ResponseEntity.ok(tenderRepository.save(tender));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/updates/{updateId}")
    public ResponseEntity<Void> deleteUpdate(@PathVariable Long updateId) {
        TenderUpdate update = tenderUpdateRepository.findById(updateId).orElse(null);
        if (update == null) {
            return ResponseEntity.notFound().build();
        }
        Long tenderId = update.getTenderId();
        tenderUpdateRepository.deleteById(updateId);

        tenderRepository.findById(tenderId).ifPresent(tender -> {
            boolean stillHasUnread = !tenderUpdateRepository.findByTenderIdAndIsReadFalse(tenderId).isEmpty();
            tender.setHasUnreadUpdate(stillHasUnread);
            tenderRepository.save(tender);
        });
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Tender> updateStatus(
            @PathVariable Long id,
            @RequestBody StatusUpdateRequest request
    ) {
        return tenderRepository.findById(id)
                .map(tender -> {
                    if (request.status() != null) {
                        tender.setStatus(request.status());
                        if (request.status() == TenderStatus.INTERESTED
                                && tender.getSubmissionDeadline() == null
                                && tender.getDescription() != null) {
                            OffsetDateTime extracted = executionService.extractDeadlineFromDescription(tender.getDescription());
                            if (extracted != null) {
                                tender.setSubmissionDeadline(extracted);
                            }
                        }
                    }
                    return ResponseEntity.ok(tenderRepository.save(tender));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTender(@PathVariable Long id) {
        if (!tenderRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tenderRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    public record StatusUpdateRequest(TenderStatus status) {}
    public record DeadlineUpdateRequest(String submissionDeadline) {}
    public record CreateObservedReportRequest(List<Long> tenderIds, List<Long> updateIds, String reportName) {}
    public record CreatedReportDto(Long runId, String sourceType, Integer itemsCount, String message) {}
    public record ObservedBadgeDto(long observedCount, long unreadCount) {}
    public record ObservedTenderDto(
            Tender tender,
            List<TenderUpdate> updates,
            OffsetDateTime effectiveDeadline,
            long unreadUpdatesCount
    ) {}
}