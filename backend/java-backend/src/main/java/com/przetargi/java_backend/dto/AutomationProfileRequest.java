package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AutomationProfileRequest(
        String name,
        Boolean enabled,
        String scheduleType,
        String cronTime,
        Integer intervalMinutes,
        String cronDays,
        Long smtpAccountId,
        String matchMode,
        String endpointIds,
        String categoryIds,
        String recipientEmails,
        Boolean notificationsEnabled
) {}
