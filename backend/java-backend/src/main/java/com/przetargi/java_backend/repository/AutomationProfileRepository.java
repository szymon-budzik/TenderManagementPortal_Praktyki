package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.AutomationProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AutomationProfileRepository extends JpaRepository<AutomationProfile, Long> {
    List<AutomationProfile> findAllByOrderByIdAsc();
}