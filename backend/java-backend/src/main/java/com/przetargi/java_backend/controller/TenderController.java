package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/tenders")
public class TenderController {

    private final TenderRepository tenderRepository;

    public TenderController(TenderRepository tenderRepository) {
        this.tenderRepository = tenderRepository;
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

    @PatchMapping("/{id}/status")
    public ResponseEntity<Tender> updateStatus(
            @PathVariable Long id,
            @RequestBody StatusUpdateRequest request
    ) {
        return tenderRepository.findById(id)
                .map(tender -> {
                    if (request.status() != null) {
                        tender.setStatus(request.status());
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
}