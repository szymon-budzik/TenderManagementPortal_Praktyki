package com.example.przetargapp.przetarg;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_tender_statuses", uniqueConstraints = @UniqueConstraint(
        name = "uk_user_tender_statuses_tender_user", columnNames = {"tender_id", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrzetargStatusUzytkownika {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tender_id", nullable = false)
    private UUID przetargId;

    @Column(name = "user_id", nullable = false)
    private UUID uzytkownikId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private StatusOperacyjny status;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime dataZmiany;

    @jakarta.persistence.PrePersist
    @jakarta.persistence.PreUpdate
    protected void aktualizujDateZmiany() {
        dataZmiany = LocalDateTime.now();
    }
}
