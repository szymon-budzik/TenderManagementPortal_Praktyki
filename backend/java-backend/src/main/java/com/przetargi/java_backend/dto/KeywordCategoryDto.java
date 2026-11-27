package com.przetargi.java_backend.dto;

import com.przetargi.java_backend.entity.KeywordCategory;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeywordCategoryDto {
    private Long id;

    @NotBlank(message = "Nazwa kategorii jest wymagana")
    private String name;

    @NotBlank(message = "Słowa kluczowe są wymagane")
    private String keywords;

    private Integer score;
    private Boolean isExcluded;
    private String color;
    private Boolean lightText;

    public static KeywordCategoryDto fromEntity(KeywordCategory entity) {
        return KeywordCategoryDto.builder()
            .id(entity.getId())
            .name(entity.getName())
            .keywords(entity.getKeywords())
            .score(entity.getScore())
            .isExcluded(entity.getIsExcluded())
            .color(entity.getColor() != null && !entity.getColor().isBlank() ? entity.getColor() : "#93c5fd")
            .lightText(Boolean.TRUE.equals(entity.getLightText()))
            .build();
    }
}
