package com.przetargi.java_backend.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import com.przetargi.java_backend.entity.enums.TenderStatus;

@Getter
@Setter
public class UpdateStatusRequest {
    @NotNull(message = "Status nie może być pusty")
    private TenderStatus status;
}