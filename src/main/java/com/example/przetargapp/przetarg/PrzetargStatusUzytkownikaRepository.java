package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PrzetargStatusUzytkownikaRepository
        extends JpaRepository<PrzetargStatusUzytkownika, UUID> {
    Optional<PrzetargStatusUzytkownika> findByUzytkownikIdAndPrzetargId(UUID uzytkownikId, UUID przetargId);

    List<PrzetargStatusUzytkownika> findAllByUzytkownikIdAndPrzetargIdIn(
            UUID uzytkownikId, Collection<UUID> przetargIds);
}
