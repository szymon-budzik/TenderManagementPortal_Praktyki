package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.KeywordCategoryDto;
import com.przetargi.java_backend.service.KeywordCategoryService;
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

import java.util.List;

@RestController
@RequestMapping("/api/keywords")
public class KeywordCategoryController {

    private final KeywordCategoryService keywordCategoryService;

    public KeywordCategoryController(KeywordCategoryService keywordCategoryService) {
        this.keywordCategoryService = keywordCategoryService;
    }

    @GetMapping
    public ResponseEntity<List<KeywordCategoryDto>> getAll() {
        return ResponseEntity.ok(keywordCategoryService.getAll());
    }

    @PostMapping
    public ResponseEntity<KeywordCategoryDto> create(@Valid @RequestBody KeywordCategoryDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(keywordCategoryService.create(dto));
    }

    @PutMapping("/{id}")
    public ResponseEntity<KeywordCategoryDto> update(
            @PathVariable Long id,
            @Valid @RequestBody KeywordCategoryDto dto
    ) {
        return ResponseEntity.ok(keywordCategoryService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        keywordCategoryService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleError(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse(ex.getMessage()));
    }

    public record ErrorResponse(String message) {}
}
