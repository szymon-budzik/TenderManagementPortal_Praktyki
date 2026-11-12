package com.przetargi.java_backend.service;

import org.springframework.stereotype.Service;
import com.przetargi.java_backend.entity.enums.TenderStatus;

import java.util.Map;

@Service
public class TenderScoringService {

    // Słowa kluczowe i wagi punktowe (docelowo można przenieść do bazy lub application.properties)
    private static final Map<String, Integer> KEYWORD_WEIGHTS = Map.of(
        "oprogramowanie", 20,
        "aplikacja", 20,
        "system informatyczny", 30,
        "chmura", 15,
        "serwis", 5,
        "wdrożenie", 15,
        "dostawa sprzętu", -10 // odliczamy punkty, jeśli to czysty sprzęt a nie soft
    );

    public int calculateScore(String title, String description) {
        String fullText = (title + " " + (description != null ? description : "")).toLowerCase();
        
        return KEYWORD_WEIGHTS.entrySet().stream()
            .filter(entry -> fullText.contains(entry.getKey()))
            .mapToInt(Map.Entry::getValue)
            .sum();
    }

    public TenderStatus determineStatus(int score) {
        if (score >= 30) {
            return TenderStatus.INTERESTED;
        } else if (score >= 10) {
            return TenderStatus.NEW;
        } else {
            return TenderStatus.NEW;
        }
    }
}