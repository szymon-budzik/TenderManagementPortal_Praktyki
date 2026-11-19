package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.enums.Role;
import com.przetargi.java_backend.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminUserController(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        List<UserResponse> list = userRepository.findAll().stream()
            .map(UserResponse::fromEntity)
            .toList();
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserDto req) {
        if (userRepository.existsByUsername(req.getUsername().trim())) {
            throw new IllegalArgumentException("Użytkownik o loginie '" + req.getUsername() + "' już istnieje.");
        }
        if (userRepository.existsByEmail(req.getEmail().trim())) {
            throw new IllegalArgumentException("Adres email '" + req.getEmail() + "' jest już zajęty.");
        }

        Role role = parseRole(req.getRole());

        User user = User.builder()
            .username(req.getUsername().trim())
            .email(req.getEmail().trim())
            .password(passwordEncoder.encode(req.getPassword()))
            .role(role)
            .isActive(true)
            .build();

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(UserResponse.fromEntity(userRepository.save(user)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<UserResponse> updateUser(@PathVariable Long id,
                                                   @RequestBody UpdateUserDto req,
                                                   Authentication authentication) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono użytkownika o ID: " + id));

        String currentUsername = authentication != null ? authentication.getName() : null;
        boolean isRootAdmin = "admin".equalsIgnoreCase(user.getUsername());
        boolean isSelf = currentUsername != null && currentUsername.equalsIgnoreCase(user.getUsername());

        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            user.setEmail(req.getEmail().trim());
        }
        if (req.getRole() != null && !req.getRole().isBlank()) {
            Role newRole = parseRole(req.getRole());
            if ((isRootAdmin || isSelf) && newRole != Role.ROLE_ADMIN) {
                throw new IllegalArgumentException("Nie można odebrać uprawnień ROLE_ADMIN głównemu lub własnemu kontu administratora.");
            }
            user.setRole(newRole);
        }
        if (req.getIsActive() != null) {
            if ((isRootAdmin || isSelf) && !Boolean.TRUE.equals(req.getIsActive())) {
                throw new IllegalArgumentException("Nie można zablokować głównego ani własnego konta administratora.");
            }
            user.setIsActive(req.getIsActive());
        }

        return ResponseEntity.ok(UserResponse.fromEntity(userRepository.save(user)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id, Authentication authentication) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono użytkownika o ID: " + id));

        String currentUsername = authentication != null ? authentication.getName() : null;
        if ("admin".equalsIgnoreCase(user.getUsername())
                || (currentUsername != null && currentUsername.equalsIgnoreCase(user.getUsername()))) {
            throw new IllegalArgumentException("Nie można usunąć głównego ani własnego konta administratora.");
        }

        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse(ex.getMessage()));
    }

    private Role parseRole(String roleStr) {
        if (roleStr == null) return Role.ROLE_USER;
        try {
            String normalized = roleStr.startsWith("ROLE_") ? roleStr : "ROLE_" + roleStr;
            return Role.valueOf(normalized.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Role.ROLE_USER;
        }
    }

    public static class ErrorResponse {
        private final String message;
        public ErrorResponse(String message) { this.message = message; }
        public String getMessage() { return message; }
    }

    public static class CreateUserDto {
        @NotBlank(message = "Login jest wymagany")
        private String username;

        @NotBlank(message = "Email jest wymagany")
        @Email(message = "Niepoprawny format adresu email")
        private String email;

        @NotBlank(message = "Hasło jest wymagane")
        @Size(min = 6, message = "Hasło musi mieć minimum 6 znaków")
        private String password;

        private String role;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getPassword() { return password; }
        public void setPassword(String password) { this.password = password; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
    }

    public static class UpdateUserDto {
        private String email;
        private String role;
        private Boolean isActive;

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }
        public String getRole() { return role; }
        public void setRole(String role) { this.role = role; }
        public Boolean getIsActive() { return isActive; }
        public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    }

    public static class UserResponse {
        private final Long id;
        private final String username;
        private final String email;
        private final String role;
        private final Boolean isActive;

        public UserResponse(Long id, String username, String email, String role, Boolean isActive) {
            this.id = id;
            this.username = username;
            this.email = email;
            this.role = role;
            this.isActive = isActive;
        }

        public Long getId() { return id; }
        public String getUsername() { return username; }
        public String getEmail() { return email; }
        public String getRole() { return role; }
        public Boolean getIsActive() { return isActive; }

        public static UserResponse fromEntity(User u) {
            return new UserResponse(
                u.getId(),
                u.getUsername(),
                u.getEmail(),
                u.getRole().name(),
                u.getIsActive()
            );
        }
    }
}