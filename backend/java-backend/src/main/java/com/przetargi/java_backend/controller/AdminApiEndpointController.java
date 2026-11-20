package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.service.TenderExecutionService;
import org.springframework.data.domain.Sort;
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

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@RestController
@RequestMapping("/api/admin/endpoints")
public class AdminApiEndpointController {

    private final ApiEndpointRepository endpointRepository;
    private final TenderExecutionService executionService;

    public AdminApiEndpointController(
            ApiEndpointRepository endpointRepository,
            TenderExecutionService executionService
    ) {
        this.endpointRepository = endpointRepository;
        this.executionService = executionService;
    }

    @GetMapping
    public ResponseEntity<List<ApiEndpointDto>> getAllEndpoints() {
        List<ApiEndpointDto> result = endpointRepository
                .findAll(Sort.by(Sort.Direction.ASC, "id"))
                .stream()
                .map(ApiEndpointDto::fromEntity)
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<ApiEndpointDto> createEndpoint(@RequestBody EndpointRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Nazwa endpointu jest wymagana.");
        }
        if (request.url() == null || request.url().isBlank()) {
            throw new IllegalArgumentException("Adres URL endpointu jest wymagany.");
        }

        ApiEndpoint endpoint = new ApiEndpoint();
        endpoint.setName(request.name().trim());
        endpoint.setUrl(request.url().trim());
        endpoint.setHttpMethod(request.httpMethod() != null && !request.httpMethod().isBlank()
                ? request.httpMethod().trim().toUpperCase()
                : "GET");
        endpoint.setPayload(request.payload() != null && !request.payload().isBlank()
                ? request.payload().trim()
                : null);
        endpoint.setLinkTemplate(request.linkTemplate() != null && !request.linkTemplate().isBlank()
                ? request.linkTemplate().trim()
                : null);
        endpoint.setNotes(request.notes() != null && !request.notes().isBlank()
                ? request.notes().trim()
                : null);
        endpoint.setIsActive(request.isActive() != null ? request.isActive() : true);

        ApiEndpoint saved = endpointRepository.save(endpoint);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiEndpointDto.fromEntity(saved));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiEndpointDto> updateEndpoint(
            @PathVariable Long id,
            @RequestBody EndpointRequest request
    ) {
        ApiEndpoint endpoint = endpointRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        if (request.name() != null && !request.name().isBlank()) {
            endpoint.setName(request.name().trim());
        }
        if (request.url() != null && !request.url().isBlank()) {
            endpoint.setUrl(request.url().trim());
        }
        if (request.httpMethod() != null && !request.httpMethod().isBlank()) {
            endpoint.setHttpMethod(request.httpMethod().trim().toUpperCase());
        }
        if (request.payload() != null) {
            endpoint.setPayload(request.payload().isBlank() ? null : request.payload().trim());
        }
        if (request.linkTemplate() != null) {
            endpoint.setLinkTemplate(request.linkTemplate().isBlank() ? null : request.linkTemplate().trim());
        }
        if (request.notes() != null) {
            endpoint.setNotes(request.notes().isBlank() ? null : request.notes().trim());
        }
        if (request.isActive() != null) {
            endpoint.setIsActive(request.isActive());
        }

        ApiEndpoint saved = endpointRepository.save(endpoint);
        return ResponseEntity.ok(ApiEndpointDto.fromEntity(saved));
    }

    @PatchMapping("/{id}/notes")
    public ResponseEntity<ApiEndpointDto> updateEndpointNotes(
            @PathVariable Long id,
            @RequestBody NotesRequest request
    ) {
        ApiEndpoint endpoint = endpointRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        endpoint.setNotes(request.notes() != null && !request.notes().isBlank()
                ? request.notes().trim()
                : null);
        return ResponseEntity.ok(ApiEndpointDto.fromEntity(endpointRepository.save(endpoint)));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ApiEndpointDto> toggleActive(@PathVariable Long id) {
        ApiEndpoint endpoint = endpointRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        endpoint.setIsActive(!Boolean.TRUE.equals(endpoint.getIsActive()));
        return ResponseEntity.ok(ApiEndpointDto.fromEntity(endpointRepository.save(endpoint)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEndpoint(@PathVariable Long id) {
        if (endpointRepository.existsById(id)) {
            endpointRepository.deleteById(id);
        }
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<TestConnectionResponse> testEndpoint(@PathVariable Long id) {
        ApiEndpoint ep = endpointRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        String resolvedUrl = executionService.resolveDynamicTokens(ep.getUrl());
        String resolvedPayload = executionService.resolveDynamicTokens(ep.getPayload());

        try {
            if ("SCRAPER".equalsIgnoreCase(ep.getHttpMethod())) {
                String msg = executionService.testScraperConnection(ep);
                return ResponseEntity.ok(new TestConnectionResponse(true, 200, resolvedUrl, msg));
            }

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(15))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(resolvedUrl))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("User-Agent", "TenderSearchEngine/1.0");

            if ("POST".equalsIgnoreCase(ep.getHttpMethod())) {
                String body = (resolvedPayload != null && !resolvedPayload.isBlank()) ? resolvedPayload : "{}";
                reqBuilder.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body));
            } else {
                reqBuilder.GET();
            }

            HttpResponse<String> response = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            String rawBody = response.body() != null ? response.body().trim() : "";
            String preview = rawBody.length() > 600 ? rawBody.substring(0, 600) + "..." : rawBody;

            if (status >= 200 && status < 300) {
                String msg = "Połączenie udane (HTTP " + status + ").\n"
                        + "Wywołany URL: " + resolvedUrl
                        + (preview.isEmpty() ? "" : "\n\nPodgląd odpowiedzi:\n" + preview);
                return ResponseEntity.ok(new TestConnectionResponse(true, status, resolvedUrl, msg));
            } else {
                String msg = "Błąd HTTP " + status + " dla URL: " + resolvedUrl
                        + (preview.isEmpty() ? "" : "\n\nOdpowiedź serwera:\n" + preview);
                return ResponseEntity.badRequest().body(new TestConnectionResponse(false, status, resolvedUrl, msg));
            }
        } catch (Exception e) {
            String errMsg = "Błąd połączenia (" + e.getClass().getSimpleName() + "): "
                    + (e.getMessage() != null ? e.getMessage() : "brak szczegółów")
                    + "\nURL: " + resolvedUrl;
            return ResponseEntity.badRequest().body(new TestConnectionResponse(false, null, resolvedUrl, errMsg));
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<TestConnectionResponse> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new TestConnectionResponse(false, 400, null, ex.getMessage()));
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

    public record TestConnectionResponse(
            boolean success,
            Integer statusCode,
            String resolvedUrl,
            String message
    ) {}
}