package com.example.przetargapp.user;

import jakarta.validation.constraints.NotNull;

public record ZmianaRoliUseraRequest(@NotNull Rola rola) {
}
