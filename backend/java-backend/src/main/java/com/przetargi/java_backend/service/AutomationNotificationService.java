package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AutomationNotificationDto;
import com.przetargi.java_backend.entity.AutomationNotification;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.repository.AutomationNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class AutomationNotificationService {

    private final AutomationNotificationRepository notificationRepository;

    public AutomationNotificationService(AutomationNotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<AutomationNotificationDto> getLatestNotifications() {
        return notificationRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(AutomationNotificationDto::fromEntity)
                .toList();
    }

    @Transactional
    public AutomationNotificationDto markAsRead(Long id) {
        AutomationNotification n = notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono powiadomienia o ID: " + id));
        n.setIsRead(true);
        return AutomationNotificationDto.fromEntity(notificationRepository.save(n));
    }

    @Transactional
    public void markAllAsRead() {
        List<AutomationNotification> unread = notificationRepository.findByIsReadFalse();
        for (AutomationNotification n : unread) {
            n.setIsRead(true);
        }
        if (!unread.isEmpty()) {
            notificationRepository.saveAll(unread);
        }
    }

    @Transactional
    public void deleteNotification(Long id) {
        if (notificationRepository.existsById(id)) {
            notificationRepository.deleteById(id);
        }
    }

    public void notifyProfileExecution(
            AutomationProfile profile,
            TenderExecutionService.ExecutionSummary summary,
            boolean hasErrors,
            List<String> errorReasons,
            String details,
            OffsetDateTime nowPl
    ) {
        if (Boolean.FALSE.equals(profile.getNotificationsEnabled())) {
            return;
        }
        AutomationNotification notif = new AutomationNotification();
        notif.setProfileId(profile.getId());
        notif.setProfileName(profile.getName());
        notif.setSuccess(!hasErrors);
        notif.setTitle(hasErrors
                ? "Błąd automatyzacji: " + profile.getName()
                : "Automatyzacja zakończona: " + profile.getName());
        notif.setSummary(hasErrors
                ? "Wystąpiły błędy (" + errorReasons.size() + "). " + errorReasons.get(0)
                : "Pobrano: " + summary.totalFetched() + ", zapisano: " + summary.savedCount() + " przetargów.");
        notif.setDetails(details != null ? details.trim() : "");
        notif.setIsRead(false);
        notif.setCreatedAt(nowPl);
        notificationRepository.save(notif);
    }

    public void notifyProfileFailure(
            AutomationProfile profile,
            Exception ex,
            String errMsg,
            OffsetDateTime nowPl
    ) {
        if (Boolean.FALSE.equals(profile.getNotificationsEnabled())) {
            return;
        }
        AutomationNotification notif = new AutomationNotification();
        notif.setProfileId(profile.getId());
        notif.setProfileName(profile.getName());
        notif.setSuccess(false);
        notif.setTitle("Niepowodzenie automatyzacji: " + profile.getName());
        notif.setSummary("Przyczyna: " + errMsg);
        notif.setDetails("Profil: " + profile.getName()
                + "\nTyp błędu: " + ex.getClass().getSimpleName()
                + "\nSzczegóły: " + errMsg);
        notif.setIsRead(false);
        notif.setCreatedAt(nowPl);
        notificationRepository.save(notif);
    }
}
