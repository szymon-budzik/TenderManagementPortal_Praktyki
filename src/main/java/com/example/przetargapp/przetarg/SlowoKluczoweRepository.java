package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SlowoKluczoweRepository extends JpaRepository<SlowoKluczowe, UUID> {
    List<SlowoKluczowe> findAllByOrderByTypAscFrazaAsc();
    List<SlowoKluczowe> findAllByAktywneTrue();
    boolean existsByFrazaIgnoreCaseAndTyp(String fraza, TypSlowaKluczowego typ);
    boolean existsByFrazaIgnoreCaseAndTypAndIdNot(String fraza, TypSlowaKluczowego typ, UUID id);
}
