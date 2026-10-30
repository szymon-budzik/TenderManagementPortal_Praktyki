package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OfertaRepository extends JpaRepository<Oferta, UUID> {
    boolean existsByPrzetargIdAndWykonawcaId(UUID przetargId, UUID wykonawcaId);
    boolean existsByWykonawcaId(UUID wykonawcaId);
    List<Oferta> findByWykonawcaIdOrderByDataZlozeniaDesc(UUID wykonawcaId);
    long countByPrzetargId(UUID przetargId);
}
