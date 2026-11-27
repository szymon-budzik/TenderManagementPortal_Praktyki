package com.przetargi.java_backend.service;

import com.przetargi.java_backend.dto.AutomationProfileDto;
import com.przetargi.java_backend.dto.AutomationProfileRequest;
import com.przetargi.java_backend.dto.FetchRunDto;
import com.przetargi.java_backend.dto.ReportsBadgeDto;
import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.FetchRun;
import com.przetargi.java_backend.entity.User;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.FetchRunRepository;
import com.przetargi.java_backend.repository.KeywordCategoryRepository;
import com.przetargi.java_backend.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final UserRepository userRepository;
    private final KeywordCategoryRepository keywordCategoryRepository;
    private final CategoryQueryService categoryQueryService;

    public AutomationService(
            AutomationProfileRepository profileRepository,
            FetchRunRepository fetchRunRepository,
            TenderExecutionService executionService,
            ReportExportService reportExportService,
            ReportEmailService reportEmailService,
            UserRepository userRepository,
            KeywordCategoryRepository keywordCategoryRepository,
            CategoryQueryService categoryQueryService
    ) {
        this.profileRepository = profileRepository;
        this.fetchRunRepository = fetchRunRepository;
        this.executionService = executionService;
        this.reportExportService = reportExportService;
        this.reportEmailService = reportEmailService;
        this.userRepository = userRepository;
        this.keywordCategoryRepository = keywordCategoryRepository;
        this.categoryQueryService = categoryQueryService;
    }

    @Transactional(readOnly = true)
    public List<AutomationProfileDto> getProfiles(String username) {
        Long userId = requireUserId(username);
        return profileRepository.findByOwnerUserIdOrderByIdAsc(userId).stream()
                .map(AutomationProfileDto::fromEntity)
                .toList();
    }

    @Transactional
    public AutomationProfileDto createProfile(AutomationProfileRequest incoming, String username) {
        Long userId = requireUserId(username);
        if (incoming.name() == null || incoming.name().isBlank()) {
            throw new IllegalArgumentException("Nazwa profilu jest wymagana.");
        }
        AutomationProfile p = new AutomationProfile();
        p.setOwnerUserId(userId);
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
        boolean useQuery = Boolean.TRUE.equals(incoming.useCategoryQuery());
        String queryText = incoming.categoryQuery() != null ? incoming.categoryQuery().trim() : "";
        if (useQuery) {
            categoryQueryService.parse(queryText, keywordCategoryRepository.findAll());
        }
        p.setUseCategoryQuery(useQuery);
        p.setCategoryQuery(queryText.isBlank() ? null : queryText);

        return AutomationProfileDto.fromEntity(profileRepository.save(p));
    }

    @Transactional
    public AutomationProfileDto updateProfile(Long id, AutomationProfileRequest incoming, String username) {
        Long userId = requireUserId(username);
        AutomationProfile p = requireOwnedProfile(id, userId);

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
        if (incoming.useCategoryQuery() != null || incoming.categoryQuery() != null) {
            boolean useQuery = incoming.useCategoryQuery() != null
                    ? incoming.useCategoryQuery()
                    : Boolean.TRUE.equals(p.getUseCategoryQuery());
            String queryText = incoming.categoryQuery() != null
                    ? incoming.categoryQuery().trim()
                    : (p.getCategoryQuery() != null ? p.getCategoryQuery() : "");
            if (useQuery) {
                categoryQueryService.parse(queryText, keywordCategoryRepository.findAll());
            }
            p.setUseCategoryQuery(useQuery);
            p.setCategoryQuery(queryText.isBlank() ? null : queryText);
        }

        return AutomationProfileDto.fromEntity(profileRepository.save(p));
    }

    @Transactional
    public void deleteProfile(Long id, String username) {
        Long userId = requireUserId(username);
        AutomationProfile p = requireOwnedProfile(id, userId);
        profileRepository.deleteById(p.getId());
    }

    public TenderExecutionService.ExecutionSummary triggerProfileNow(Long id, String username) {
        Long userId = requireUserId(username);
        requireOwnedProfile(id, userId);
        return executionService.executeProfileNow(id, false);
    }

    @Transactional(readOnly = true)
    public List<FetchRunDto> getRuns(String username) {
        Long userId = requireUserId(username);
        return fetchRunRepository.findByOwnerUserIdOrTargetUserIdOrderByCreatedAtDesc(userId, userId).stream()
                .map(FetchRunDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public ReportsBadgeDto getReportsBadge(String username) {
        Long userId = requireUserId(username);
        long total = fetchRunRepository.countAccessibleByUser(userId);
        long unread = fetchRunRepository.countUnreadAccessibleByUser(userId);
        return new ReportsBadgeDto(total, unread);
    }

    @Transactional
    public void markAllRunsRead(String username) {
        Long userId = requireUserId(username);
        List<FetchRun> unread = fetchRunRepository.findUnreadAccessibleByUser(userId);
        if (!unread.isEmpty()) {
            unread.forEach(r -> r.setIsRead(true));
            fetchRunRepository.saveAll(unread);
        }
    }

    @Transactional
    public void deleteRun(Long id, String username) {
        Long userId = requireUserId(username);
        FetchRun run = requireAccessibleRun(id, userId);
        fetchRunRepository.deleteById(run.getId());
    }

    public TenderExecutionService.ExcelExportResult exportRunsToExcel(List<Long> runIds, String username) throws Exception {
        if (runIds == null || runIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        Long userId = requireUserId(username);
        for (Long runId : runIds) {
            requireAccessibleRun(runId, userId);
        }
        return reportExportService.generateExcelForRuns(runIds);
    }

    public TenderExecutionService.EmailDispatchResult sendRunsByEmail(
            List<Long> runIds,
            String rawEmails,
            Long smtpAccountId,
            String username
    ) throws Exception {
        if (runIds == null || runIds.isEmpty()) {
            throw new IllegalArgumentException("Zaznacz przynajmniej jedno pobranie z listy.");
        }
        Long userId = requireUserId(username);
        for (Long runId : runIds) {
            requireAccessibleRun(runId, userId);
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

    private AutomationProfile requireOwnedProfile(Long id, Long userId) {
        AutomationProfile p = profileRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono profilu o ID: " + id));
        if (!userId.equals(p.getOwnerUserId())) {
            throw new AccessDeniedException("Brak dostępu do profilu automatyzacji innego użytkownika.");
        }
        return p;
    }

    private FetchRun requireAccessibleRun(Long id, Long userId) {
        FetchRun run = fetchRunRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Nie znaleziono raportu o ID: " + id));
        boolean allowed = userId.equals(run.getOwnerUserId()) || userId.equals(run.getTargetUserId());
        if (!allowed) {
            throw new AccessDeniedException("Brak dostępu do raportu innego użytkownika.");
        }
        return run;
    }

    private Long requireUserId(String username) {
        String effectiveUsername = username;
        if (effectiveUsername == null || effectiveUsername.isBlank()) {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                effectiveUsername = auth.getName();
            }
        }
        if (effectiveUsername == null || effectiveUsername.isBlank()) {
            throw new AccessDeniedException("Brak uwierzytelnionego użytkownika.");
        }
        String lookup = effectiveUsername;
        return userRepository.findByUsername(lookup)
                .map(User::getId)
                .orElseThrow(() -> new AccessDeniedException("Nie znaleziono użytkownika: " + lookup));
    }
}
