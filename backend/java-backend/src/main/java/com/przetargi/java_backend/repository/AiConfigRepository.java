package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.AiConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AiConfigRepository extends JpaRepository<AiConfig, Long> {
    List<AiConfig> findAllByOrderByIdAsc();
    Optional<AiConfig> findFirstByIsDefaultTrue();
}