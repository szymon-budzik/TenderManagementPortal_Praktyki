package com.przetargi.java_backend.dto;

public record GroupMemberDto(
        Long userId,
        String username,
        String email,
        boolean active
) {}
