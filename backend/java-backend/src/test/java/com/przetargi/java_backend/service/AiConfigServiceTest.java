package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AiConfigDto;
import com.przetargi.java_backend.dto.AiConfigRequest;
import com.przetargi.java_backend.dto.AiModelOptionDto;
import com.przetargi.java_backend.entity.AiConfig;
import com.przetargi.java_backend.repository.AiConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.net.http.HttpRequest;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiConfigServiceTest {

    @Mock
    private AiConfigRepository repository;

    private AiConfigService service;

    @BeforeEach
    void setUp() {
        service = new AiConfigService(repository, new ObjectMapper());
    }

    @Test
    void createMasksApiKeyAndClearsPreviousDefault() {
        AiConfig existingDefault = new AiConfig();
        existingDefault.setId(1L);
        existingDefault.setName("Stary");
        existingDefault.setProvider("OPENAI");
        existingDefault.setApiKey("sk-old1234567890");
        existingDefault.setDefault(true);

        when(repository.findAll()).thenReturn(List.of(existingDefault));
        when(repository.save(any(AiConfig.class))).thenAnswer(inv -> {
            AiConfig saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(2L);
            }
            return saved;
        });

        AiConfigDto created = service.create(new AiConfigRequest(
                "Gemini Prod",
                "gemini",
                null,
                "AIzaSyDemoKey123459xQp",
                "gemini-2.5-flash",
                true,
                true
        ));

        assertFalse(existingDefault.isDefault());
        assertEquals("GEMINI", created.provider());
        assertEquals("AIza••••9xQp", created.apiKeyMasked());
        assertTrue(created.hasApiKey());
        assertTrue(created.isDefault());
    }

    @Test
    void updatePreservesApiKeyWhenBlank() {
        AiConfig existing = new AiConfig();
        existing.setId(5L);
        existing.setName("Anthropic");
        existing.setProvider("ANTHROPIC");
        existing.setApiKey("sk-ant-secret-9999");
        existing.setActive(true);
        existing.setDefault(false);

        when(repository.findById(5L)).thenReturn(Optional.of(existing));
        when(repository.save(any(AiConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        AiConfigDto updated = service.update(5L, new AiConfigRequest(
                "Anthropic Updated",
                "ANTHROPIC",
                "https://api.anthropic.com",
                "   ",
                "claude-sonnet-4-5",
                true,
                false
        ));

        assertEquals("sk-ant-secret-9999", existing.getApiKey());
        assertEquals("sk-a••••9999", updated.apiKeyMasked());
        assertEquals("Anthropic Updated", updated.name());
    }

    @Test
    void createAllowsEmptyApiKeyForOpenAiCompatibleWithValidBaseUrl() {
        when(repository.save(any(AiConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        AiConfigDto created = service.create(new AiConfigRequest(
                "Local Ollama",
                "OPENAI_COMPATIBLE",
                "http://localhost:11434/v1/",
                "",
                "llama3.2",
                true,
                false
        ));

        assertEquals("http://localhost:11434/v1", created.baseUrl());
        assertEquals("", created.apiKeyMasked());
        assertFalse(created.hasApiKey());
    }

    @Test
    void createRejectsInvalidBaseUrl() {
        assertThrows(IllegalArgumentException.class, () -> service.create(new AiConfigRequest(
                "Bad URL",
                "OPENAI_COMPATIBLE",
                "ftp://example.com/v1",
                "sk-1234567890",
                null,
                true,
                false
        )));
    }

    @Test
    void parseModelsFiltersGeminiGenerateContentAndStripsPrefix() {
        String body = """
                {
                  "models": [
                    {
                      "name": "models/gemini-2.5-flash",
                      "displayName": "Gemini 2.5 Flash",
                      "supportedGenerationMethods": ["generateContent", "countTokens"]
                    },
                    {
                      "name": "models/text-embedding-004",
                      "displayName": "Embedding",
                      "supportedGenerationMethods": ["embedContent"]
                    }
                  ]
                }
                """;

        List<AiModelOptionDto> models = service.parseModels("GEMINI", body);

        assertEquals(1, models.size());
        assertEquals("gemini-2.5-flash", models.get(0).id());
        assertEquals("Gemini 2.5 Flash", models.get(0).displayName());
    }

    @Test
    void buildModelsRequestSetsProviderSpecificHeadersAndUrls() {
        HttpRequest geminiReq = service.buildModelsRequest("GEMINI", "https://generativelanguage.googleapis.com", "g-key");
        assertEquals("https://generativelanguage.googleapis.com/v1beta/models", geminiReq.uri().toString());
        assertEquals("g-key", geminiReq.headers().firstValue("x-goog-api-key").orElseThrow());

        HttpRequest anthropicReq = service.buildModelsRequest("ANTHROPIC", "https://api.anthropic.com", "a-key");
        assertEquals("https://api.anthropic.com/v1/models", anthropicReq.uri().toString());
        assertEquals("a-key", anthropicReq.headers().firstValue("x-api-key").orElseThrow());
        assertEquals("2023-06-01", anthropicReq.headers().firstValue("anthropic-version").orElseThrow());

        HttpRequest openAiReq = service.buildModelsRequest("OPENAI", "https://api.openai.com/v1", "o-key");
        assertEquals("https://api.openai.com/v1/models", openAiReq.uri().toString());
        assertEquals("Bearer o-key", openAiReq.headers().firstValue("Authorization").orElseThrow());
    }
}
