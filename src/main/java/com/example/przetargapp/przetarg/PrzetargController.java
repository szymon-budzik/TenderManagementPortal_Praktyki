package com.example.przetargapp.przetarg;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/przetargi")
@RequiredArgsConstructor
public class PrzetargController {
    private final PrzetargService przetargService;
    @GetMapping
    public List<PrzetargResponse> lista(
            @RequestParam(required = false) StatusOperacyjny status,
            @RequestParam(required = false) LocalDateTime od,
            @RequestParam(required = false) LocalDateTime doDaty,
            @RequestParam(required = false) Integer minPunktacja,
            @RequestParam(required = false) Integer maxPunktacja,
            @RequestParam(required = false) UUID slowoId,
            @RequestParam(required = false) String query,
            Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return przetargService.listaPrzetargow(
                status, od, doDaty, minPunktacja, maxPunktacja, slowoId, query, userId);
    }

    @GetMapping("/filtry")
    public OpcjeFiltrowPrzetarguResponse opcjeFiltrow() {
        return przetargService.opcjeFiltrowPrzetargu();
    }

    @GetMapping("/{id}")
    public PrzetargResponse szczegoly(@PathVariable UUID id, Authentication authentication) {
        return przetargService.pobierz(id, UUID.fromString(authentication.getName()));
    }

    @GetMapping("/{id}/historia")
    public List<PrzetargHistoriaStatusuResponse> historiaStatusow(
            @PathVariable UUID id, Authentication authentication) {
        return przetargService.historiaStatusow(id, UUID.fromString(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<PrzetargResponse> utworz(
            @RequestParam UUID organizatorId,
            @Valid @RequestBody PrzetargRequest request,
            Authentication authentication
    ) {
        requireSelfOrAdmin(organizatorId, authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(przetargService.utworz(organizatorId, request));
    }

    @GetMapping("/organizator/{id}")
    public List<PrzetargResponse> przetargiOrganizatora(@PathVariable UUID id, Authentication authentication) {
        requireSelfOrAdmin(id, authentication);
        return przetargService.przetargiOrganizatora(id, UUID.fromString(authentication.getName()));
    }

    @PostMapping("/{id}/zamknij")
    public PrzetargResponse zamknij(
            @PathVariable UUID id, @RequestParam UUID organizatorId, Authentication authentication) {
        requireSelfOrAdmin(organizatorId, authentication);
        return przetargService.zamknij(id, organizatorId, UUID.fromString(authentication.getName()));
    }

    @PatchMapping("/{id}/status")
    public PrzetargResponse zmienStatus(
            @PathVariable UUID id,
            @Valid @RequestBody ZmienStatusPrzetarguRequest request,
            Authentication authentication) {
        UUID requesterId = UUID.fromString(authentication.getName());
        return przetargService.zmienStatusOperacyjny(id, request.status(), requesterId);
    }

    @PostMapping("/{id}/oferty")
    public ResponseEntity<OfertaResponse> zlozOferte(
            @PathVariable UUID id,
            @RequestParam UUID wykonawcaId,
            @Valid @RequestBody OfertaRequest request,
            Authentication authentication
    ) {
        requireSelfOrAdmin(wykonawcaId, authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(przetargService.zlozOferte(id, wykonawcaId, request));
    }

    @GetMapping("/oferty/uzytkownika/{id}")
    public List<OfertaResponse> ofertyUzytkownika(@PathVariable UUID id, Authentication authentication) {
        requireSelfOrAdmin(id, authentication);
        return przetargService.ofertyUzytkownika(id);
    }

    private void requireSelfOrAdmin(UUID requestedId, Authentication authentication) {
        if (authentication == null || (!authentication.getName().equals(requestedId.toString())
                && authentication.getAuthorities().stream().noneMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN")))) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Brak uprawnień do danych tego użytkownika");
        }
    }
}
