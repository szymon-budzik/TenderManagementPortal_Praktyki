package com.example.przetargapp.przetarg;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/slowa-kluczowe")
@RequiredArgsConstructor
public class SlowoKluczoweController {
    private final SlowoKluczoweService service;

    @GetMapping
    public List<SlowoKluczoweResponse> lista() {
        return service.lista();
    }

    @PostMapping
    public ResponseEntity<SlowoKluczoweResponse> utworz(@Valid @RequestBody SlowoKluczoweRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.utworz(request));
    }

    @PutMapping("/{id}")
    public SlowoKluczoweResponse aktualizuj(
            @PathVariable UUID id, @Valid @RequestBody SlowoKluczoweRequest request) {
        return service.aktualizuj(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> usun(@PathVariable UUID id) {
        service.usun(id);
        return ResponseEntity.noContent().build();
    }
}
