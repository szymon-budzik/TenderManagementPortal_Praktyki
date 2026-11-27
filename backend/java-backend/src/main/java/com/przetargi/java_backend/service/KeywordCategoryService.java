package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.KeywordCategoryDto;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
public class KeywordCategoryService {

    public static final String DEFAULT_COLOR = "#93c5fd";
    private static final Pattern HEX_COLOR_PATTERN = Pattern.compile("^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$");

    private final KeywordCategoryRepository repository;

    public KeywordCategoryService(KeywordCategoryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<KeywordCategoryDto> getAll() {
        List<KeywordCategoryDto> list = new ArrayList<>();
        for (KeywordCategory entity : repository.findAll()) {
            list.add(KeywordCategoryDto.fromEntity(entity));
        }
        return list;
    }

    @Transactional
    public KeywordCategoryDto create(KeywordCategoryDto dto) {
        KeywordCategory entity = new KeywordCategory();
        entity.setName(dto.getName().trim());
        entity.setKeywords(normalizeKeywordsWithWeights(dto.getKeywords()));
        entity.setScore(50);
        entity.setIsExcluded(false);
        entity.setColor(normalizeColor(dto.getColor(), DEFAULT_COLOR));
        entity.setLightText(Boolean.TRUE.equals(dto.getLightText()));
        return KeywordCategoryDto.fromEntity(repository.save(entity));
    }

    @Transactional
    public KeywordCategoryDto update(Long id, KeywordCategoryDto dto) {
        KeywordCategory entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono kategorii o ID: " + id));

        entity.setName(dto.getName().trim());
        entity.setKeywords(normalizeKeywordsWithWeights(dto.getKeywords()));
        entity.setScore(50);
        entity.setIsExcluded(false);
        if (dto.getColor() != null && !dto.getColor().isBlank()) {
            entity.setColor(normalizeColor(dto.getColor(), DEFAULT_COLOR));
        } else if (entity.getColor() == null || entity.getColor().isBlank()) {
            entity.setColor(DEFAULT_COLOR);
        }
        if (dto.getLightText() != null) {
            entity.setLightText(dto.getLightText());
        } else if (entity.getLightText() == null) {
            entity.setLightText(false);
        }
        return KeywordCategoryDto.fromEntity(repository.save(entity));
    }

    private String normalizeColor(String raw, String fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String trimmed = raw.trim();
        if (!HEX_COLOR_PATTERN.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("Nieprawidłowy format koloru (oczekiwano hex, np. #93c5fd).");
        }
        return trimmed.toLowerCase();
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Nie znaleziono kategorii o ID: " + id);
        }
        repository.deleteById(id);
    }

    public String normalizeKeywordsWithWeights(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Podaj przynajmniej jedno słowo kluczowe.");
        }
        String[] parts = raw.split(",");
        List<String> formatted = new ArrayList<>();

        for (String part : parts) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }

            boolean isWildcard = false;
            if (trimmed.toUpperCase().endsWith(":WILDCARD")) {
                isWildcard = true;
                trimmed = trimmed.substring(0, trimmed.length() - ":WILDCARD".length()).trim();
            }

            String word;
            String base;
            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                word = trimmed.substring(0, colonIdx).trim();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) {
                    continue;
                }
                if ("EXCLUDED".equals(suffix)) {
                    base = word + ":EXCLUDED";
                } else {
                    try {
                        int weight = Math.max(1, Math.min(100, Integer.parseInt(suffix)));
                        base = word + ":" + weight;
                    } catch (NumberFormatException e) {
                        base = word + ":50";
                    }
                }
            } else {
                word = trimmed;
                base = word + ":50";
            }

            boolean allowWildcard = isWildcard && word.length() > 1 && word.endsWith("*");
            formatted.add(allowWildcard ? base + ":WILDCARD" : base);
        }

        if (formatted.isEmpty()) {
            throw new IllegalArgumentException("Podaj przynajmniej jedno poprawne słowo kluczowe.");
        }
        return String.join(", ", formatted);
    }
}
