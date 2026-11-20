package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.TenderUpdate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TenderUpdateRepository extends JpaRepository<TenderUpdate, Long> {
    List<TenderUpdate> findByTenderIdOrderByVersionNumberDesc(Long tenderId);
    List<TenderUpdate> findByTenderIdInOrderByVersionNumberDesc(List<Long> tenderIds);
    List<TenderUpdate> findByTenderIdAndIsReadFalse(Long tenderId);
}