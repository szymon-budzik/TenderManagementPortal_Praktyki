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

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String color = "#93c5fd";

    @Builder.Default
    @Column(name = "light_text", nullable = false)
    private Boolean lightText = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}