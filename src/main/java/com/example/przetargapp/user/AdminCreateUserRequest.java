package com.example.przetargapp.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AdminCreateUserRequest(
        @NotBlank @Size(max = 100) String imie,
        @NotBlank @Size(max = 100) String nazwisko,
        @NotBlank @Pattern(regexp = "[0-9]{9}") String telefon,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Size(min = 8, max = 100) String haslo,
        @NotNull Rola rola
) {
}
