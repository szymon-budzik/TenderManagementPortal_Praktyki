package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AutomationProfileDto;
import com.przetargi.java_backend.dto.AutomationProfileRequest;
import com.przetargi.java_backend.dto.FetchRunDto;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AutomationService {

    private final AutomationProfileRepository profileRepository;
    private final FetchRunRepository fetchRunRepository;
    private final TenderExecutionService executionService;
    private final ReportExportService reportExportService;
    private final ReportEmailService reportEmailService;

    public AutomationService(
            AutomationProfileRepository profileRepository,
            FetchRunRepository fetchRunRepository,
            TenderExecutionService executionService,
            ReportExportService reportExportService,
            ReportEmailService reportEmailService
    ) {
        this.profileRepository = profileRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.executionService = executionService;
        this.reportExportService = reportExportService;
        this.reportEmailService = reportEmailService;
    }

    @Transactional(readOnly = true)
    public List<AutomationProfileDto> getProfiles() {
        return profileRepository.findAllByOrderByIdAsc().stream()
                .map(AutomationProfileDto::fromEntity)
                .toList();
    }

    @Transactional
    public AutomationProfileDto createProfile(AutomationProfileRequest incoming) {
        if (incoming.name() == null || incoming.name().isBlank()) {
            throw new IllegalArgumentException("Nazwa profilu jest wymagana.");
        }
        AutomationProfile p = new AutomationProfile();
        p.setName(incoming.name().trim());
        p.setEnabled(Boolean.TRUE.equals(incoming.enabled()));
        p.setScheduleType(incoming.scheduleType() != null ? incoming.scheduleType() : "DAILY");
        p.setCronTime(incoming.cronTime() != null && !incoming.cronTime().isBlank()
                ? incoming.cronTime().trim() : "08:00");
        p.setIntervalMinutes(incoming.intervalMinutes() != null ? incoming.intervalMinutes() : 60);
        p.setCronDays(incoming.cronDays() != null ? incoming.cronDays() : "1,2,3,4,5");
        p.setSmtpAccountId(incoming.smtpAccountId());
        p.setMatchMode(incoming.matchMode() != null ? incoming.matchMode() : "ANY");
        p.setEndpointIds(incoming.endpointIds() != null ? incoming.endpointIds() : "");
        p.setCategoryIds(incoming.categoryIds() != null ? incoming.categoryIds() : "");
        p.setRecipientEmails(incoming.recipientEmails() != null ? incoming.recipientEmails().trim() : "");
        p.setNotificationsEnabled(incoming.notificationsEnabled() != null ? incoming.notificationsEnabled() : true);

        return AutomationProfileDto.fromEntity(profileRepository.save(p));
    }

    @Transactional
    public AutomationProfileDto updateProfile(Long id, AutomationProfileRequest incoming) {
        AutomationProfile p = profileRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + id));

        if (incoming.name() != null && !incoming.name().isBlank()) {
            p.setName(incoming.name().trim());
        }
        if (incoming.enabled() != null) {
            p.setEnabled(incoming.enabled());
        }
        if (incoming.scheduleType() != null) {
            p.setScheduleType(incoming.scheduleType());
        }
        if (incoming.cronTime() != null && !incoming.cronTime().isBlank()) {
            p.setCronTime(incoming.cronTime().trim());
        }
        if (incoming.intervalMinutes() != null) {
            p.setIntervalMinutes(incoming.intervalMinutes());
        }
        if (incoming.cronDays() != null) {
            p.setCronDays(incoming.cronDays());
        }
        p.setSmtpAccountId(incoming.smtpAccountId());

        if (incoming.matchMode() != null) {
            p.setMatchMode(incoming.matchMode());
        }
        if (incoming.endpointIds() != null) {
            p.setEndpointIds(incoming.endpointIds());
        }
        if (incoming.categoryIds() != null) {
            p.setCategoryIds(incoming.categoryIds());
        }
        if (incoming.recipientEmails() != null) {
            p.setRecipientEmails(incoming.recipientEmails().trim());
        }
        if (incoming.notificationsEnabled() != null) {
            p.setNotificationsEnabled(incoming.notificationsEnabled());
        }

        return AutomationProfileDto.fromEntity(profileRepository.save(p));
    }

    @Transactional
    public void deleteProfile(Long id) {
        if (profileRepository.existsById(id)) {
            profileRepository.deleteById(id);
        }
    }

    public TenderExecutionService.ExecutionSummary triggerProfileNow(Long id) {
        return executionService.executeProfileNow(id, false);
    }

    @Transactional(readOnly = true)
    public List<FetchRunDto> getRuns() {
        return fetchRunRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(FetchRunDto::fromEntity)
                .toList();
    }

    @Transactional
    public void deleteRun(Long id) {
        if (fetchRunRepository.existsById(id)) {
            fetchRunRepository.deleteById(id);
        }
    }

    public TenderExecutionService.ExcelExportResult exportRunsToExcel(List<Long> runIds) throws Exception {
        if (runIds == null || runIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        return reportExportService.generateExcelForRuns(runIds);
    }

    public TenderExecutionService.EmailDispatchResult sendRunsByEmail(
            List<Long> runIds,
            String rawEmails,
            Long smtpAccountId
    ) throws Exception {
        if (runIds == null || runIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        List<String> emails = reportEmailService.parseEmails(rawEmails);
        if (emails.isEmpty()) {
            throw new IllegalArgumentException("Podaj przynajmniej jeden poprawny adres e-mail.");
        }
        return reportEmailService.sendRunsToEmails(
                runIds,
                emails,
                "Raport przetargow z wybranych pobran",
                smtpAccountId
        );
    }
}
