package com.przetargi.java_backend.dto;

public record ShareActionResultDto(
        int sharedItemsCount,
        int recipientsCount,
        String message
) {}
