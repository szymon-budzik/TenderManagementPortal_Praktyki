package com.example.przetargapp.przetarg;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tender_status_history")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrzetargHistoriaStatusu {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tender_id", nullable = false)
    private Przetarg przetarg;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 24)
    private StatusOperacyjny poprzedniStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 24)
    private StatusOperacyjny nowyStatus;

    @Column(name = "changed_by", length = 160)
    private String zmienilUzytkownik;

    @Column(name = "user_id")
    private UUID uzytkownikId;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private LocalDateTime dataZmiany;

    @PrePersist
    protected void onCreate() {
        dataZmiany = LocalDateTime.now();
    }
}
