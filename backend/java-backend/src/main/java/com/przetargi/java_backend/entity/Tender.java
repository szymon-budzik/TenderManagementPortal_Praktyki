package com.przetargi.java_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import com.przetargi.java_backend.entity.enums.TenderStatus;

import java.time.OffsetDateTime;

@Entity
@Table(name = "tenders")
@Getter 
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class Tender {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_id", nullable = false, unique = true, length = 100)
    private String externalId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TenderStatus status;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "publication_date")
    private OffsetDateTime publicationDate;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}
