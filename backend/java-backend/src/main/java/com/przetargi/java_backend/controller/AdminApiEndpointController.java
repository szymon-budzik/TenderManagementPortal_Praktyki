package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.service.ApiEndpointService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/endpoints")
public class AdminApiEndpointController {

    private final ApiEndpointService endpointService;

    public AdminApiEndpointController(ApiEndpointService endpointService) {
        this.endpointService = endpointService;
    }

    @GetMapping
    public ResponseEntity<List<ApiEndpointDto>> getAllEndpoints() {
        return ResponseEntity.ok(endpointService.getAllOrdered());
    }

    @PostMapping
    public ResponseEntity<ApiEndpointDto> createEndpoint(@RequestBody EndpointRequest request) {
        ApiEndpointDto saved = endpointService.createEndpoint(
                request.name(),
                request.url(),
                request.httpMethod(),
                request.payload(),
                request.linkTemplate(),
                request.notes(),
                request.isActive()
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiEndpointDto> updateEndpoint(
            @PathVariable Long id,
            @RequestBody EndpointRequest request
    ) {
        ApiEndpointDto saved = endpointService.updateEndpoint(
                id,
                request.name(),
                request.url(),
                request.httpMethod(),
                request.payload(),
                request.linkTemplate(),
                request.notes(),
                request.isActive()
        );
        return ResponseEntity.ok(saved);
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<ApiEndpointDto> updateEndpointNotes(
            @PathVariable Long id,
            @RequestBody NotesRequest request
    ) {
        return ResponseEntity.ok(endpointService.updateEndpointNotes(id, request.notes()));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ApiEndpointDto> toggleActive(@PathVariable Long id) {
        return ResponseEntity.ok(endpointService.toggleActive(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEndpoint(@PathVariable Long id) {
        endpointService.deleteIfExists(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<ApiEndpointService.TestConnectionResult> testEndpoint(@PathVariable Long id) {
        ApiEndpointService.TestConnectionResult result = endpointService.testEndpointConnection(id);
        return result.success()
                ? ResponseEntity.ok(result)
                : ResponseEntity.badRequest().body(result);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiEndpointService.TestConnectionResult> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new ApiEndpointService.TestConnectionResult(false, 400, null, ex.getMessage()));
    }

    public record EndpointRequest(
            String name,
            String url,
            String httpMethod,
            String payload,
            String linkTemplate,
            String notes,
            Boolean isActive
    ) {}

    public record NotesRequest(String notes) {}
}
