package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.Tender;

import java.time.OffsetDateTime;

public record SharedTenderDto(
        Long id,
        Long tenderId,
        Long senderUserId,
        String senderUsername,
        String note,
        boolean isRead,
        OffsetDateTime createdAt,
        Tender tender
) {}
