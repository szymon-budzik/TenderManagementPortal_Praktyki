package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.FetchRun;

import java.time.OffsetDateTime;

public record FetchRunDto(
        Long id,
        Integer userSeqNo,
        String sourceType,
        String sourcesSummary,
        Integer totalFetched,
        Integer savedCount,
        Integer excludedCount,
        Integer zeroScoreCount,
        OffsetDateTime createdAt,
        String sharedByUsername,
        String sharedNote,
        Boolean isRead
) {
    public static FetchRunDto fromEntity(FetchRun r) {
        return new FetchRunDto(
                r.getId(),
                r.getUserSeqNo(),
                r.getSourceType(),
                r.getSourcesSummary(),
                r.getTotalFetched(),
                r.getSavedCount(),
                r.getExcludedCount(),
                r.getZeroScoreCount(),
                r.getCreatedAt(),
                r.getSharedByUsername(),
                r.getSharedNote(),
                Boolean.TRUE.equals(r.getIsRead())
        );
    }
}
