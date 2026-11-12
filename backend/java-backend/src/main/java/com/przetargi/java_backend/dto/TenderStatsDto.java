package com.przetargi.java_backend.dto;

import lombok.Builder;
import lombok.Getter;
import com.przetargi.java_backend.entity.enums.TenderStatus;

import java.util.Map;

@Getter
@Builder
public class TenderStatsDto {
    private long totalTenders;
    private double averageScore;
    private long highPriorityCount; // np. score >= 30
    private Map<TenderStatus, Long> countByStatus;
}