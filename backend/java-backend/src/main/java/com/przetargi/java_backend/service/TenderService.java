package com.przetargi.java_backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.przetargi.java_backend.dto.TenderResponseDto;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;
import com.przetargi.java_backend.repository.TenderSpecifications;

@Service
@RequiredArgsConstructor
public class TenderService {

    private final TenderRepository tenderRepository;

    @Transactional(readOnly = true)
    public Page<TenderResponseDto> getTenders(TenderStatus status, Integer minScore, String search, Pageable pageable) {
        Specification<Tender> spec = TenderSpecifications.withFilters(status, minScore, search);
        return tenderRepository.findAll(spec, pageable).map(TenderResponseDto::fromEntity);
    }

    @Transactional(readOnly = true)
    public TenderResponseDto getTenderById(Long id) {
        Tender tender = tenderRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono przetargu o ID: " + id));
        return TenderResponseDto.fromEntity(tender);
    }

    @Transactional
    public TenderResponseDto updateTenderStatus(Long id, TenderStatus newStatus) {
        Tender tender = tenderRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono przetargu o ID: " + id));
        tender.setStatus(newStatus);
        return TenderResponseDto.fromEntity(tenderRepository.save(tender));
    }
}