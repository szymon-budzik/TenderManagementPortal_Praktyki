package com.example.przetargapp.przetarg;
import com.example.przetargapp.user.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bids", uniqueConstraints = @UniqueConstraint(
        name = "uk_bids_tender_contractor", columnNames = {"tender_id", "contractor_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Oferta {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tender_id", nullable = false)
    private Przetarg przetarg;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "contractor_id", nullable = false)
    private User wykonawca;

    @Column(name = "price", nullable = false, precision = 14, scale = 2)
    private BigDecimal cena;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String opis;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private LocalDateTime dataZlozenia;

    @PrePersist
    protected void onCreate() {
        dataZlozenia = LocalDateTime.now();
    }
}
