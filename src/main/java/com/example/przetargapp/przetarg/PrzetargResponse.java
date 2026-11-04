package com.example.przetargapp.przetarg;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record PrzetargResponse(
        UUID id,
        String tytul,
        String opis,
        String kategoria,
        String lokalizacja,
        LocalDateTime terminSkladaniaOfert,
        String status,
        String adresZrodla,
        LocalDateTime dataUtworzenia,
        UUID organizatorId,
        String organizator,
        long liczbaOfert,
        StatusOperacyjny statusOperacyjny,
        int punktacja,
        List<String> dopasowaneSlowa
) {
}
