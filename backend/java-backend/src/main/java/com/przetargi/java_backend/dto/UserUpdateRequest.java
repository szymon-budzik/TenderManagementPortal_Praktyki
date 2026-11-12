package com.przetargi.java_backend.dto;

import lombok.Getter;
import lombok.Setter;
import com.przetargi.java_backend.entity.enums.Role;

@Getter
@Setter
public class UserUpdateRequest {
    private Role role;
    private Boolean isActive;
}