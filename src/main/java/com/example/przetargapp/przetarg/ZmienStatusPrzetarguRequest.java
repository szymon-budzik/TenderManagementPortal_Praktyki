package com.example.przetargapp.przetarg;

import jakarta.validation.constraints.NotNull;

public record ZmienStatusPrzetarguRequest(@NotNull StatusOperacyjny status) {
}
