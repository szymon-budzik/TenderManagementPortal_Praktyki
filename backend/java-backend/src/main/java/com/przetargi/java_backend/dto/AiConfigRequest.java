package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiConfigRequest(
        String name,
        String provider,
        String baseUrl,
        String apiKey,
        String defaultModel,
        Boolean active,
        Boolean isDefault
) {}