package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.CreatedReportDto;
import com.przetargi.java_backend.dto.ObservedBadgeDto;
import com.przetargi.java_backend.dto.ObservedTenderDto;
import com.przetargi.java_backend.dto.TenderResponseDto;
import com.przetargi.java_backend.dto.TenderUpdateDto;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.TenderUpdate;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderSpecifications;
import com.przetargi.java_backend.repository.TenderUpdateRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TenderService {

    private final TenderRepository tenderRepository;
    private final TenderUpdateRepository tenderUpdateRepository;
    private final TenderDateService dateService;
    private final ObservedTenderUpdateService observedUpdateService;
    private final ReportExportService reportExportService;

    public TenderService(
            TenderRepository tenderRepository,
            TenderUpdateRepository tenderUpdateRepository,
            TenderDateService dateService,
            ObservedTenderUpdateService observedUpdateService,
            ReportExportService reportExportService
    ) {
        this.tenderRepository = tenderRepository;
        this.tenderUpdateRepository = tenderUpdateRepository;
        this.dateService = dateService;
        this.observedUpdateService = observedUpdateService;
        this.reportExportService = reportExportService;
    }

    @Transactional(readOnly = true)
    public Page<TenderResponseDto> getTendersPage(TenderStatus status, Integer minScore, String search, Pageable pageable) {
        Specification<Tender> spec = TenderSpecifications.withFilters(status, minScore, search);
        return tenderRepository.findAll(spec, pageable).map(TenderResponseDto::fromEntity);
    }

    @Transactional
    public List<ObservedTenderDto> getObservedTenders() {
        List<Tender> observed = tenderRepository.findByStatusOrderByIdAsc(TenderStatus.INTERESTED);
        if (observed.isEmpty()) {
            return List.of();
        }

        // Dla starszych przetargów (pobranych przed V12) spróbuj jednorazowo uzupełnić termin z opisu
        for (Tender t : observed) {
            if (t.getSubmissionDeadline() == null && t.getDescription() != null) {
                OffsetDateTime extracted = dateService.extractDeadlineFromDescription(t.getDescription());
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
            List<TenderUpdateDto> updateDtos = tenderUpdates.stream()
                    .map(TenderUpdateDto::fromEntity)
                    .toList();
            result.add(new ObservedTenderDto(
                    TenderResponseDto.fromEntity(t),
                    updateDtos,
                    effectiveDeadline,
                    unreadCount
            ));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public ObservedBadgeDto getObservedBadge() {
        long observedCount = tenderRepository.countByStatus(TenderStatus.INTERESTED);
        long unreadTendersCount = tenderRepository.countByStatusAndHasUnreadUpdateTrue(TenderStatus.INTERESTED);
        return new ObservedBadgeDto(observedCount, unreadTendersCount);
    }

    public TenderExecutionService.ObservedCheckSummary checkObservedUpdates() {
        return observedUpdateService.checkUpdatesForObservedTenders();
    }

    @Transactional
    public CreatedReportDto createObservedReport(List<Long> tenderIds, List<Long> updateIds, String reportName) {
        FetchRun run = reportExportService.createReportFromObserved(tenderIds, updateIds, reportName);
        return new CreatedReportDto(
                run.getId(),
                run.getSourceType(),
                run.getSavedCount(),
                "Utworzono raport #" + run.getId() + " (" + run.getSavedCount() + " poz.) — jest już dostępny w zakładce Raporty."
        );
    }

    @Transactional
    public boolean markTenderUpdatesRead(Long id) {
        Tender tender = tenderRepository.findById(id).orElse(null);
        if (tender == null) {
            return false;
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
        return true;
    }

    @Transactional
    public Optional<TenderResponseDto> updateDeadline(Long id, String rawSubmissionDeadline) {
        return tenderRepository.findById(id).map(tender -> {
            if (rawSubmissionDeadline == null || rawSubmissionDeadline.isBlank()) {
                tender.setSubmissionDeadline(null);
            } else {
                OffsetDateTime parsed = dateService.parseFlexibleDateTime(rawSubmissionDeadline);
                if (parsed == null) {
                    throw new IllegalArgumentException("Niepoprawny format daty terminu składania ofert.");
                }
                tender.setSubmissionDeadline(parsed);
            }
            return TenderResponseDto.fromEntity(tenderRepository.save(tender));
        });
    }

    @Transactional
    public boolean deleteUpdate(Long updateId) {
        TenderUpdate update = tenderUpdateRepository.findById(updateId).orElse(null);
        if (update == null) {
            return false;
        }
        Long tenderId = update.getTenderId();
        tenderUpdateRepository.deleteById(updateId);

        tenderRepository.findById(tenderId).ifPresent(tender -> {
            boolean stillHasUnread = !tenderUpdateRepository.findByTenderIdAndIsReadFalse(tenderId).isEmpty();
            tender.setHasUnreadUpdate(stillHasUnread);
            tenderRepository.save(tender);
        });
        return true;
    }

    @Transactional
    public Optional<TenderResponseDto> updateStatus(Long id, TenderStatus status) {
        return tenderRepository.findById(id).map(tender -> {
            if (status != null) {
                tender.setStatus(status);
                if (status == TenderStatus.INTERESTED
                        && tender.getSubmissionDeadline() == null
                        && tender.getDescription() != null) {
                    OffsetDateTime extracted = dateService.extractDeadlineFromDescription(tender.getDescription());
                    if (extracted != null) {
                        tender.setSubmissionDeadline(extracted);
                    }
                }
            }
            return TenderResponseDto.fromEntity(tenderRepository.save(tender));
        });
    }

    @Transactional
    public boolean deleteTender(Long id) {
        if (!tenderRepository.existsById(id)) {
            return false;
        }
        tenderRepository.deleteById(id);
        return true;
    }
}
