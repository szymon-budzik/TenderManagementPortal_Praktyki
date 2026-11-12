package com.przetargi.java_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "keyword_categories")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KeywordCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String keywords;

    @Column(nullable = false)
    private Integer score;

    @Column(name = "is_excluded", nullable = false)
    private Boolean isExcluded;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}