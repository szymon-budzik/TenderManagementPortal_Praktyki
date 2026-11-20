package com.przetargi.java_backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.przetargi.java_backend.entity.ApiEndpoint;

import java.util.List;

public interface ApiEndpointRepository extends JpaRepository<ApiEndpoint, Long> {
    List<ApiEndpoint> findByIsActiveTrue();
    List<ApiEndpoint> findAllByOrderByIdAsc();
}