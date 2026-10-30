package com.example.przetargapp.przetarg;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Keeps Java tender statuses compatible with records imported by the Python
 * collector. The collector stores its classification status in the same
 * database column as the Java lifecycle status.
 */
@Converter
public class StatusPrzetarguConverter implements AttributeConverter<StatusPrzetargu, String> {
    @Override
    public String convertToDatabaseColumn(StatusPrzetargu status) {
        return status == null ? null : status.name();
    }

    @Override
    public StatusPrzetargu convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return StatusPrzetargu.OTWARTY;
        }

        return switch (value.toUpperCase()) {
            case "OTWARTY", "OPEN", "MATCHED", "NEUTRAL", "REJECTED" -> StatusPrzetargu.OTWARTY;
            case "ZAMKNIETY", "CLOSED" -> StatusPrzetargu.ZAMKNIETY;
            default -> throw new IllegalArgumentException("Nieznany status przetargu w bazie: " + value);
        };
    }
}
