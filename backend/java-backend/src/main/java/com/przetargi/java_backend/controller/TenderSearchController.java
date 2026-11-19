package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
public class TenderSearchController {

    private final ApiEndpointRepository endpointRepository;
    private final TenderExecutionService executionService;

    public TenderSearchController(
            ApiEndpointRepository endpointRepository,
            TenderExecutionService executionService
    ) {
        this.endpointRepository = endpointRepository;
        this.executionService = executionService;
    }

    @GetMapping("/sources")
    public ResponseEntity<List<ApiEndpointDto>> getAvailableSources() {
        List<ApiEndpointDto> list = new ArrayList<>();
        for (ApiEndpoint ep : endpointRepository.findAll()) {
            list.add(ApiEndpointDto.fromEntity(ep));
        }
        return ResponseEntity.ok(list);
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