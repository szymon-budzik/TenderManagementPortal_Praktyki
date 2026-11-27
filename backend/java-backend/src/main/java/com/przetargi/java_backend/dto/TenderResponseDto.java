package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
@Builder
public class TenderResponseDto {
    private Long id;
    private String externalId;
    private String title;
    private String description;
    private TenderStatus status;
    private Integer score;
    private OffsetDateTime publicationDate;
    private OffsetDateTime submissionDeadline;
    private String groupKey;
    private Boolean hasUnreadUpdate;
    private OffsetDateTime lastUpdatedAt;
    private OffsetDateTime createdAt;

    public static TenderResponseDto fromEntity(Tender tender) {
        return TenderResponseDto.builder()
                .id(tender.getId())
                .externalId(tender.getExternalId())
                .title(tender.getTitle())
                .description(tender.getDescription())
                .status(tender.getStatus())
                .score(tender.getScore())
                .publicationDate(tender.getPublicationDate())
                .submissionDeadline(tender.getSubmissionDeadline())
                .groupKey(tender.getGroupKey())
                .hasUnreadUpdate(tender.getHasUnreadUpdate())
                .lastUpdatedAt(tender.getLastUpdatedAt())
                .createdAt(tender.getCreatedAt())
                .build();
    }

    public static TenderResponseDto fromUserTender(UserTender ut) {
        Tender tender = ut.getTender();
        String mergedDesc = mergeBreakdownWithDescription(ut.getScoreBreakdown(), tender.getDescription());
        return TenderResponseDto.builder()
                .id(tender.getId())
                .externalId(tender.getExternalId())
                .title(tender.getTitle())
                .description(mergedDesc)
                .status(ut.getStatus() != null ? ut.getStatus() : TenderStatus.NEW)
                .score(ut.getScore() != null ? ut.getScore() : 0)
                .publicationDate(tender.getPublicationDate())
                .submissionDeadline(tender.getSubmissionDeadline())
                .groupKey(tender.getGroupKey())
                .hasUnreadUpdate(Boolean.TRUE.equals(ut.getHasUnreadUpdate()))
                .lastUpdatedAt(tender.getLastUpdatedAt())
                .createdAt(ut.getCreatedAt() != null ? ut.getCreatedAt() : tender.getCreatedAt())
                .build();
    }

    public static TenderResponseDto fromCatalogForRecipient(Tender tender) {
        return TenderResponseDto.builder()
                .id(tender.getId())
                .externalId(tender.getExternalId())
                .title(tender.getTitle())
                .description(tender.getDescription())
                .status(TenderStatus.NEW)
                .score(tender.getScore() != null ? tender.getScore() : 0)
                .publicationDate(tender.getPublicationDate())
                .submissionDeadline(tender.getSubmissionDeadline())
                .groupKey(tender.getGroupKey())
                .hasUnreadUpdate(false)
                .lastUpdatedAt(tender.getLastUpdatedAt())
                .createdAt(tender.getCreatedAt())
                .build();
    }

    public static String stripBreakdownLine(String description) {
        if (description == null || description.isBlank()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String line : description.split("\n")) {
            if (line.trim().startsWith("Punktacja kategorii:")) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append('\n');
            }
            sb.append(line);
        }
        return sb.toString();
    }

    public static String mergeBreakdownWithDescription(String breakdownLine, String rawDescription) {
        String cleanDesc = stripBreakdownLine(rawDescription);
        if (breakdownLine == null || breakdownLine.isBlank()) {
            return rawDescription != null ? rawDescription : "";
        }
        String normalizedLine = breakdownLine.startsWith("Punktacja kategorii:")
                ? breakdownLine
                : "Punktacja kategorii: " + breakdownLine;
        return cleanDesc.isBlank() ? normalizedLine : normalizedLine + "\n" + cleanDesc;
    }
}
