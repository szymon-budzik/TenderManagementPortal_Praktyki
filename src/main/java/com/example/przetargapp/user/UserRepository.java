package com.example.przetargapp.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByTelefon(String telefon);
    Optional<User> findByEmailIgnoreCase(String email);
    List<User> findByNazwiskoContainingIgnoreCase(String nazwisko);

// Wyszukiwarka pod jedno pole tekstowe (np. w panelu admina).
    // - CONCAT('%', :query, '%') + LIKE: szuka wpisanej frazy w dowolnym miejscu tekstu (początek, środek, koniec).
    // - LOWER(...): zamienia wszystko na małe litery, więc wielkość znaków nie ma znaczenia.
    // - OR: wystarczy, że tekst pasuje do imienia, nazwiska LUB maila.
    // - :query + @Param: bezpiecznie przekazuje tekst z metody i chroni przed SQL Injection.
    @Query("SELECT u FROM User u WHERE " +
            "LOWER(u.imie) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.nazwisko) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<User> searchUsers(@Param("query") String query);
}
