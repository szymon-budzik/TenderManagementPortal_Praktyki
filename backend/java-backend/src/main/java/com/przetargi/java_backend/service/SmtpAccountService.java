package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.SmtpAccountDto;
import com.przetargi.java_backend.dto.SmtpAccountRequest;
import com.przetargi.java_backend.entity.SmtpAccount;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class SmtpAccountService {

    private final SmtpAccountRepository smtpAccountRepository;

    public SmtpAccountService(SmtpAccountRepository smtpAccountRepository) {
        this.smtpAccountRepository = smtpAccountRepository;
    }

    @Transactional(readOnly = true)
    public List<SmtpAccountDto> getAllAccounts() {
        return smtpAccountRepository.findAllByOrderByIdAsc().stream()
                .map(SmtpAccountDto::fromEntity)
                .toList();
    }

    @Transactional
    public SmtpAccountDto createAccount(SmtpAccountRequest incoming) {
        SmtpAccount acc = new SmtpAccount();
        acc.setName(incoming.name() != null ? incoming.name().trim() : "Serwer SMTP");
        acc.setSmtpHost(incoming.smtpHost() != null ? incoming.smtpHost().trim() : "");
        acc.setSmtpPort(incoming.smtpPort() != null ? incoming.smtpPort() : 587);
        acc.setSmtpUsername(incoming.smtpUsername() != null ? incoming.smtpUsername().trim() : "");
        acc.setSmtpPassword(incoming.smtpPassword() != null ? incoming.smtpPassword() : "");
        return SmtpAccountDto.fromEntity(smtpAccountRepository.save(acc));
    }

    @Transactional
    public SmtpAccountDto updateAccount(Long id, SmtpAccountRequest incoming) {
        SmtpAccount acc = smtpAccountRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono konta SMTP o ID: " + id));

        if (incoming.name() != null) acc.setName(incoming.name().trim());
        if (incoming.smtpHost() != null) acc.setSmtpHost(incoming.smtpHost().trim());
        if (incoming.smtpPort() != null) acc.setSmtpPort(incoming.smtpPort());
        if (incoming.smtpUsername() != null) acc.setSmtpUsername(incoming.smtpUsername().trim());
        if (incoming.smtpPassword() != null && !incoming.smtpPassword().isBlank()) {
            acc.setSmtpPassword(incoming.smtpPassword());
        }

        return SmtpAccountDto.fromEntity(smtpAccountRepository.save(acc));
    }

    @Transactional
    public void deleteAccount(Long id) {
        if (smtpAccountRepository.existsById(id)) {
            smtpAccountRepository.deleteById(id);
        }
    }
}
