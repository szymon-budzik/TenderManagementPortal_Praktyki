package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AutomationNotificationDto;
import com.przetargi.java_backend.entity.AutomationNotification;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.repository.AutomationNotificationRepository;
import com.przetargi.java_backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class AutomationNotificationService {

    private final AutomationNotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public AutomationNotificationService(
            AutomationNotificationRepository notificationRepository,
            UserRepository userRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<AutomationNotificationDto> getLatestNotifications(String username) {
        Long userId = resolveUserId(username);
        if (userId == null) {
            return List.of();
        }
        return notificationRepository.findTop50ByRecipientUserIdOrderByCreatedAtDesc(userId).stream()
                .map(AutomationNotificationDto::fromEntity)
                .toList();
    }

    @Transactional
    public AutomationNotificationDto markAsRead(Long id, String username) {
        AutomationNotification n = notificationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono powiadomienia o ID: " + id));
        Long userId = resolveUserId(username);
        if (userId == null || !userId.equals(n.getRecipientUserId())) {
            throw new AccessDeniedException("Brak dostępu do tego powiadomienia.");
        }
        n.setIsRead(true);
        return AutomationNotificationDto.fromEntity(notificationRepository.save(n));
    }

    @Transactional
    public void markAllAsRead(String username) {
        Long userId = resolveUserId(username);
        if (userId == null) {
            return;
        }
        List<AutomationNotification> toUpdate = notificationRepository.findByIsReadFalseAndRecipientUserId(userId);
        for (AutomationNotification n : toUpdate) {
            n.setIsRead(true);
        }
        if (!toUpdate.isEmpty()) {
            notificationRepository.saveAll(toUpdate);
        }
    }

    @Transactional
    public void deleteNotification(Long id, String username) {
        Long userId = resolveUserId(username);
        AutomationNotification n = notificationRepository.findById(id).orElse(null);
        if (n == null) {
            return;
        }
        if (userId == null || !userId.equals(n.getRecipientUserId())) {
            throw new AccessDeniedException("Brak dostępu do tego powiadomienia.");
        }
        notificationRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public NotificationPreferencesDto getNotificationPreferences(String username) {
        User user = requireUser(username);
        return new NotificationPreferencesDto(
                !Boolean.FALSE.equals(user.getNotifySharedTenders()),
                !Boolean.FALSE.equals(user.getNotifySharedReports())
        );
    }

    @Transactional
    public NotificationPreferencesDto updateNotificationPreferences(
            String username,
            Boolean sharedTendersEnabled,
            Boolean sharedReportsEnabled
    ) {
        User user = requireUser(username);
        if (sharedTendersEnabled != null) {
            user.setNotifySharedTenders(sharedTendersEnabled);
        }
        if (sharedReportsEnabled != null) {
            user.setNotifySharedReports(sharedReportsEnabled);
        }
        User saved = userRepository.save(user);
        return new NotificationPreferencesDto(
                !Boolean.FALSE.equals(saved.getNotifySharedTenders()),
                !Boolean.FALSE.equals(saved.getNotifySharedReports())
        );
    }

    public void notifyUser(
            Long recipientUserId,
            String notificationType,
            String label,
            String title,
            String summary,
            String details,
            OffsetDateTime nowPl
    ) {
        if (recipientUserId == null) {
            return;
        }
        if ("SHARED_TENDER".equals(notificationType) || "SHARED_REPORT".equals(notificationType)) {
            User recipient = userRepository.findById(recipientUserId).orElse(null);
            if (recipient != null) {
                if ("SHARED_TENDER".equals(notificationType) && Boolean.FALSE.equals(recipient.getNotifySharedTenders())) {
                    return;
                }
                if ("SHARED_REPORT".equals(notificationType) && Boolean.FALSE.equals(recipient.getNotifySharedReports())) {
                    return;
                }
            }
        }
        AutomationNotification notif = new AutomationNotification();
        notif.setProfileId(null);
        notif.setProfileName(label != null ? label : "Powiadomienie");
        notif.setSuccess(true);
        notif.setTitle(title);
        notif.setSummary(summary);
        notif.setDetails(details != null ? details.trim() : "");
        notif.setIsRead(false);
        notif.setCreatedAt(nowPl);
        notif.setRecipientUserId(recipientUserId);
        notif.setNotificationType(notificationType != null ? notificationType : "SHARED");
        notificationRepository.save(notif);
    }

    public void notifyProfileExecution(
            AutomationProfile profile,
            TenderExecutionService.ExecutionSummary summary,
            boolean hasErrors,
            List<String> errorReasons,
            String details,
            OffsetDateTime nowPl
    ) {
        if (Boolean.FALSE.equals(profile.getNotificationsEnabled()) || profile.getOwnerUserId() == null) {
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
                : "Pobrano: " + summary.totalFetched()
                        + ", zapisano: " + summary.savedCount()
                        + " (nowe: " + summary.newSavedCount()
                        + ", już w bazie: " + summary.existingUpdatedCount() + ").");
        notif.setDetails(details != null ? details.trim() : "");
        notif.setIsRead(false);
        notif.setCreatedAt(nowPl);
        notif.setRecipientUserId(profile.getOwnerUserId());
        notif.setNotificationType("AUTOMATION");
        notificationRepository.save(notif);
    }

    public void notifyProfileFailure(
            AutomationProfile profile,
            Exception ex,
            String errMsg,
            OffsetDateTime nowPl
    ) {
        if (Boolean.FALSE.equals(profile.getNotificationsEnabled()) || profile.getOwnerUserId() == null) {
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
        notif.setRecipientUserId(profile.getOwnerUserId());
        notif.setNotificationType("AUTOMATION");
        notificationRepository.save(notif);
    }

    private Long resolveUserId(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        return userRepository.findByUsername(username).map(User::getId).orElse(null);
    }

    private User requireUser(String username) {
        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("Brak uwierzytelnionego użytkownika.");
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AccessDeniedException("Nie znaleziono użytkownika: " + username));
    }

    public record NotificationPreferencesDto(boolean sharedTendersEnabled, boolean sharedReportsEnabled) {}
}
