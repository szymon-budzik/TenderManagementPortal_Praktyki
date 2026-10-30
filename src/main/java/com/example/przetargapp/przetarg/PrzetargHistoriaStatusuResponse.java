package com.example.przetargapp.przetarg;

import java.time.LocalDateTime;
import java.util.UUID;

public record PrzetargHistoriaStatusuResponse(
        UUID id,
        StatusOperacyjny poprzedniStatus,
        StatusOperacyjny nowyStatus,
        String zmienilUzytkownik,
        LocalDateTime dataZmiany
) {
}
