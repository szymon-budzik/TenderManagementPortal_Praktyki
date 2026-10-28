package com.example.przetargapp.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record LoginRequestDTO(
        @NotBlank(message = "email jest wymagany")
        @Email(message = "niepoprawny format email")
        String email,
        @NotBlank(message = "Haslo jest wymagane")
        String haslo
) {
}
