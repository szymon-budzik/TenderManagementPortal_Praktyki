package com.example.przetargapp.przetarg;

import java.time.LocalDateTime;
import java.util.UUID;

public record SlowoKluczoweResponse(
        UUID id,
        String fraza,
        TypSlowaKluczowego typ,
        String kategoria,
        int punkty,
        boolean aktywne,
        LocalDateTime dataUtworzenia
) {
}
