package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.FetchRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FetchRunRepository extends JpaRepository<FetchRun, Long> {
    List<FetchRun> findAllByOrderByCreatedAtDesc();
}