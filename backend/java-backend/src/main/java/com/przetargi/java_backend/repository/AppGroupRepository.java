package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.AppGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppGroupRepository extends JpaRepository<AppGroup, Long> {
    List<AppGroup> findAllByOrderByIdAsc();
    List<AppGroup> findByParentIdOrderByIdAsc(Long parentId);
    boolean existsByParentIdIsNullAndNameIgnoreCase(String name);
    boolean existsByParentIdAndNameIgnoreCase(Long parentId, String name);
}
