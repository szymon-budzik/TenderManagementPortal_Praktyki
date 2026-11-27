package com.przetargi.java_backend.dto;

import java.time.LocalDateTime;
import java.util.List;

public record GroupDto(
        Long id,
        String name,
        String description,
        Long parentId,
        List<GroupMemberDto> members,
        List<GroupDto> subgroups,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
