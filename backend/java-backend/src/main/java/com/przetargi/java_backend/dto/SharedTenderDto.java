package com.przetargi.java_backend.dto;

import java.time.OffsetDateTime;

public record SharedTenderDto(
        Long id,
        Long tenderId,
        Long senderUserId,
        String senderUsername,
        String note,
        boolean isRead,
        OffsetDateTime createdAt,
        TenderResponseDto tender
) {}
