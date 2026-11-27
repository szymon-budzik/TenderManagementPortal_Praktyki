package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.TenderUpdate;

import java.time.OffsetDateTime;

public record TenderUpdateDto(
        Long id,
        Long tenderId,
        Integer versionNumber,
        String externalId,
        String title,
        String description,
        OffsetDateTime submissionDeadline,
        String changeSummary,
        Boolean isRead,
        OffsetDateTime detectedAt
) {
    public static TenderUpdateDto fromEntity(TenderUpdate u) {
        return fromEntity(u, Boolean.TRUE.equals(u.getIsRead()));
    }

    public static TenderUpdateDto fromEntity(TenderUpdate u, boolean isRead) {
        return new TenderUpdateDto(
                u.getId(),
                u.getTenderId(),
                u.getVersionNumber(),
                u.getExternalId(),
                u.getTitle(),
                u.getDescription(),
                u.getSubmissionDeadline(),
                u.getChangeSummary(),
                isRead,
                u.getDetectedAt()
        );
    }
}
