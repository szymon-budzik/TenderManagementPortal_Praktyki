package com.przetargi.java_backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.przetargi.java_backend.dto.TenderStatsDto;
import com.przetargi.java_backend.service.AnalyticsService;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    @GetMapping("/summary")
    public ResponseEntity<TenderStatsDto> getSummary() {
        return ResponseEntity.ok(analyticsService.getTenderStatistics());
    }
}