package com.przetargi.java_backend.dto;

import java.time.LocalDateTime;

public record AiConfigDto(
        Long id,
        String name,
        String provider,
        String baseUrl,
        String apiKeyMasked,
        boolean hasApiKey,
        String defaultModel,
        boolean active,
        boolean isDefault,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}