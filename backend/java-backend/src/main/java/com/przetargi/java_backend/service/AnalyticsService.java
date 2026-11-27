package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.TenderStatsDto;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import com.przetargi.java_backend.repository.UserTenderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final UserTenderRepository userTenderRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public TenderStatsDto getTenderStatistics() {
        Long userId = currentUserService.requireCurrentUser().getId();
        return getTenderStatisticsForUser(userId);
    }

    @Transactional(readOnly = true)
    public TenderStatsDto getTenderStatisticsForUser(Long userId) {
        long total = userTenderRepository.countByUserId(userId);
        Double avgScore = userTenderRepository.calculateAverageScoreByUserId(userId);
        double safeAvg = avgScore != null ? avgScore : 0.0;
        long highPriority = userTenderRepository.countByUserIdAndScoreGreaterThanEqual(userId, 30);

        Map<TenderStatus, Long> statusDistribution = new EnumMap<>(TenderStatus.class);
        for (TenderStatus status : TenderStatus.values()) {
            statusDistribution.put(status, 0L);
        }

        List<Object[]> rawCounts = userTenderRepository.countByUserIdGroupByStatus(userId);
        for (Object[] row : rawCounts) {
            TenderStatus status = (TenderStatus) row[0];
            Long count = (Long) row[1];
            statusDistribution.put(status, count);
        }

        return TenderStatsDto.builder()
                .totalTenders(total)
                .averageScore(Math.round(safeAvg * 100.0) / 100.0)
                .highPriorityCount(highPriority)
                .countByStatus(statusDistribution)
                .build();
    }
}