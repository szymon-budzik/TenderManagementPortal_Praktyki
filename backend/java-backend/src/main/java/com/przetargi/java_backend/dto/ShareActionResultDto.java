package com.przetargi.java_backend.dto;

public record ShareActionResultDto(
        int sharedItemsCount,
        int skippedCount,
        int recipientsCount,
        String message
) {
    public ShareActionResultDto(int sharedItemsCount, int recipientsCount, String message) {
        this(sharedItemsCount, 0, recipientsCount, message);
    }
}
