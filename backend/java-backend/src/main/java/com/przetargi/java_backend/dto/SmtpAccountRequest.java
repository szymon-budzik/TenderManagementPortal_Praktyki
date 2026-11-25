package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SmtpAccountRequest(
        String name,
        String smtpHost,
        Integer smtpPort,
        String smtpUsername,
        String smtpPassword
) {}
