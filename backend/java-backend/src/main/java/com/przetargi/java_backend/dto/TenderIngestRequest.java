package com.przetargi.java_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TenderIngestRequest {

    @NotBlank(message = "externalId nie może być puste")
    private String externalId;

    @NotBlank(message = "title nie może być pusty")
    private String title;

    private String description;

    private OffsetDateTime publicationDate;
}