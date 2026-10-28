package com.example.przetargapp.user;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "first_name", nullable = false)
    private String imie;

    @Column(name = "last_name", nullable = false)
    private String nazwisko;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "role", nullable = false)
    private Rola rola = Rola.USER;

    @Size(min = 9, max = 9)
    @Column(name = "phone", nullable = false, unique = true)
    private String telefon;

    @Email
    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String haslo;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime dataUtworzenia;

    @PrePersist
    protected void onCreate(){
        this.dataUtworzenia = LocalDateTime.now();
    }

}
