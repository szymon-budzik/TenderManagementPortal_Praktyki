package com.przetargi.java_backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.przetargi.java_backend.dto.IngestResultDto;
import com.przetargi.java_backend.dto.TenderIngestRequest;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenderIngestionService {

    private final TenderRepository tenderRepository;
    private final TenderScoringService scoringService;

    @Transactional
    public IngestResultDto ingestBatch(List<TenderIngestRequest> requests) {
        int savedCount = 0;
        int duplicatesCount = 0;

        List<Tender> toSave = new ArrayList<>();

        for (TenderIngestRequest req : requests) {
            // Deduplikacja: pomijamy przetarg, jeśli jego identyfikator już istnieje w bazie
            if (tenderRepository.existsByExternalId(req.getExternalId())) {
                duplicatesCount++;
                continue;
            }

            int score = scoringService.calculateScore(req.getTitle(), req.getDescription());
            TenderStatus status = scoringService.determineStatus(score);

            Tender tender = Tender.builder()
                .externalId(req.getExternalId())
                .title(req.getTitle())
                .description(req.getDescription())
                .publicationDate(req.getPublicationDate())
                .score(score)
                .status(status)
                .build();

            toSave.add(tender);
            savedCount++;
        }

        if (!toSave.isEmpty()) {
            tenderRepository.saveAll(toSave);
        }

        log.info("Ingestion zakonczone. Zapisano: {}, Pominiete duplikaty: {}", savedCount, duplicatesCount);
        return new IngestResultDto(requests.size(), savedCount, duplicatesCount);
    }
}