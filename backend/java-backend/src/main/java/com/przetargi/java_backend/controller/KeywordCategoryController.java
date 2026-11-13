package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.KeywordCategoryDto;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/keywords")
public class KeywordCategoryController {

    private final KeywordCategoryRepository repository;

    public KeywordCategoryController(KeywordCategoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<KeywordCategoryDto>> getAll() {
        List<KeywordCategoryDto> list = new ArrayList<>();
        for (KeywordCategory entity : repository.findAll()) {
            list.add(KeywordCategoryDto.fromEntity(entity));
        }
        return ResponseEntity.ok(list);
    }

    @PostMapping
    public ResponseEntity<KeywordCategoryDto> create(@Valid @RequestBody KeywordCategoryDto dto) {
        KeywordCategory entity = new KeywordCategory();
        entity.setName(dto.getName().trim());
        entity.setKeywords(normalizeKeywordsWithWeights(dto.getKeywords()));
        entity.setScore(50);
        entity.setIsExcluded(false);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(KeywordCategoryDto.fromEntity(repository.save(entity)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<KeywordCategoryDto> update(
            @PathVariable Long id,
            @Valid @RequestBody KeywordCategoryDto dto
    ) {
        KeywordCategory entity = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono kategorii o ID: " + id));

        entity.setName(dto.getName().trim());
        entity.setKeywords(normalizeKeywordsWithWeights(dto.getKeywords()));
        entity.setScore(50);
        entity.setIsExcluded(false);

        return ResponseEntity.ok(KeywordCategoryDto.fromEntity(repository.save(entity)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Nie znaleziono kategorii o ID: " + id);
        }
        repository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleError(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse(ex.getMessage()));
    }

    public record ErrorResponse(String message) {}

    private String normalizeKeywordsWithWeights(String raw) {
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
            int colonIdx = trimmed.lastIndexOf(':');
            if (colonIdx > 0) {
                String word = trimmed.substring(0, colonIdx).trim();
                String suffix = trimmed.substring(colonIdx + 1).trim().toUpperCase();
                if (word.isEmpty()) {
                    continue;
                }
                if ("EXCLUDED".equals(suffix)) {
                    formatted.add(word + ":EXCLUDED");
                } else {
                    try {
                        int weight = Math.max(1, Math.min(100, Integer.parseInt(suffix)));
                        formatted.add(word + ":" + weight);
                    } catch (NumberFormatException e) {
                        formatted.add(word + ":50");
                    }
                }
            } else {
                formatted.add(trimmed + ":50");
            }
        }

        if (formatted.isEmpty()) {
            throw new IllegalArgumentException("Podaj przynajmniej jedno poprawne słowo kluczowe.");
        }
        return String.join(", ", formatted);
    }
}