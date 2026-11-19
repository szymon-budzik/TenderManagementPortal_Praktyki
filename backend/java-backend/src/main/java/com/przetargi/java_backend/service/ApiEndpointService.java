package com.przetargi.java_backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.przetargi.java_backend.dto.ApiEndpointDto;
import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.repository.ApiEndpointRepository;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ApiEndpointService {

    private final ApiEndpointRepository repository;

    @Transactional(readOnly = true)
    public List<ApiEndpointDto> getAll() {
        return repository.findAll().stream().map(ApiEndpointDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<ApiEndpointDto> getActiveEndpoints() {
        return repository.findByIsActiveTrue().stream().map(ApiEndpointDto::fromEntity).toList();
    }

    @Transactional
    public ApiEndpointDto create(ApiEndpointDto dto) {
        String method = dto.getHttpMethod() != null ? dto.getHttpMethod().toUpperCase() : "GET";
        String cleanPayload = "GET".equals(method)
            ? null
            : (dto.getPayload() != null && !dto.getPayload().isBlank() ? dto.getPayload().trim() : null);
        String cleanNotes = (dto.getNotes() != null && !dto.getNotes().isBlank()) ? dto.getNotes().trim() : null;

        ApiEndpoint entity = ApiEndpoint.builder()
            .name(dto.getName())
            .url(dto.getUrl())
            .httpMethod(method)
            .payload(cleanPayload)
            .notes(cleanNotes)
            .isActive(dto.getIsActive() != null ? dto.getIsActive() : true)
            .build();

        return ApiEndpointDto.fromEntity(repository.save(entity));
    }

    @Transactional
    public ApiEndpointDto update(Long id, ApiEndpointDto dto) {
        ApiEndpoint entity = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono źródła o ID: " + id));

        if (dto.getName() != null) entity.setName(dto.getName());
        if (dto.getUrl() != null) entity.setUrl(dto.getUrl());
        if (dto.getHttpMethod() != null) entity.setHttpMethod(dto.getHttpMethod().toUpperCase());

        if ("GET".equalsIgnoreCase(entity.getHttpMethod())) {
            entity.setPayload(null);
        } else if (dto.getPayload() != null) {
            entity.setPayload(dto.getPayload().isBlank() ? null : dto.getPayload().trim());
        }

        if (dto.getNotes() != null) {
            entity.setNotes(dto.getNotes().isBlank() ? null : dto.getNotes().trim());
        }

        if (dto.getIsActive() != null) entity.setIsActive(dto.getIsActive());

        return ApiEndpointDto.fromEntity(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new IllegalArgumentException("Nie znaleziono źródła o ID: " + id);
        }
        repository.deleteById(id);
    }

    @Transactional
    public void markSyncFinished(Long id) {
        repository.findById(id).ifPresent(e -> e.setLastSyncAt(OffsetDateTime.now()));
    }
}