package com.przetargi.java_backend.service;

import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.CronConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class AutomationSchedulerServiceTest {

    @Mock
    private AutomationProfileRepository profileRepository;
    @Mock
    private CronConfigRepository cronConfigRepository;
    @Mock
    private TenderExecutionService executionService;

    private AutomationSchedulerService schedulerService;

    @BeforeEach
    void setUp() {
        schedulerService = new AutomationSchedulerService(
                profileRepository,
                cronConfigRepository,
                executionService,
                new TenderDateService()
        );
    }

    @Test
    void matchesScheduleExpressionHandlesDailyTimesAndNormalization() {
        assertTrue(schedulerService.matchesScheduleExpression("8:00, 16:00", "08:00", 3));
        assertTrue(schedulerService.matchesScheduleExpression("8:00, 16:00", "16:00", 7));
        assertFalse(schedulerService.matchesScheduleExpression("8:00, 16:00", "12:00", 3));
    }

    @Test
    void matchesScheduleExpressionRespectsDayOfWeekRules() {
        assertTrue(schedulerService.matchesScheduleExpression("8:00/1, 16:00/2;5", "08:00", 1));
        assertFalse(schedulerService.matchesScheduleExpression("8:00/1, 16:00/2;5", "08:00", 2));
        assertTrue(schedulerService.matchesScheduleExpression("8:00/1, 16:00/2;5", "16:00", 5));
        assertFalse(schedulerService.matchesScheduleExpression("8:00/1, 16:00/2;5", "16:00", 4));
    }

    @Test
    void matchesScheduleExpressionReturnsFalseForBlankInput() {
        assertFalse(schedulerService.matchesScheduleExpression(null, "08:00", 1));
        assertFalse(schedulerService.matchesScheduleExpression("   ", "08:00", 1));
    }
}
