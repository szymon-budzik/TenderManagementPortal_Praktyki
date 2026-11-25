package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

@Service
public class ApiEndpointService {

    private final ApiEndpointRepository repository;
    private final TenderDateService dateService;
    private final TenderSourceFetchService sourceFetchService;
    private final HttpClient httpClient;

    public ApiEndpointService(
            ApiEndpointRepository repository,
            TenderDateService dateService,
            TenderSourceFetchService sourceFetchService
    ) {
        this.repository = repository;
        this.dateService = dateService;
        this.sourceFetchService = sourceFetchService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Transactional(readOnly = true)
    public List<ApiEndpointDto> getAll() {
        return repository.findAll().stream().map(ApiEndpointDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<ApiEndpointDto> getAllOrdered() {
        return repository.findAllByOrderByIdAsc().stream().map(ApiEndpointDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<ApiEndpointDto> getActiveEndpoints() {
        return repository.findByIsActiveTrue().stream().map(ApiEndpointDto::fromEntity).toList();
    }

    @Transactional
    public ApiEndpointDto createEndpoint(
            String name,
            String url,
            String httpMethod,
            String payload,
            String linkTemplate,
            String notes,
            Boolean isActive
    ) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Nazwa endpointu jest wymagana.");
        }
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("Adres URL endpointu jest wymagany.");
        }

        ApiEndpoint endpoint = new ApiEndpoint();
        endpoint.setName(name.trim());
        endpoint.setUrl(url.trim());
        endpoint.setHttpMethod(httpMethod != null && !httpMethod.isBlank()
                ? httpMethod.trim().toUpperCase()
                : "GET");
        endpoint.setPayload(payload != null && !payload.isBlank() ? payload.trim() : null);
        endpoint.setLinkTemplate(linkTemplate != null && !linkTemplate.isBlank() ? linkTemplate.trim() : null);
        endpoint.setNotes(notes != null && !notes.isBlank() ? notes.trim() : null);
        endpoint.setIsActive(isActive != null ? isActive : true);

        return ApiEndpointDto.fromEntity(repository.save(endpoint));
    }

    @Transactional
    public ApiEndpointDto updateEndpoint(
            Long id,
            String name,
            String url,
            String httpMethod,
            String payload,
            String linkTemplate,
            String notes,
            Boolean isActive
    ) {
        ApiEndpoint endpoint = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        if (name != null && !name.isBlank()) {
            endpoint.setName(name.trim());
        }
        if (url != null && !url.isBlank()) {
            endpoint.setUrl(url.trim());
        }
        if (httpMethod != null && !httpMethod.isBlank()) {
            endpoint.setHttpMethod(httpMethod.trim().toUpperCase());
        }
        if (payload != null) {
            endpoint.setPayload(payload.isBlank() ? null : payload.trim());
        }
        if (linkTemplate != null) {
            endpoint.setLinkTemplate(linkTemplate.isBlank() ? null : linkTemplate.trim());
        }
        if (notes != null) {
            endpoint.setNotes(notes.isBlank() ? null : notes.trim());
        }
        if (isActive != null) {
            endpoint.setIsActive(isActive);
        }

        return ApiEndpointDto.fromEntity(repository.save(endpoint));
    }

    @Transactional
    public ApiEndpointDto updateEndpointNotes(Long id, String notes) {
        ApiEndpoint endpoint = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        endpoint.setNotes(notes != null && !notes.isBlank() ? notes.trim() : null);
        return ApiEndpointDto.fromEntity(repository.save(endpoint));
    }

    @Transactional
    public ApiEndpointDto toggleActive(Long id) {
        ApiEndpoint endpoint = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        endpoint.setIsActive(!Boolean.TRUE.equals(endpoint.getIsActive()));
        return ApiEndpointDto.fromEntity(repository.save(endpoint));
    }

    @Transactional
    public void deleteIfExists(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
        }
    }

    public TestConnectionResult testEndpointConnection(Long id) {
        ApiEndpoint ep = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono endpointu o ID: " + id));

        String resolvedUrl = dateService.resolveDynamicTokens(ep.getUrl());
        String resolvedPayload = dateService.resolveDynamicTokens(ep.getPayload());

        try {
            if ("SCRAPER".equalsIgnoreCase(ep.getHttpMethod())) {
                String msg = sourceFetchService.testScraperConnection(ep);
                return new TestConnectionResult(true, 200, resolvedUrl, msg);
            }

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

            HttpResponse<String> response = httpClient.send(reqBuilder.build(), HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            String rawBody = response.body() != null ? response.body().trim() : "";
            String preview = rawBody.length() > 600 ? rawBody.substring(0, 600) + "..." : rawBody;

            if (status >= 200 && status < 300) {
                String msg = "Połączenie udane (HTTP " + status + ").\n"
                        + "Wywołany URL: " + resolvedUrl
                        + (preview.isEmpty() ? "" : "\n\nPodgląd odpowiedzi:\n" + preview);
                return new TestConnectionResult(true, status, resolvedUrl, msg);
            } else {
                String msg = "Błąd HTTP " + status + " dla URL: " + resolvedUrl
                        + (preview.isEmpty() ? "" : "\n\nOdpowiedź serwera:\n" + preview);
                return new TestConnectionResult(false, status, resolvedUrl, msg);
            }
        } catch (Exception e) {
            String errMsg = "Błąd połączenia (" + e.getClass().getSimpleName() + "): "
                    + (e.getMessage() != null ? e.getMessage() : "brak szczegółów")
                    + "\nURL: " + resolvedUrl;
            return new TestConnectionResult(false, null, resolvedUrl, errMsg);
        }
    }

    @Transactional
    public void markSyncFinished(Long id) {
        repository.findById(id).ifPresent(e -> e.setLastSyncAt(OffsetDateTime.now()));
    }

    public record TestConnectionResult(
            boolean success,
            Integer statusCode,
            String resolvedUrl,
            String message
    ) {}
}
