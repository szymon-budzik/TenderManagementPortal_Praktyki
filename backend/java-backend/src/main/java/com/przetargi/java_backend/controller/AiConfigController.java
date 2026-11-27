package com.przetargi.java_backend.controller;

import com.przetargi.java_backend.dto.AiConfigDto;
import com.przetargi.java_backend.dto.AiConfigRequest;
import com.przetargi.java_backend.dto.AiModelOptionDto;
import com.przetargi.java_backend.dto.AiModelsFetchRequest;
import com.przetargi.java_backend.service.AiConfigService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai-configs")
public class AiConfigController {

    private final AiConfigService service;

    public AiConfigController(AiConfigService service) {
        this.service = service;
    }

    @GetMapping
    public List<AiConfigDto> listAll() {
        return service.listAll();
    }

    @PostMapping
    public ResponseEntity<AiConfigDto> create(@RequestBody AiConfigRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public AiConfigDto update(@PathVariable Long id, @RequestBody AiConfigRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/fetch-models")
    public List<AiModelOptionDto> fetchModels(@RequestBody AiModelsFetchRequest request) {
        return service.fetchAvailableModels(request);
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ErrorMessage> handleError(RuntimeException ex) {
        return ResponseEntity.badRequest().body(new ErrorMessage(ex.getMessage()));
    }

    public record ErrorMessage(String message) {}
}
