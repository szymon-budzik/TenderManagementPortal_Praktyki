package com.example.przetargapp.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetHaslaRequest(@NotBlank @Size(min = 8, max = 100) String haslo) {
}
