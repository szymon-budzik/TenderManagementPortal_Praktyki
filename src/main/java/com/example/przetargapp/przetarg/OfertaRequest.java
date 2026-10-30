package com.example.przetargapp.przetarg;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record OfertaRequest(
        @NotNull @DecimalMin("0.01") BigDecimal cena,
        @NotBlank @Size(max = 5000) String opis
) {
}
