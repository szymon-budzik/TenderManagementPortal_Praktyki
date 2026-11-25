package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.AutomationNotification;

import java.time.OffsetDateTime;

public record AutomationNotificationDto(
        Long id,
        Long profileId,
        String profileName,
        Boolean success,
        String title,
        String summary,
        String details,
        Boolean isRead,
        OffsetDateTime createdAt
) {
    public static AutomationNotificationDto fromEntity(AutomationNotification n) {
        return new AutomationNotificationDto(
                n.getId(),
                n.getProfileId(),
                n.getProfileName(),
                n.getSuccess(),
                n.getTitle(),
                n.getSummary(),
                n.getDetails(),
                n.getIsRead(),
                n.getCreatedAt()
        );
    }
}
