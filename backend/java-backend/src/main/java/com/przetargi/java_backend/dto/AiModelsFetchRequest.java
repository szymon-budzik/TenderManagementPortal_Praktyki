package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiModelsFetchRequest(
        Long configId,
        String provider,
        String baseUrl,
        String apiKey
) {}