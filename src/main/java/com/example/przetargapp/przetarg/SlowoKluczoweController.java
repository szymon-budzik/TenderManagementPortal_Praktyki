package com.example.przetargapp.przetarg;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/slowa-kluczowe")
@RequiredArgsConstructor
public class SlowoKluczoweController {
    private final SlowoKluczoweService service;

    @GetMapping
    public List<SlowoKluczoweResponse> lista(Authentication authentication) {
        return service.lista(UUID.fromString(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<SlowoKluczoweResponse> utworz(
            @Valid @RequestBody SlowoKluczoweRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.utworz(request, UUID.fromString(authentication.getName())));
    }

    @PutMapping("/{id}")
    public SlowoKluczoweResponse aktualizuj(
            @PathVariable UUID id, @Valid @RequestBody SlowoKluczoweRequest request,
            Authentication authentication) {
        return service.aktualizuj(id, request, UUID.fromString(authentication.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> usun(@PathVariable UUID id, Authentication authentication) {
        service.usun(id, UUID.fromString(authentication.getName()));
        return ResponseEntity.noContent().build();
    }
}
