package com.example.przetargapp.przetarg;

import java.util.List;
import java.util.UUID;

public record OpcjeFiltrowPrzetarguResponse(
        List<OpcjaSlowa> slowa
) {
    public record OpcjaSlowa(UUID id, String fraza, TypSlowaKluczowego typ) {
    }
}
