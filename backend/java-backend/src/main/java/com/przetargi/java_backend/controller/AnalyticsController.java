package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.TenderStatsDto;
import com.przetargi.java_backend.service.AnalyticsService;
import com.przetargi.java_backend.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final CurrentUserService currentUserService;

    @GetMapping("/summary")
    public ResponseEntity<TenderStatsDto> getSummary(Authentication auth) {
        Long userId = auth != null
                ? currentUserService.requireByUsername(auth.getName()).getId()
                : currentUserService.requireCurrentUser().getId();
        return ResponseEntity.ok(analyticsService.getTenderStatisticsForUser(userId));
    }
}