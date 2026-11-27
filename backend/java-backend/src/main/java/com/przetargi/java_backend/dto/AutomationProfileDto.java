package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.AutomationProfile;

import java.time.OffsetDateTime;

public record AutomationProfileDto(
        Long id,
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
        OffsetDateTime lastRunAt,
        String lastRunStatus,
        Boolean notificationsEnabled,
        String categoryQuery,
        Boolean useCategoryQuery
) {
    public static AutomationProfileDto fromEntity(AutomationProfile p) {
        return new AutomationProfileDto(
                p.getId(),
                p.getName(),
                p.getEnabled(),
                p.getScheduleType(),
                p.getCronTime(),
                p.getIntervalMinutes(),
                p.getCronDays(),
                p.getSmtpAccountId(),
                p.getMatchMode(),
                p.getEndpointIds(),
                p.getCategoryIds(),
                p.getRecipientEmails(),
                p.getLastRunAt(),
                p.getLastRunStatus(),
                p.getNotificationsEnabled(),
                p.getCategoryQuery(),
                Boolean.TRUE.equals(p.getUseCategoryQuery())
        );
    }
}
