package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SlowoKluczoweRepository extends JpaRepository<SlowoKluczowe, UUID> {
    List<SlowoKluczowe> findAllByOrderByTypAscFrazaAsc();
    List<SlowoKluczowe> findAllByAktywneTrue();
    List<SlowoKluczowe> findAllByWlascicielIdOrderByTypAscFrazaAsc(UUID wlascicielId);
    List<SlowoKluczowe> findAllByAktywneTrueAndWlascicielId(UUID wlascicielId);
    java.util.Optional<SlowoKluczowe> findByIdAndWlascicielId(UUID id, UUID wlascicielId);
    boolean existsByWlascicielIdAndFrazaIgnoreCaseAndTyp(UUID wlascicielId, String fraza, TypSlowaKluczowego typ);
    boolean existsByWlascicielIdAndFrazaIgnoreCaseAndTypAndIdNot(UUID wlascicielId, String fraza, TypSlowaKluczowego typ, UUID id);
}
