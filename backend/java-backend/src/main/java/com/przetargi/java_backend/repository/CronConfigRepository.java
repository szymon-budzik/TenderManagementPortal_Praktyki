package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.CronConfig;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CronConfigRepository extends JpaRepository<CronConfig, Long> {
}