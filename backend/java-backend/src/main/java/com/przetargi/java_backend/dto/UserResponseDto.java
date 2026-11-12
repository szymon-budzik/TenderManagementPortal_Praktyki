package com.przetargi.java_backend.dto;

import lombok.Builder;
import lombok.Getter;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.entity.enums.Role;

import java.time.OffsetDateTime;

@Getter
@Builder
public class UserResponseDto {
    private Long id;
    private String username;
    private String email;
    private Role role;
    private Boolean isActive;
    private OffsetDateTime createdAt;

    public static UserResponseDto fromEntity(User user) {
        return UserResponseDto.builder()
            .id(user.getId())
            .username(user.getUsername())
            .email(user.getEmail())
            .role(user.getRole())
            .isActive(user.getIsActive())
            .createdAt(user.getCreatedAt())
            .build();
    }
}