package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.service.ApiEndpointService;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
public class TenderSearchController {

    private final ApiEndpointService endpointService;
    private final TenderExecutionService executionService;

    public TenderSearchController(
            ApiEndpointService endpointService,
            TenderExecutionService executionService
    ) {
        this.endpointService = endpointService;
        this.executionService = executionService;
    }

    @GetMapping("/sources")
    public ResponseEntity<List<ApiEndpointDto>> getAvailableSources() {
        return ResponseEntity.ok(endpointService.getAll());
    }

    @PostMapping("/run")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> runSearch(
            @RequestBody SearchRunRequest request
    ) {
        return ResponseEntity.ok(executionService.executeSearch(
                request.endpointIds(),
                request.keywordCategoryIds(),
                request.matchMode(),
                request.categoryMatchModes(),
                "MANUAL"
        ));
    }

    public record SearchRunRequest(
            List<Long> endpointIds,
            List<Long> keywordCategoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes
    ) {}
}
