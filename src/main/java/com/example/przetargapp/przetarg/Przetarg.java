package com.example.przetargapp.przetarg;

import com.example.przetargapp.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "tenders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Przetarg {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "title", nullable = false, length = 160)
    private String tytul;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String opis;

    @Column(name = "category", nullable = false, length = 100)
    private String kategoria;

    @Column(name = "location", nullable = false, length = 160)
    private String lokalizacja;

    @Column(name = "submission_deadline", nullable = false)
    private LocalDateTime terminSkladaniaOfert;

    @Convert(converter = StatusPrzetarguConverter.class)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private StatusPrzetargu status = StatusPrzetargu.OTWARTY;

    @Convert(converter = StatusOperacyjnyConverter.class)
    @Column(name = "operational_status", length = 24)
    @Builder.Default
    private StatusOperacyjny statusOperacyjny = StatusOperacyjny.NOWY;

    @Column(name = "score")
    @Builder.Default
    private int punktacja = 0;

    @Column(name = "status_manually_set")
    @Builder.Default
    private boolean statusUstawionyRecznie = false;

    @Column(name = "source_url", length = 2048)
    private String adresZrodla;

    @ManyToMany
    @JoinTable(
            name = "tender_matched_keywords",
            joinColumns = @JoinColumn(name = "tender_id"),
            inverseJoinColumns = @JoinColumn(name = "keyword_id")
    )
    @Builder.Default
    private Set<SlowoKluczowe> dopasowaneSlowa = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizer_id")
    private User organizator;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime dataUtworzenia;

    @PrePersist
    protected void onCreate() {
        dataUtworzenia = LocalDateTime.now();
    }
    
}
