package com.przetargi.java_backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.przetargi.java_backend.dto.TenderStatsDto;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.TenderRepository;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final TenderRepository tenderRepository;

    @Transactional(readOnly = true)
    public TenderStatsDto getTenderStatistics() {
        long total = tenderRepository.count();
        Double avgScore = tenderRepository.calculateAverageScore();
        long highPriority = tenderRepository.countByScoreGreaterThanEqual(30);

        Map<TenderStatus, Long> statusDistribution = new EnumMap<>(TenderStatus.class);
        for (TenderStatus status : TenderStatus.values()) {
            statusDistribution.put(status, 0L);
        }

        List<Object[]> rawCounts = tenderRepository.countTendersByStatus();
        for (Object[] row : rawCounts) {
            TenderStatus status = (TenderStatus) row[0];
            Long count = (Long) row[1];
            statusDistribution.put(status, count);
        }

        return TenderStatsDto.builder()
            .totalTenders(total)
            .averageScore(Math.round(avgScore * 100.0) / 100.0) // Zaokrąglenie do 2 miejsc
            .highPriorityCount(highPriority)
            .countByStatus(statusDistribution)
            .build();
    }
}