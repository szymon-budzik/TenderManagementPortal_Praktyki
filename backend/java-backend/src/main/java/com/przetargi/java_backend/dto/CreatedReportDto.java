package com.przetargi.java_backend.dto;

public record CreatedReportDto(
        Long runId,
        String sourceType,
        Integer itemsCount,
        String message
) {}
