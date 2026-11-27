package com.przetargi.java_backend.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record CreateSharedReportRequest(
        List<Long> sharedTenderIds,
        String reportName
) {}
