package com.przetargi.java_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import com.przetargi.java_backend.entity.ApiEndpoint;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiEndpointDto {
    private Long id;

    @NotBlank(message = "Nazwa jest wymagana")
    private String name;

    @NotBlank(message = "URL jest wymagany")
    private String url;

    private String httpMethod;
    private String payload;
    private String notes;
    private Boolean isActive;
    private OffsetDateTime lastSyncAt;

    public static ApiEndpointDto fromEntity(ApiEndpoint entity) {
        return ApiEndpointDto.builder()
            .id(entity.getId())
            .name(entity.getName())
            .url(entity.getUrl())
            .httpMethod(entity.getHttpMethod())
            .payload(entity.getPayload())
            .notes(entity.getNotes())
            .isActive(entity.getIsActive())
            .lastSyncAt(entity.getLastSyncAt())
            .build();
    }
}