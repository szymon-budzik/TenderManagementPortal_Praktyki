package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.UserTender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserTenderRepository extends JpaRepository<UserTender, Long>, JpaSpecificationExecutor<UserTender> {

    Optional<UserTender> findByUserIdAndTenderId(Long userId, Long tenderId);

    List<UserTender> findByUserIdAndStatusOrderByIdAsc(Long userId, TenderStatus status);

    List<UserTender> findByTenderIdAndStatus(Long tenderId, TenderStatus status);

    List<UserTender> findByUserIdAndTenderIdIn(Long userId, Collection<Long> tenderIds);

    long countByUserId(Long userId);

    long countByUserIdAndStatus(Long userId, TenderStatus status);

    long countByUserIdAndStatusAndHasUnreadUpdateTrue(Long userId, TenderStatus status);

    long countByUserIdAndScoreGreaterThanEqual(Long userId, int score);

    long countByTenderId(Long tenderId);

    void deleteByUserIdAndTenderId(Long userId, Long tenderId);

    @Query("SELECT COALESCE(AVG(ut.score), 0.0) FROM UserTender ut WHERE ut.userId = :userId")
    Double calculateAverageScoreByUserId(@Param("userId") Long userId);

    @Query("SELECT ut.status, COUNT(ut) FROM UserTender ut WHERE ut.userId = :userId GROUP BY ut.status")
    List<Object[]> countByUserIdGroupByStatus(@Param("userId") Long userId);

    @Query("SELECT DISTINCT ut.tender FROM UserTender ut WHERE ut.status = :status ORDER BY ut.tender.id ASC")
    List<Tender> findDistinctTendersByStatus(@Param("status") TenderStatus status);
}
