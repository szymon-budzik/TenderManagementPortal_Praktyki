package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.SharedTender;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SharedTenderRepository extends JpaRepository<SharedTender, Long> {
    List<SharedTender> findByRecipientUserIdOrderByCreatedAtDesc(Long recipientUserId);
    long countByRecipientUserId(Long recipientUserId);
    long countByRecipientUserIdAndIsReadFalse(Long recipientUserId);
    List<SharedTender> findByRecipientUserIdAndIsReadFalse(Long recipientUserId);
}
