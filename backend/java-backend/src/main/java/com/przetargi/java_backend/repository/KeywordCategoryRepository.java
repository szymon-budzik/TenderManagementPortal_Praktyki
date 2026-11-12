package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.KeywordCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KeywordCategoryRepository extends JpaRepository<KeywordCategory, Long> {
}