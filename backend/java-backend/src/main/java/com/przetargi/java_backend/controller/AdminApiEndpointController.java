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
                String selectorInfo = (ep.getPayload() != null && !ep.getPayload().isBlank())
                        ? ep.getPayload().trim()
                        : "(domyślny automatyczny selektor + tabele Pandas)";
                String details = "Tryb: SCRAPER (BeautifulSoup + Pandas)\n"
                        + "Docelowy URL: " + ep.getUrl() + "\n"
                        + "Selektor CSS: " + selectorInfo + "\n"
                        + "Wynik: " + msg;
                return ResponseEntity.ok(new TestResult(true, 200, elapsed, msg, details));
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
            int status = response.statusCode();
            boolean ok = status >= 200 && status < 300;
            String contentType = response.headers().firstValue("content-type").orElse("nieznany");
            String body = response.body() != null ? response.body().trim() : "";
            String bodySnippet = body.length() > 1000
                    ? body.substring(0, 1000) + "\n... [skrócono, łącznie " + body.length() + " znaków]"
                    : (body.isEmpty() ? "(pusta treść odpowiedzi)" : body);

            String message = ok
                    ? "Połączenie udane! Serwer odpowiedział kodem HTTP " + status + " w " + elapsed + " ms."
                    : "Serwer odrzucił żądanie kodem błędu HTTP " + status + " (" + elapsed + " ms).";

            String details = "Metoda: " + ep.getHttpMethod() + "\n"
                    + "Content-Type: " + contentType + "\n"
                    + "Rozmiar odpowiedzi: " + body.length() + " znaków\n\n"
                    + "--- Treść odpowiedzi serwera ---\n"
                    + bodySnippet;

            return ResponseEntity.ok(new TestResult(ok, status, elapsed, message, details));
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - start;
            String errType = e.getClass().getSimpleName();
            String errMsg = e.getMessage() != null ? e.getMessage() : "Brak szczegółowego komunikatu wyjątku";
            Throwable cause = e.getCause();
            StringBuilder details = new StringBuilder();
            details.append("Typ wyjątku: ").append(errType).append("\n");
            details.append("Komunikat: ").append(errMsg).append("\n");
            if (cause != null) {
                details.append("Przyczyna źródłowa: ")
                        .append(cause.getClass().getSimpleName())
                        .append(": ")
                        .append(cause.getMessage() != null ? cause.getMessage() : "brak opisu")
                        .append("\n");
            }
            details.append("Docelowy URL: ").append(ep.getUrl());

            return ResponseEntity.ok(new TestResult(
                    false,
                    0,
                    elapsed,
                    "Błąd połączenia (" + errType + "): " + errMsg,
                    details.toString()
            ));
        }
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleError(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse(ex.getMessage()));
    }

    public record ErrorResponse(String message) {}
    public record TestResult(boolean success, int statusCode, long responseTimeMs, String message, String details) {}
}