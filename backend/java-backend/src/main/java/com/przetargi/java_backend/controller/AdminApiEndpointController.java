package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.service.ApiEndpointService;
import com.przetargi.java_backend.service.TenderExecutionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
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

    private final ApiEndpointService service;
    private final ApiEndpointRepository repository;
    private final TenderExecutionService executionService;

    public AdminApiEndpointController(
            ApiEndpointService service,
            ApiEndpointRepository repository,
            TenderExecutionService executionService
    ) {
        this.service = service;
        this.repository = repository;
        this.executionService = executionService;
    }

    @GetMapping
    public ResponseEntity<List<ApiEndpointDto>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @PostMapping
    public ResponseEntity<ApiEndpointDto> create(@Valid @RequestBody ApiEndpointDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiEndpointDto> update(@PathVariable Long id, @RequestBody ApiEndpointDto dto) {
        return ResponseEntity.ok(service.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    public ResponseEntity<TestResult> testConnection(@PathVariable Long id) {
        ApiEndpoint ep = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono źródła o ID: " + id));

        long start = System.currentTimeMillis();
        try {
            if ("SCRAPER".equalsIgnoreCase(ep.getHttpMethod())) {
                String msg = executionService.testScraperConnection(ep);
                long elapsed = System.currentTimeMillis() - start;
                return ResponseEntity.ok(new TestResult(true, 200, elapsed, msg + " (" + elapsed + " ms)"));
            }

            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .build();

            HttpRequest.Builder reqBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(ep.getUrl()))
                    .timeout(Duration.ofSeconds(12))
                    .header("Accept", "application/json")
                    .header("User-Agent", "TenderPlatform/1.0");

            if ("POST".equalsIgnoreCase(ep.getHttpMethod())) {
                String body = (ep.getPayload() != null && !ep.getPayload().isBlank()) ? ep.getPayload() : "{}";
                reqBuilder.header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body));
            } else {
                reqBuilder.GET();
            }

            HttpResponse<String> response = client.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            long elapsed = System.currentTimeMillis() - start;
            boolean ok = response.statusCode() >= 200 && response.statusCode() < 300;

            return ResponseEntity.ok(new TestResult(
                    ok,
                    response.statusCode(),
                    elapsed,
                    ok
                            ? "Połączenie udane! Serwer odpowiedział kodem HTTP " + response.statusCode() + " w " + elapsed + " ms."
                            : "Serwer odpowiedział błędem HTTP " + response.statusCode() + " (" + elapsed + " ms)."
            ));
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            return ResponseEntity.ok(new TestResult(
                    false,
                    0,
                    elapsed,
                    "Błąd połączenia z " + ep.getUrl() + ": " + e.getMessage()
            ));
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleError(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse(ex.getMessage()));
    }

    public record ErrorResponse(String message) {}
    public record TestResult(boolean success, int statusCode, long responseTimeMs, String message) {}
}