package com.przetargi.java_backend.entity;

import jakarta.persistence.*;
import lombok.*;
import com.przetargi.java_backend.entity.enums.Role;

import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private Role role;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Builder.Default
    @Column(name = "notify_shared_tenders", nullable = false)
    private Boolean notifySharedTenders = true;

    @Builder.Default
    @Column(name = "notify_shared_reports", nullable = false)
    private Boolean notifySharedReports = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}
