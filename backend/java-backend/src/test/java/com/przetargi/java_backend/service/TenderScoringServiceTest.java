package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.enums.TenderStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class TenderScoringServiceTest {

    private TenderScoringService scoringService;

    @BeforeEach
    void setUp() {
        scoringService = new TenderScoringService();
    }

    @Test
    void calculateScoreSumsMatchedKeywordWeightsCaseInsensitively() {
        int score = scoringService.calculateScore(
                "Wdrożenie Systemu Informatycznego",
                "Nowa aplikacja i oprogramowanie w modelu Chmura oraz serwis"
        );
        // oprogramowanie(20) + aplikacja(20) + chmura(15) + serwis(5) + wdrożenie(15) = 75
        assertEquals(75, score);
    }

    @Test
    void calculateScoreSubtractsPenaltyForPureHardwareDelivery() {
        int score = scoringService.calculateScore(
                "Dostawa sprzętu komputerowego",
                "Dostawa monitorów i drukarek"
        );
        assertEquals(-10, score);
    }

    @Test
    void calculateScoreHandlesNullDescription() {
        int score = scoringService.calculateScore("System informatyczny dla urzędu", null);
        assertEquals(30, score);
    }

    @Test
    void calculateScoreReturnsZeroWhenNoKeywordsMatch() {
        int score = scoringService.calculateScore("Remont drogi gminnej", "Asfaltowanie odcinka 2 km");
        assertEquals(0, score);
    }

    @Test
    void determineStatusReturnsInterestedAtOrAboveThreshold() {
        assertEquals(TenderStatus.INTERESTED, scoringService.determineStatus(30));
        assertEquals(TenderStatus.INTERESTED, scoringService.determineStatus(85));
    }

    @Test
    void determineStatusReturnsNewBelowThreshold() {
        assertEquals(TenderStatus.NEW, scoringService.determineStatus(29));
        assertEquals(TenderStatus.NEW, scoringService.determineStatus(10));
        assertEquals(TenderStatus.NEW, scoringService.determineStatus(-5));
    }
}
