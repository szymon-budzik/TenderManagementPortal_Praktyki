package com.przetargi.java_backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    @NotBlank(message = "Login jest wymagany")
    private String username;

    @NotBlank(message = "Haslo jest wymagane")
    private String password;
}