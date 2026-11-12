package com.przetargi.java_backend.dto;

import lombok.Builder;
import lombok.Getter;
import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;

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
            .createdAt(tender.getCreatedAt())
            .build();
    }
}