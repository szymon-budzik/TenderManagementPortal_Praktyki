package com.example.przetargapp.przetarg;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PrzetargHistoriaStatusuRepository extends JpaRepository<PrzetargHistoriaStatusu, UUID> {
    @Query("""
            select historia from PrzetargHistoriaStatusu historia
            where historia.przetarg.id = :przetargId
              and (historia.uzytkownikId is null or historia.uzytkownikId = :uzytkownikId)
            order by historia.dataZmiany desc
            """)
    List<PrzetargHistoriaStatusu> findVisibleForUser(
            @Param("przetargId") UUID przetargId, @Param("uzytkownikId") UUID uzytkownikId);
}
