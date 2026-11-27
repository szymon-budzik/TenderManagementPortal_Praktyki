package com.przetargi.java_backend.repository;

import com.przetargi.java_backend.entity.AppGroupMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AppGroupMemberRepository extends JpaRepository<AppGroupMember, Long> {
    List<AppGroupMember> findByGroupId(Long groupId);
    List<AppGroupMember> findByUserId(Long userId);
    boolean existsByGroupIdAndUserId(Long groupId, Long userId);
    void deleteByGroupIdAndUserId(Long groupId, Long userId);
    void deleteByGroupId(Long groupId);
}
