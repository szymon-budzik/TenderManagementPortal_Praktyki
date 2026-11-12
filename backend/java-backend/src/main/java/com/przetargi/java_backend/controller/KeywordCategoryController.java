package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.KeywordCategoryDto;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/keywords")
public class KeywordCategoryController {

    private final KeywordCategoryRepository repository;

    public KeywordCategoryController(KeywordCategoryRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<KeywordCategoryDto>> getAll() {
        return ResponseEntity.ok(
            repository.findAll().stream().map(KeywordCategoryDto::fromEntity).toList()
        );
    }

    @PostMapping
    public ResponseEntity<KeywordCategoryDto> create(@Valid @RequestBody KeywordCategoryDto dto) {
        boolean excluded = Boolean.TRUE.equals(dto.getIsExcluded());
        int score = excluded ? 1 : clampScore(dto.getScore());

        KeywordCategory entity = KeywordCategory.builder()
            .name(dto.getName().trim())
            .keywords(normalizeKeywords(dto.getKeywords()))
            .score(score)
            .isExcluded(excluded)
            .build();

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(KeywordCategoryDto.fromEntity(repository.save(entity)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<KeywordCategoryDto> update(@PathVariable Long id,
                                                     @Valid @RequestBody KeywordCategoryDto dto) {
        KeywordCategory entity = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono kategorii o ID: " + id));

        boolean excluded = Boolean.TRUE.equals(dto.getIsExcluded());
        entity.setName(dto.getName().trim());
        entity.setKeywords(normalizeKeywords(dto.getKeywords()));
        entity.setIsExcluded(excluded);
        entity.setScore(excluded ? 1 : clampScore(dto.getScore()));

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

    public static class ErrorResponse {
        private final String message;
        public ErrorResponse(String message) { this.message = message; }
        public String getMessage() { return message; }
    }

    private String normalizeKeywords(String raw) {
        String cleaned = Arrays.stream(raw.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.joining(", "));
        if (cleaned.isEmpty()) {
            throw new IllegalArgumentException("Podaj przynajmniej jedno słowo kluczowe.");
        }
        return cleaned;
    }

    private int clampScore(Integer score) {
        if (score == null) return 10;
        return Math.max(1, Math.min(100, score));
    }
}