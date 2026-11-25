package com.przetargi.java_backend.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record ObservedTenderDto(
        TenderResponseDto tender,
        List<TenderUpdateDto> updates,
        OffsetDateTime effectiveDeadline,
        long unreadUpdatesCount
) {}
