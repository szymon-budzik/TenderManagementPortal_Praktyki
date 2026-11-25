package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.SmtpAccount;

public record SmtpAccountDto(
        Long id,
        String name,
        String smtpHost,
        Integer smtpPort,
        String smtpUsername,
        boolean hasPassword
) {
    public static SmtpAccountDto fromEntity(SmtpAccount acc) {
        return new SmtpAccountDto(
                acc.getId(),
                acc.getName(),
                acc.getSmtpHost(),
                acc.getSmtpPort(),
                acc.getSmtpUsername(),
                acc.getSmtpPassword() != null && !acc.getSmtpPassword().isBlank()
        );
    }
}
