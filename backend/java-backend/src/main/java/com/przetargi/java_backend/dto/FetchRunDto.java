package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.FetchRun;

import java.time.OffsetDateTime;

public record FetchRunDto(
        Long id,
        String sourceType,
        String sourcesSummary,
        Integer totalFetched,
        Integer savedCount,
        Integer excludedCount,
        Integer zeroScoreCount,
        OffsetDateTime createdAt
) {
    public static FetchRunDto fromEntity(FetchRun r) {
        return new FetchRunDto(
                r.getId(),
                r.getSourceType(),
                r.getSourcesSummary(),
                r.getTotalFetched(),
                r.getSavedCount(),
                r.getExcludedCount(),
                r.getZeroScoreCount(),
                r.getCreatedAt()
        );
    }
}
