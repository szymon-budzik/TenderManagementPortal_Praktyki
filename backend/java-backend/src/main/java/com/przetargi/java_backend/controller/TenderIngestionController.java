package com.przetargi.java_backend.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.dto.IngestResultDto;
import com.przetargi.java_backend.dto.TenderIngestRequest;
import com.przetargi.java_backend.service.ApiEndpointService;
import com.przetargi.java_backend.service.TenderIngestionService;

import java.util.List;

@RestController
@RequestMapping("/api/internal/tenders")
@RequiredArgsConstructor
public class TenderIngestionController {

    private final TenderIngestionService ingestionService;

    @PostMapping("/batch")
    public ResponseEntity<IngestResultDto> ingestTenders(
            @Valid @RequestBody List<TenderIngestRequest> requests) {
        IngestResultDto result = ingestionService.ingestBatch(requests);
        return ResponseEntity.ok(result);
    }

    private final ApiEndpointService apiEndpointService;

    @GetMapping("/active-sources")
    public ResponseEntity<List<ApiEndpointDto>> getActiveSources() {
        return ResponseEntity.ok(apiEndpointService.getActiveEndpoints());
    }

    @PostMapping("/sources/{id}/synced")
    public ResponseEntity<Void> markSourceSynced(@PathVariable Long id) {
        apiEndpointService.markSyncFinished(id);
        return ResponseEntity.ok().build();
    }
}