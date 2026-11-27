package com.przetargi.java_backend.dto;

public record CreatedReportDto(
        Long runId,
        Integer userSeqNo,
        String sourceType,
        Integer itemsCount,
        String message
) {
    public CreatedReportDto(Long runId, String sourceType, Integer itemsCount, String message) {
        this(runId, null, sourceType, itemsCount, message);
    }
}
