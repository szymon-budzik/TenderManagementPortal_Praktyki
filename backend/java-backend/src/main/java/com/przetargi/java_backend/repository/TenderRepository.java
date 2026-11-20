package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.Tender;
import com.przetargi.java_backend.entity.enums.TenderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface TenderRepository extends JpaRepository<Tender, Long>, JpaSpecificationExecutor<Tender> {
    boolean existsByExternalId(String externalId);
    Optional<Tender> findByExternalId(String externalId);
    List<Tender> findByStatusOrderByIdAsc(TenderStatus status);
    Optional<Tender> findFirstByGroupKeyAndStatus(String groupKey, TenderStatus status);
    long countByStatus(TenderStatus status);
    long countByStatusAndHasUnreadUpdateTrue(TenderStatus status);

    @Query("SELECT AVG(t.score) FROM Tender t")
    Double calculateAverageScore();

    long countByScoreGreaterThanEqual(int score);

    @Query("SELECT t.status, COUNT(t) FROM Tender t GROUP BY t.status")
    List<Object[]> countTendersByStatus();
}