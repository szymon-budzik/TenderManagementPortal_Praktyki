package com.przetargi.java_backend.dto;

import java.util.List;

public record SharePeerDto(
        Long userId,
        String username,
        String email,
        List<String> sharedGroups
) {}
