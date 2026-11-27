package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record GroupRequest(
        String name,
        String description,
        Long parentId
) {}
