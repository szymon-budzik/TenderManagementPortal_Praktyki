package com.example.przetargapp.user;

import org.springframework.web.bind.annotation.RequestBody;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @Value("${app.admin.email:}")
    private String emailAdministratora;

    @PostMapping("/rejestracja")
    public ResponseEntity<UserResponse> zarejestruj(@Valid @RequestBody RejestrowanieUseraDTO request) {
        UserResponse userResponse = userService.zarejestruj(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(userResponse);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> obsluzNieprawidloweDane(
            MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .distinct()
                .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest().body(Map.of("message", message));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> obsluzBladUzytkownika(ResponseStatusException exception) {
        String message = exception.getReason() == null ? "Nie udało się wykonać operacji." : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message", message));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> pobierzProfil(@PathVariable UUID id, Authentication authentication) {
        requireSelfOrAdmin(id, authentication);
        return ResponseEntity.ok(userService.pobierzProfil(id));
    }

    @PostMapping("/login")
    public ResponseEntity<UserResponse> zaloguj(@Valid @RequestBody LoginRequestDTO request, HttpServletRequest httpRequest) {
        UserResponse user = userService.zaloguj(request);
        HttpSession session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        httpRequest.getSession(true).setAttribute("userId", user.id());
        return ResponseEntity.ok(user);
    }

    @GetMapping("/recovery-contact")
    public ResponseEntity<Map<String, String>> pobierzKontaktOdzyskiwania() {
        return ResponseEntity.ok(Map.of("email", emailAdministratora == null ? "" : emailAdministratora.trim()));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> wyloguj(HttpSession session) {
        session.invalidate();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin")
    public ResponseEntity<List<UserResponse>> pobierzUzytkownikow(
            @RequestParam(required = false) String query,
            HttpSession session) {
        return ResponseEntity.ok(userService.pobierzUzytkownikow(zalogowanyUserId(session), query));
    }

    @PutMapping("/admin/{id}/rola")
    public ResponseEntity<UserResponse> zmienRole(
            @PathVariable UUID id,
            @Valid @RequestBody ZmianaRoliUseraRequest request,
            HttpSession session) {
        return ResponseEntity.ok(userService.zmienRole(zalogowanyUserId(session), id, request.rola()));
    }

    @PostMapping("/admin")
    public ResponseEntity<UserResponse> utworzUzytkownika(
            @Valid @RequestBody AdminCreateUserRequest request, HttpSession session) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(userService.utworzPrzezAdministratora(zalogowanyUserId(session), request));
    }

    @PutMapping("/admin/{id}/haslo")
    public ResponseEntity<Void> resetujHaslo(
            @PathVariable UUID id, @Valid @RequestBody ResetHaslaRequest request, HttpSession session) {
        userService.resetujHaslo(zalogowanyUserId(session), id, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/admin/{id}")
    public ResponseEntity<Void> usunUzytkownika(@PathVariable UUID id, HttpSession session) {
        userService.usunUzytkownika(zalogowanyUserId(session), id);
        return ResponseEntity.noContent().build();
    }

    private UUID zalogowanyUserId(HttpSession session) {
        Object userId = session.getAttribute("userId");
        if (userId instanceof UUID id) {
            return id;
        }
        throw new org.springframework.web.server.ResponseStatusException(
                HttpStatus.UNAUTHORIZED, "Zaloguj się, aby wykonać tę operację");
    }

    private void requireSelfOrAdmin(UUID requestedId, Authentication authentication) {
        if (authentication == null || (!authentication.getName().equals(requestedId.toString())
                && authentication.getAuthorities().stream()
                .noneMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Brak uprawnień do profilu tego użytkownika");
        }
    }
}
