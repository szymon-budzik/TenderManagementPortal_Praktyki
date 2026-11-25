package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserSummary> getAllUsers() {
        return userRepository.findAll().stream()
                .map(UserSummary::fromEntity)
                .toList();
    }

    @Transactional
    public UserSummary createUser(String username, String email, String password, String roleStr) {
        String trimmedUsername = username.trim();
        String trimmedEmail = email.trim();

        if (userRepository.existsByUsername(trimmedUsername)) {
            throw new IllegalArgumentException("Użytkownik o loginie '" + username + "' już istnieje.");
        }
        if (userRepository.existsByEmail(trimmedEmail)) {
            throw new IllegalArgumentException("Adres email '" + email + "' jest już zajęty.");
        }

        Role role = parseRole(roleStr);

        User user = User.builder()
                .username(trimmedUsername)
                .email(trimmedEmail)
                .password(passwordEncoder.encode(password))
                .role(role)
                .isActive(true)
                .build();

        return UserSummary.fromEntity(userRepository.save(user));
    }

    @Transactional
    public UserSummary updateUser(Long id, String email, String roleStr, Boolean isActive, String currentUsername) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono użytkownika o ID: " + id));

        boolean isRootAdmin = "admin".equalsIgnoreCase(user.getUsername());
        boolean isSelf = currentUsername != null && currentUsername.equalsIgnoreCase(user.getUsername());

        if (email != null && !email.isBlank()) {
            user.setEmail(email.trim());
        }
        if (roleStr != null && !roleStr.isBlank()) {
            Role newRole = parseRole(roleStr);
            if ((isRootAdmin || isSelf) && newRole != Role.ROLE_ADMIN) {
                throw new IllegalArgumentException("Nie można odebrać uprawnień ROLE_ADMIN głównemu lub własnemu kontu administratora.");
            }
            user.setRole(newRole);
        }
        if (isActive != null) {
            if ((isRootAdmin || isSelf) && !Boolean.TRUE.equals(isActive)) {
                throw new IllegalArgumentException("Nie można zablokować głównego ani własnego konta administratora.");
            }
            user.setIsActive(isActive);
        }

        return UserSummary.fromEntity(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id, String currentUsername) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono użytkownika o ID: " + id));

        if ("admin".equalsIgnoreCase(user.getUsername())
                || (currentUsername != null && currentUsername.equalsIgnoreCase(user.getUsername()))) {
            throw new IllegalArgumentException("Nie można usunąć głównego ani własnego konta administratora.");
        }

        userRepository.deleteById(id);
    }

    public Role parseRole(String roleStr) {
        if (roleStr == null) return Role.ROLE_USER;
        try {
            String normalized = roleStr.startsWith("ROLE_") ? roleStr : "ROLE_" + roleStr;
            return Role.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Role.ROLE_USER;
        }
    }

    public record UserSummary(Long id, String username, String email, String role, Boolean isActive) {
        public static UserSummary fromEntity(User u) {
            return new UserSummary(
                    u.getId(),
                    u.getUsername(),
                    u.getEmail(),
                    u.getRole().name(),
                    u.getIsActive()
            );
        }
    }
}
