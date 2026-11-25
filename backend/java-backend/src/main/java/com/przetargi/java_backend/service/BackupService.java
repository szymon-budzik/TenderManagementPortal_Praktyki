package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.ApiEndpoint;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.KeywordCategory;
import com.przetargi.java_backend.repository.ApiEndpointRepository;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.SmtpAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class BackupService {

    private final ApiEndpointRepository endpointRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final AutomationProfileRepository profileRepository;
    private final SmtpAccountRepository smtpAccountRepository;
    private final TenderDateService dateService;

    public BackupService(
            ApiEndpointRepository endpointRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            AutomationProfileRepository profileRepository,
            SmtpAccountRepository smtpAccountRepository,
            TenderDateService dateService
    ) {
        this.endpointRepository = endpointRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.profileRepository = profileRepository;
        this.smtpAccountRepository = smtpAccountRepository;
        this.dateService = dateService;
    }

    @Transactional(readOnly = true)
    public ConfigBackupDto exportConfig() {
        List<EndpointBackupDto> endpoints = endpointRepository.findAll().stream()
                .sorted(Comparator.comparing(e -> e.getId() != null ? e.getId() : 0L))
                .map(e -> new EndpointBackupDto(
                        e.getId(),
                        e.getName(),
                        e.getUrl(),
                        e.getHttpMethod(),
                        e.getPayload(),
                        e.getLinkTemplate(),
                        e.getNotes(),
                        e.getIsActive()
                ))
                .toList();

        List<KeywordCategoryBackupDto> categories = keywordCategoryRepository.findAll().stream()
                .sorted(Comparator.comparing(c -> c.getId() != null ? c.getId() : 0L))
                .map(c -> new KeywordCategoryBackupDto(
                        c.getId(),
                        c.getName(),
                        c.getKeywords(),
                        c.getScore(),
                        c.getIsExcluded()
                ))
                .toList();

        List<AutomationProfileBackupDto> profiles = profileRepository.findAllByOrderByIdAsc().stream()
                .map(p -> new AutomationProfileBackupDto(
                        p.getName(),
                        p.getEnabled(),
                        p.getScheduleType(),
                        p.getCronTime(),
                        p.getIntervalMinutes(),
                        p.getCronDays(),
                        p.getSmtpAccountId(),
                        p.getMatchMode(),
                        p.getEndpointIds(),
                        p.getCategoryIds(),
                        p.getRecipientEmails(),
                        p.getNotificationsEnabled()
                ))
                .toList();

        return new ConfigBackupDto(
                1,
                dateService.nowPoland().toString(),
                endpoints,
                categories,
                profiles
        );
    }

    @Transactional
    public ImportSummaryDto importConfig(ConfigImportRequest request) {
        if (request == null || request.backup() == null) {
            throw new IllegalArgumentException("Brak danych konfiguracji do zaimportowania.");
        }

        ConfigBackupDto backup = request.backup();
        boolean replaceMode = "REPLACE".equalsIgnoreCase(request.mode());

        if (replaceMode) {
            profileRepository.deleteAll();
            keywordCategoryRepository.deleteAll();
            endpointRepository.deleteAll();
            profileRepository.flush();
            keywordCategoryRepository.flush();
            endpointRepository.flush();
        }

        Map<String, ApiEndpoint> existingEndpointsByName = new HashMap<>();
        for (ApiEndpoint e : endpointRepository.findAll()) {
            if (e.getName() != null) {
                existingEndpointsByName.put(e.getName().trim().toLowerCase(), e);
            }
        }

        Map<String, KeywordCategory> existingCategoriesByName = new HashMap<>();
        for (KeywordCategory c : keywordCategoryRepository.findAll()) {
            if (c.getName() != null) {
                existingCategoriesByName.put(c.getName().trim().toLowerCase(), c);
            }
        }

        Map<String, AutomationProfile> existingProfilesByName = new HashMap<>();
        for (AutomationProfile p : profileRepository.findAll()) {
            if (p.getName() != null) {
                existingProfilesByName.put(p.getName().trim().toLowerCase(), p);
            }
        }

        Map<Long, Long> endpointIdMap = new HashMap<>();
        Map<Long, Long> categoryIdMap = new HashMap<>();

        int endpointsCreated = 0;
        int endpointsUpdated = 0;
        int categoriesCreated = 0;
        int categoriesUpdated = 0;
        int profilesCreated = 0;
        int profilesUpdated = 0;

        if (backup.endpoints() != null) {
            for (EndpointBackupDto dto : backup.endpoints()) {
                if (dto.name() == null || dto.name().isBlank() || dto.url() == null || dto.url().isBlank()) {
                    continue;
                }
                String key = dto.name().trim().toLowerCase();
                ApiEndpoint entity = existingEndpointsByName.get(key);
                boolean isNew = (entity == null);
                if (entity == null) {
                    entity = new ApiEndpoint();
                }

                entity.setName(dto.name().trim());
                entity.setUrl(dto.url().trim());
                entity.setHttpMethod(dto.httpMethod() != null && !dto.httpMethod().isBlank()
                        ? dto.httpMethod().trim().toUpperCase()
                        : "GET");
                entity.setPayload(dto.payload() != null && !dto.payload().isBlank() ? dto.payload() : null);
                entity.setLinkTemplate(dto.linkTemplate() != null && !dto.linkTemplate().isBlank()
                        ? dto.linkTemplate().trim()
                        : null);
                entity.setNotes(dto.notes() != null && !dto.notes().isBlank() ? dto.notes() : null);
                entity.setIsActive(dto.isActive() != null ? dto.isActive() : true);

                ApiEndpoint saved = endpointRepository.save(entity);
                existingEndpointsByName.put(key, saved);
                if (dto.id() != null) {
                    endpointIdMap.put(dto.id(), saved.getId());
                }

                if (isNew) endpointsCreated++;
                else endpointsUpdated++;
            }
        }

        if (backup.keywordCategories() != null) {
            for (KeywordCategoryBackupDto dto : backup.keywordCategories()) {
                if (dto.name() == null || dto.name().isBlank()) {
                    continue;
                }
                String key = dto.name().trim().toLowerCase();
                KeywordCategory entity = existingCategoriesByName.get(key);
                boolean isNew = (entity == null);
                if (entity == null) {
                    entity = new KeywordCategory();
                }

                entity.setName(dto.name().trim());
                entity.setKeywords(dto.keywords() != null ? dto.keywords() : "");
                entity.setScore(dto.score() != null ? dto.score() : 50);
                entity.setIsExcluded(Boolean.TRUE.equals(dto.isExcluded()));

                KeywordCategory saved = keywordCategoryRepository.save(entity);
                existingCategoriesByName.put(key, saved);
                if (dto.id() != null) {
                    categoryIdMap.put(dto.id(), saved.getId());
                }

                if (isNew) categoriesCreated++;
                else categoriesUpdated++;
            }
        }

        if (backup.automationProfiles() != null) {
            for (AutomationProfileBackupDto dto : backup.automationProfiles()) {
                if (dto.name() == null || dto.name().isBlank()) {
                    continue;
                }
                String key = dto.name().trim().toLowerCase();
                AutomationProfile entity = existingProfilesByName.get(key);
                boolean isNew = (entity == null);
                if (entity == null) {
                    entity = new AutomationProfile();
                }

                entity.setName(dto.name().trim());
                entity.setEnabled(Boolean.TRUE.equals(dto.enabled()));
                entity.setScheduleType(dto.scheduleType() != null && !dto.scheduleType().isBlank()
                        ? dto.scheduleType()
                        : "DAILY");
                entity.setCronTime(dto.cronTime() != null && !dto.cronTime().isBlank()
                        ? dto.cronTime()
                        : "08:00");
                entity.setIntervalMinutes(dto.intervalMinutes() != null ? dto.intervalMinutes() : 60);
                entity.setCronDays(dto.cronDays() != null ? dto.cronDays() : "1,2,3,4,5");
                entity.setMatchMode(dto.matchMode() != null && !dto.matchMode().isBlank()
                        ? dto.matchMode()
                        : "ANY");
                entity.setEndpointIds(remapIdList(dto.endpointIds(), endpointIdMap));
                entity.setCategoryIds(remapIdList(dto.categoryIds(), categoryIdMap));
                entity.setRecipientEmails(dto.recipientEmails() != null ? dto.recipientEmails().trim() : "");
                entity.setNotificationsEnabled(dto.notificationsEnabled() != null ? dto.notificationsEnabled() : true);

                Long smtpId = dto.smtpAccountId();
                if (smtpId != null && smtpAccountRepository.existsById(smtpId)) {
                    entity.setSmtpAccountId(smtpId);
                } else {
                    entity.setSmtpAccountId(null);
                }

                AutomationProfile saved = profileRepository.save(entity);
                existingProfilesByName.put(key, saved);

                if (isNew) profilesCreated++;
                else profilesUpdated++;
            }
        }

        String msg = String.format(
                "Import zakończony (%s). Endpointy: +%d / zakt. %d | Kategorie: +%d / zakt. %d | Profile: +%d / zakt. %d.",
                replaceMode ? "Zastąpiono konfigurację" : "Połączono z istniejącą",
                endpointsCreated, endpointsUpdated,
                categoriesCreated, categoriesUpdated,
                profilesCreated, profilesUpdated
        );

        return new ImportSummaryDto(
                endpointsCreated,
                endpointsUpdated,
                categoriesCreated,
                categoriesUpdated,
                profilesCreated,
                profilesUpdated,
                msg
        );
    }

    private String remapIdList(String raw, Map<Long, Long> idMap) {
        if (raw == null || raw.isBlank()) return "";
        List<String> remapped = new ArrayList<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) continue;
            String[] pieces = trimmed.split(":", 2);
            try {
                Long oldId = Long.parseLong(pieces[0].trim());
                Long newId = idMap.get(oldId);
                if (newId != null) {
                    if (pieces.length > 1 && !pieces[1].isBlank()) {
                        remapped.add(newId + ":" + pieces[1].trim().toUpperCase());
                    } else {
                        remapped.add(String.valueOf(newId));
                    }
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return String.join(",", remapped);
    }

    public record EndpointBackupDto(
            Long id,
            String name,
            String url,
            String httpMethod,
            String payload,
            String linkTemplate,
            String notes,
            Boolean isActive
    ) {}

    public record KeywordCategoryBackupDto(
            Long id,
            String name,
            String keywords,
            Integer score,
            Boolean isExcluded
    ) {}

    public record AutomationProfileBackupDto(
            String name,
            Boolean enabled,
            String scheduleType,
            String cronTime,
            Integer intervalMinutes,
            String cronDays,
            Long smtpAccountId,
            String matchMode,
            String endpointIds,
            String categoryIds,
            String recipientEmails,
            Boolean notificationsEnabled
    ) {}

    public record ConfigBackupDto(
            int version,
            String exportedAt,
            List<EndpointBackupDto> endpoints,
            List<KeywordCategoryBackupDto> keywordCategories,
            List<AutomationProfileBackupDto> automationProfiles
    ) {}

    public record ConfigImportRequest(
            String mode,
            ConfigBackupDto backup
    ) {}

    public record ImportSummaryDto(
            int endpointsCreated,
            int endpointsUpdated,
            int categoriesCreated,
            int categoriesUpdated,
            int profilesCreated,
            int profilesUpdated,
            String message
    ) {}
}
