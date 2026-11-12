package com.przetargi.java_backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import com.przetargi.java_backend.entity.enums.Role;

@Getter
@Setter
public class UserCreateRequest {

    @NotBlank(message = "Username jest wymagany")
    @Size(min = 3, max = 50)
    private String username;

    @NotBlank(message = "Email jest wymagany")
    @Email(message = "Niepoprawny format email")
    private String email;

    @NotBlank(message = "Hasło jest wymagane")
    @Size(min = 6, message = "Hasło musi mieć co najmniej 6 znaków")
    private String password;

    @NotNull(message = "Rola jest wymagana")
    private Role role;
}