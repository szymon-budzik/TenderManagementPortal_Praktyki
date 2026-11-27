package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AiConfigDto;
import com.przetargi.java_backend.dto.AiConfigRequest;
import com.przetargi.java_backend.dto.AiModelOptionDto;
import com.przetargi.java_backend.dto.AiModelsFetchRequest;
import com.przetargi.java_backend.entity.AiConfig;
import com.przetargi.java_backend.repository.AiConfigRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class AiConfigService {

    private static final Set<String> SUPPORTED_PROVIDERS = Set.of(
            "GEMINI",
            "OPENAI",
            "ANTHROPIC",
            "OPENAI_COMPATIBLE"
    );

    private final AiConfigRepository repository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    @Autowired
    public AiConfigService(AiConfigRepository repository, ObjectMapper objectMapper) {
        this(repository, objectMapper, HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build());
    }

    AiConfigService(AiConfigRepository repository, ObjectMapper objectMapper, HttpClient httpClient) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
    }

    @Transactional(readOnly = true)
    public List<AiConfigDto> listAll() {
        return repository.findAllByOrderByIdAsc().stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public AiConfigDto create(AiConfigRequest req) {
        validateRequired(req.name(), "Nazwa konfiguracji jest wymagana.");
        String provider = normalizeAndValidateProvider(req.provider());
        String normalizedBaseUrl = validateAndNormalizeCustomBaseUrl(provider, req.baseUrl());

        if (!"OPENAI_COMPATIBLE".equals(provider)) {
            validateRequired(req.apiKey(), "Klucz API jest wymagany.");
        }

        if (Boolean.TRUE.equals(req.isDefault())) {
            clearDefaultFlag();
        }

        AiConfig entity = new AiConfig();
        entity.setName(req.name().trim());
        entity.setProvider(provider);
        entity.setBaseUrl(normalizedBaseUrl);
        entity.setApiKey(req.apiKey() == null ? "" : req.apiKey().trim());
        entity.setDefaultModel(trimOrNull(req.defaultModel()));
        entity.setActive(req.active() == null || req.active());
        entity.setDefault(Boolean.TRUE.equals(req.isDefault()));

        return toDto(repository.save(entity));
    }

    @Transactional
    public AiConfigDto update(Long id, AiConfigRequest req) {
        AiConfig entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono konfiguracji AI o id=" + id));

        validateRequired(req.name(), "Nazwa konfiguracji jest wymagana.");
        String provider = normalizeAndValidateProvider(req.provider());
        String normalizedBaseUrl = validateAndNormalizeCustomBaseUrl(provider, req.baseUrl());

        if (Boolean.TRUE.equals(req.isDefault()) && !entity.isDefault()) {
            clearDefaultFlag();
        }

        entity.setName(req.name().trim());
        entity.setProvider(provider);
        entity.setBaseUrl(normalizedBaseUrl);
        if (req.apiKey() != null && !req.apiKey().isBlank()) {
            entity.setApiKey(req.apiKey().trim());
        } else if (!"OPENAI_COMPATIBLE".equals(provider)
                && (entity.getApiKey() == null || entity.getApiKey().isBlank())) {
            throw new IllegalArgumentException("Klucz API jest wymagany dla wybranego dostawcy.");
        }
        entity.setDefaultModel(trimOrNull(req.defaultModel()));
        if (req.active() != null) {
            entity.setActive(req.active());
        }
        if (req.isDefault() != null) {
            entity.setDefault(req.isDefault());
        }

        return toDto(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        if (repository.existsById(id)) {
            repository.deleteById(id);
        }
    }

    @Transactional(readOnly = true)
    public List<AiModelOptionDto> fetchAvailableModels(AiModelsFetchRequest req) {
        String provider = req.provider();
        String baseUrl = req.baseUrl();
        String apiKey = req.apiKey();

        if (req.configId() != null) {
            AiConfig saved = repository.findById(req.configId())
                    .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono konfiguracji AI o id=" + req.configId()));
            if (provider == null || provider.isBlank()) {
                provider = saved.getProvider();
            }
            if (baseUrl == null || baseUrl.isBlank()) {
                baseUrl = saved.getBaseUrl();
            }
            if (apiKey == null || apiKey.isBlank()) {
                apiKey = saved.getApiKey();
            }
        }

        String normalizedProvider = normalizeAndValidateProvider(provider);
        String cleanBaseUrl = resolveBaseUrl(normalizedProvider, baseUrl);

        if (!"OPENAI_COMPATIBLE".equals(normalizedProvider)) {
            validateRequired(apiKey, "Podaj klucz API, aby pobrać listę modeli.");
        }

        try {
            HttpRequest httpRequest = buildModelsRequest(normalizedProvider, cleanBaseUrl, apiKey);
            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Błąd API dostawcy (HTTP " + response.statusCode() + "): "
                        + extractErrorDetails(response.body()));
            }

            return parseModels(normalizedProvider, response.body());
        } catch (IllegalStateException | IllegalArgumentException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Przerwano pobieranie listy modeli od dostawcy.", e);
        } catch (Exception e) {
            throw new IllegalStateException("Nie udało się pobrać listy modeli: " + e.getMessage(), e);
        }
    }

    HttpRequest buildModelsRequest(String provider, String baseUrl, String apiKey) {
        String url;
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET();

        switch (provider) {
            case "GEMINI" -> {
                url = baseUrl.endsWith("/v1beta") ? baseUrl + "/models" : baseUrl + "/v1beta/models";
                builder.header("x-goog-api-key", apiKey.trim());
            }
            case "ANTHROPIC" -> {
                url = baseUrl.endsWith("/v1") ? baseUrl + "/models" : baseUrl + "/v1/models";
                builder.header("x-api-key", apiKey.trim());
                builder.header("anthropic-version", "2023-06-01");
            }
            case "OPENAI", "OPENAI_COMPATIBLE" -> {
                url = baseUrl + "/models";
                if (apiKey != null && !apiKey.isBlank()) {
                    builder.header("Authorization", "Bearer " + apiKey.trim());
                }
            }
            default -> throw new IllegalArgumentException("Nieobsługiwany dostawca AI: " + provider);
        }

        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Nieprawidłowy adres Base URL: " + baseUrl);
        }
        return builder.uri(uri).build();
    }

    List<AiModelOptionDto> parseModels(String provider, String body) {
        JsonNode root = objectMapper.readTree(body);
        List<AiModelOptionDto> result = new ArrayList<>();

        if ("GEMINI".equals(provider)) {
            for (JsonNode model : root.path("models")) {
                boolean supportsGenerate = false;
                for (JsonNode method : model.path("supportedGenerationMethods")) {
                    if ("generateContent".equals(method.asString(""))) {
                        supportsGenerate = true;
                        break;
                    }
                }
                if (!supportsGenerate) {
                    continue;
                }

                String id = model.path("name").asString("").replaceFirst("^models/", "");
                String rawDisplayName = model.path("displayName").asString("");
                String displayName = rawDisplayName.isBlank() ? id : rawDisplayName;
                if (!id.isBlank()) {
                    result.add(new AiModelOptionDto(id, displayName));
                }
            }
        } else {
            JsonNode items = root.has("data") ? root.path("data") : root.path("models");
            for (JsonNode model : items) {
                String id = model.path("id").asString("");
                if (id.isBlank()) {
                    id = model.path("name").asString("");
                }
                String rawDisplayName = model.path("display_name").asString("");
                if (rawDisplayName.isBlank()) {
                    rawDisplayName = model.path("displayName").asString("");
                }
                String displayName = rawDisplayName.isBlank() ? id : rawDisplayName;
                if (!id.isBlank()) {
                    result.add(new AiModelOptionDto(id, displayName));
                }
            }
        }

        result.sort(Comparator.comparing(AiModelOptionDto::id));
        return result;
    }

    private String normalizeAndValidateProvider(String provider) {
        validateRequired(provider, "Wybierz dostawcę AI.");
        String normalized = provider.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_PROVIDERS.contains(normalized)) {
            throw new IllegalArgumentException("Nieobsługiwany dostawca AI: " + normalized);
        }
        return normalized;
    }

    private String validateAndNormalizeCustomBaseUrl(String provider, String customUrl) {
        String normalized = normalizeUrl(customUrl);
        if (normalized == null) {
            if ("OPENAI_COMPATIBLE".equals(provider)) {
                throw new IllegalArgumentException("Dla trybu OpenAI-compatible musisz podać Base URL.");
            }
            return null;
        }
        validateHttpUrl(normalized);
        return normalized;
    }

    private String resolveBaseUrl(String provider, String customUrl) {
        String normalized = normalizeUrl(customUrl);
        if (normalized != null) {
            validateHttpUrl(normalized);
            return normalized;
        }
        return switch (provider) {
            case "GEMINI" -> "https://generativelanguage.googleapis.com";
            case "OPENAI" -> "https://api.openai.com/v1";
            case "ANTHROPIC" -> "https://api.anthropic.com";
            default -> throw new IllegalArgumentException("Dla trybu OpenAI-compatible musisz podać Base URL.");
        };
    }

    private void validateHttpUrl(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new IllegalArgumentException("Base URL musi zaczynać się od http:// lub https://");
        }
        try {
            URI uri = URI.create(url);
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new IllegalArgumentException("Base URL musi zawierać poprawny host.");
            }
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().startsWith("Base URL")) {
                throw e;
            }
            throw new IllegalArgumentException("Nieprawidłowy format Base URL: " + url);
        }
    }

    private String extractErrorDetails(String body) {
        if (body == null || body.isBlank()) {
            return "Brak szczegółów w odpowiedzi dostawcy.";
        }
        try {
            JsonNode root = objectMapper.readTree(body);
            String msg = root.path("error").path("message").asString("");
            if (!msg.isBlank()) {
                return truncate(msg, 250);
            }
            msg = root.path("message").asString("");
            if (!msg.isBlank()) {
                return truncate(msg, 250);
            }
        } catch (Exception ignored) {
            // Fall back to truncated raw body
        }
        return truncate(body.trim(), 250);
    }

    private void clearDefaultFlag() {
        repository.findAll().forEach(c -> {
            if (c.isDefault()) {
                c.setDefault(false);
                repository.save(c);
            }
        });
    }

    private AiConfigDto toDto(AiConfig e) {
        return new AiConfigDto(
                e.getId(),
                e.getName(),
                e.getProvider(),
                e.getBaseUrl(),
                maskKey(e.getApiKey()),
                e.getApiKey() != null && !e.getApiKey().isBlank(),
                e.getDefaultModel(),
                e.isActive(),
                e.isDefault(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }

    String maskKey(String key) {
        if (key == null || key.isBlank()) {
            return "";
        }
        if (key.length() <= 8) {
            return "••••••••";
        }
        return key.substring(0, 4) + "••••" + key.substring(key.length() - 4);
    }

    private String normalizeUrl(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return url.trim().replaceAll("/+$", "");
    }

    private String trimOrNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private void validateRequired(String val, String message) {
        if (val == null || val.isBlank()) {
            throw new IllegalArgumentException(message);
        }
    }

    private String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
