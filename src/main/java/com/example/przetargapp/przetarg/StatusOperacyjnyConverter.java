package com.example.przetargapp.przetarg;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Maps status names used by the Python collector to the Java domain enum. */
@Converter
public class StatusOperacyjnyConverter implements AttributeConverter<StatusOperacyjny, String> {
    @Override
    public String convertToDatabaseColumn(StatusOperacyjny status) {
        return status == null ? null : status.name();
    }

    @Override
    public StatusOperacyjny convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return StatusOperacyjny.NOWY;
        }

        return switch (value.toUpperCase()) {
            case "NOWY", "NEW", "NEUTRAL" -> StatusOperacyjny.NOWY;
            case "INTERESUJACY", "INTERESTING", "MATCHED" -> StatusOperacyjny.INTERESUJACY;
            case "ODRZUCONY", "REJECTED" -> StatusOperacyjny.ODRZUCONY;
            default -> throw new IllegalArgumentException("Nieznany status operacyjny w bazie: " + value);
        };
    }
}
