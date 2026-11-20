package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.ApiEndpoint;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
@Builder
public class ApiEndpointDto {
    private Long id;
    private String name;
    private String url;
    private String httpMethod;
    private String payload;
    private String linkTemplate;
    private String notes;
    private Boolean isActive;
    private OffsetDateTime lastSyncAt;
    private OffsetDateTime createdAt;

    public static ApiEndpointDto fromEntity(ApiEndpoint entity) {
        return ApiEndpointDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .url(entity.getUrl())
                .httpMethod(entity.getHttpMethod())
                .payload(entity.getPayload())
                .linkTemplate(entity.getLinkTemplate())
                .notes(entity.getNotes())
                .isActive(entity.getIsActive())
                .lastSyncAt(entity.getLastSyncAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}