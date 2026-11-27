package com.przetargi.java_backend.entity;

import com.przetargi.java_backend.entity.enums.TenderStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "user_tenders",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "tender_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserTender {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "tender_id", nullable = false)
    private Tender tender;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TenderStatus status = TenderStatus.NEW;

    @Builder.Default
    @Column(nullable = false)
    private Integer score = 0;

    @Column(name = "score_breakdown", columnDefinition = "TEXT")
    private String scoreBreakdown;

    @Builder.Default
    @Column(name = "has_unread_update", nullable = false)
    private Boolean hasUnreadUpdate = false;

    @Builder.Default
    @Column(name = "last_read_update_version", nullable = false)
    private Integer lastReadUpdateVersion = 0;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (this.createdAt == null) this.createdAt = now;
        if (this.updatedAt == null) this.updatedAt = now;
        if (this.status == null) this.status = TenderStatus.NEW;
        if (this.score == null) this.score = 0;
        if (this.hasUnreadUpdate == null) this.hasUnreadUpdate = false;
        if (this.lastReadUpdateVersion == null) this.lastReadUpdateVersion = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
