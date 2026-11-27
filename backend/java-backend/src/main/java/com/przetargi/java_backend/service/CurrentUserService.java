package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Optional<String> getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return Optional.empty();
        }
        String name = auth.getName();
        return (name != null && !name.isBlank()) ? Optional.of(name) : Optional.empty();
    }

    public User requireCurrentUser() {
        String username = getCurrentUsername()
                .orElseThrow(() -> new AccessDeniedException("Brak uwierzytelnionego użytkownika."));
        return requireByUsername(username);
    }

    public User requireByUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new AccessDeniedException("Brak uwierzytelnionego użytkownika.");
        }
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new AccessDeniedException("Nie znaleziono użytkownika: " + username));
    }

    public Optional<Long> resolveUserId(String username) {
        if (username != null && !username.isBlank()) {
            return userRepository.findByUsername(username).map(User::getId);
        }
        return getCurrentUsername().flatMap(userRepository::findByUsername).map(User::getId);
    }

    public Optional<Long> findFallbackAdminId() {
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.ROLE_ADMIN)
                .map(User::getId)
                .sorted()
                .findFirst();
    }
}
