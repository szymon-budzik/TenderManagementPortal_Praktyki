package com.example.przetargapp.przetarg;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record PrzetargRequest(
        @NotBlank @Size(max = 160) String tytul,
        @NotBlank String opis,
        @NotBlank @Size(max = 100) String kategoria,
        @NotBlank @Size(max = 160) String lokalizacja,
        @NotNull @Future LocalDateTime terminSkladaniaOfert
) {
}
