package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.AutomationNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AutomationNotificationRepository extends JpaRepository<AutomationNotification, Long> {
    List<AutomationNotification> findTop50ByOrderByCreatedAtDesc();
    List<AutomationNotification> findByIsReadFalse();
}