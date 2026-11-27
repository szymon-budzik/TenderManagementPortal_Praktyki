package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.FetchRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FetchRunRepository extends JpaRepository<FetchRun, Long> {
    List<FetchRun> findAllByOrderByCreatedAtDesc();
    List<FetchRun> findByOwnerUserIdOrTargetUserIdOrderByCreatedAtDesc(Long ownerUserId, Long targetUserId);

    @Query("SELECT COUNT(r) FROM FetchRun r WHERE r.ownerUserId = :userId OR r.targetUserId = :userId")
    long countAccessibleByUser(@Param("userId") Long userId);

    @Query("SELECT COUNT(r) FROM FetchRun r WHERE (r.ownerUserId = :userId OR r.targetUserId = :userId) AND r.isRead = false")
    long countUnreadAccessibleByUser(@Param("userId") Long userId);

    @Query("SELECT r FROM FetchRun r WHERE (r.ownerUserId = :userId OR r.targetUserId = :userId) AND r.isRead = false")
    List<FetchRun> findUnreadAccessibleByUser(@Param("userId") Long userId);

    @Query("SELECT COALESCE(MAX(r.userSeqNo), 0) FROM FetchRun r WHERE r.ownerUserId = :ownerUserId")
    Integer findMaxUserSeqNoByOwnerUserId(@Param("ownerUserId") Long ownerUserId);

    default int nextUserSeqNo(Long ownerUserId) {
        if (ownerUserId == null) {
            return 1;
        }
        Integer max = findMaxUserSeqNoByOwnerUserId(ownerUserId);
        return (max != null ? max : 0) + 1;
    }
}
