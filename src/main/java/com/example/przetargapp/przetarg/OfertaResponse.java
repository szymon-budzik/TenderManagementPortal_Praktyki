package com.example.przetargapp.przetarg;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record OfertaResponse(
        UUID id,
        UUID przetargId,
        String tytulPrzetargu,
        BigDecimal cena,
        String opis,
        LocalDateTime dataZlozenia
) {
}
