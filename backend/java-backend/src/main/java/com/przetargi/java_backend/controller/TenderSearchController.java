package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.service.ApiEndpointService;
import com.przetargi.java_backend.service.CurrentUserService;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
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
    private final CurrentUserService currentUserService;

    public TenderSearchController(
            ApiEndpointService endpointService,
            TenderExecutionService executionService,
            CurrentUserService currentUserService
    ) {
        this.endpointService = endpointService;
        this.executionService = executionService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/sources")
    public ResponseEntity<List<ApiEndpointDto>> getAvailableSources() {
        return ResponseEntity.ok(endpointService.getAll());
    }

    @PostMapping("/run")
    public ResponseEntity<TenderExecutionService.ExecutionSummary> runSearch(
            @RequestBody SearchRunRequest request,
            Authentication auth
    ) {
        Long ownerUserId = auth != null
                ? currentUserService.requireByUsername(auth.getName()).getId()
                : currentUserService.requireCurrentUser().getId();
        String activeQuery = Boolean.TRUE.equals(request.useCategoryQuery())
                ? request.categoryQuery()
                : null;
        return ResponseEntity.ok(executionService.executeSearch(
                request.endpointIds(),
                request.keywordCategoryIds(),
                request.matchMode(),
                request.categoryMatchModes(),
                activeQuery,
                "MANUAL",
                ownerUserId
        ));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorMessage> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}

    public record SearchRunRequest(
            List<Long> endpointIds,
            List<Long> keywordCategoryIds,
            String matchMode,
            Map<Long, String> categoryMatchModes,
            String categoryQuery,
            Boolean useCategoryQuery
    ) {}
}
