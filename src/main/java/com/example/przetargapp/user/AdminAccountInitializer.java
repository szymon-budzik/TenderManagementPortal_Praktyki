package com.example.przetargapp.user;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@RequiredArgsConstructor
public class AdminAccountInitializer implements ApplicationRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email:}")
    private String email;

    @Value("${app.admin.password:}")
    private String password;

    @Value("${app.admin.phone:}")
    private String phone;

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() && password.isBlank() && phone.isBlank()) {
            return;
        }
        if (email.isBlank() || password.isBlank() || !phone.matches("[0-9]{9}") || password.length() < 8) {
            throw new IllegalStateException("Do utworzenia administratora wymagane są poprawne ADMIN_EMAIL, ADMIN_PASSWORD i ADMIN_PHONE");
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        User existing = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
        if (existing != null) {
            if (existing.getRola() != Rola.ADMIN) {
                throw new IllegalStateException("ADMIN_EMAIL jest już przypisany do konta bez uprawnień administratora");
            }
            return;
        }
        if (userRepository.existsByTelefon(phone)) {
            throw new IllegalStateException("ADMIN_PHONE jest już przypisany do innego konta");
        }

        userRepository.save(User.builder()
                .imie("Administrator")
                .nazwisko("Systemu")
                .email(normalizedEmail)
                .telefon(phone)
                .haslo(passwordEncoder.encode(password))
                .rola(Rola.ADMIN)
                .build());
    }
}
