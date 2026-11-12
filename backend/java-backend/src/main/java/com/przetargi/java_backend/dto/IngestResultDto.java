package com.przetargi.java_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class IngestResultDto {
    private int processed;
    private int saved;
    private int duplicatesSkipped;
}