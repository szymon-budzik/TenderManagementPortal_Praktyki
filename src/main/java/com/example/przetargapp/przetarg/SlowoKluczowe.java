package com.example.przetargapp.przetarg;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "keywords", uniqueConstraints = @UniqueConstraint(
        name = "uk_keywords_phrase_type", columnNames = {"phrase", "keyword_type"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlowoKluczowe {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "phrase", nullable = false, length = 200)
    private String fraza;

    @Enumerated(EnumType.STRING)
    @Column(name = "keyword_type", nullable = false, length = 24)
    private TypSlowaKluczowego typ;

    @Column(name = "category", length = 100)
    private String kategoria;

    @Column(name = "score", nullable = false)
    @Builder.Default
    private int punkty = 1;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean aktywne = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime dataUtworzenia;

    @ManyToMany(mappedBy = "dopasowaneSlowa")
    @Builder.Default
    private Set<Przetarg> przetargi = new HashSet<>();

    @PrePersist
    protected void onCreate() {
        dataUtworzenia = LocalDateTime.now();
    }
}
