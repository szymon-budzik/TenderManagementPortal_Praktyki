package com.przetargi.java_backend.service;

import com.przetargi.java_backend.entity.AutomationProfile;
import com.przetargi.java_backend.entity.CronConfig;
import com.przetargi.java_backend.repository.AutomationProfileRepository;
import com.przetargi.java_backend.repository.CronConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AutomationSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(AutomationSchedulerService.class);
    private static final DateTimeFormatter HM_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final AutomationProfileRepository profileRepository;
    private final CronConfigRepository cronConfigRepository;
    private final TenderExecutionService executionService;
    private final TenderDateService dateService;

    private final Map<Long, String> lastTriggeredMinuteByProfile = new ConcurrentHashMap<>();
    private final Map<Long, OffsetDateTime> lastIntervalTriggerByProfile = new ConcurrentHashMap<>();

    public AutomationSchedulerService(
            AutomationProfileRepository profileRepository,
            CronConfigRepository cronConfigRepository,
            TenderExecutionService executionService,
            TenderDateService dateService
    ) {
        this.profileRepository = profileRepository;
        this.cronConfigRepository = cronConfigRepository;
        this.executionService = executionService;
        this.dateService = dateService;
    }

    public CronConfig getOrCreateCronConfig() {
        return cronConfigRepository.findById(1L).orElseGet(() -> {
            CronConfig cfg = new CronConfig();
            cfg.setId(1L);
            return cronConfigRepository.save(cfg);
        });
    }

    @Scheduled(fixedRate = 20000)
    public void checkAndRunScheduledProfiles() {
        ZonedDateTime nowPl = dateService.nowPolandZoned();
        String nowHm = nowPl.format(HM_FMT);
        String minuteKey = nowPl.toLocalDate() + " " + nowHm;
        int todayDow = nowPl.getDayOfWeek().getValue();
        OffsetDateTime nowOffset = nowPl.toOffsetDateTime();

        for (AutomationProfile profile : profileRepository.findAll()) {
            if (!Boolean.TRUE.equals(profile.getEnabled())) continue;
            String scheduleType = profile.getScheduleType() != null
                    ? profile.getScheduleType().trim().toUpperCase() : "SCHEDULE";
            try {
                if ("INTERVAL".equals(scheduleType)) {
                    int intervalMin = (profile.getIntervalMinutes() != null && profile.getIntervalMinutes() > 0)
                            ? profile.getIntervalMinutes() : 60;
                    OffsetDateTime memLastRun = lastIntervalTriggerByProfile.get(profile.getId());
                    OffsetDateTime dbLastRun = profile.getLastRunAt();
                    OffsetDateTime lastRun = (memLastRun != null && (dbLastRun == null || memLastRun.isAfter(dbLastRun)))
                            ? memLastRun
                            : dbLastRun;
                    if (lastRun == null || Duration.between(lastRun, nowOffset).toMinutes() >= intervalMin) {
                        lastIntervalTriggerByProfile.put(profile.getId(), nowOffset);
                        executionService.executeProfileNow(profile.getId(), true);
                    }
                } else {
                    String lastMinute = lastTriggeredMinuteByProfile.getOrDefault(profile.getId(), "");
                    if (!minuteKey.equals(lastMinute) && matchesScheduleExpression(profile.getCronTime(), nowHm, todayDow)) {
                        lastTriggeredMinuteByProfile.put(profile.getId(), minuteKey);
                        executionService.executeProfileNow(profile.getId(), true);
                    }
                }
            } catch (Exception e) {
                log.warn("Scheduled execution failed for profile {} ({}): {}",
                        profile.getId(), profile.getName(), e.getMessage());
            }
        }
    }

    public boolean matchesScheduleExpression(String rawExpr, String nowHm, int todayDow) {
        if (rawExpr == null || rawExpr.isBlank()) return false;
        for (String token : rawExpr.split(",")) {
            String trimmed = token.trim();
            if (trimmed.isEmpty()) continue;
            String[] parts = trimmed.split("/");
            if (!nowHm.equals(normalizeHm(parts[0].trim()))) continue;
            if (parts.length == 1 || parts[1].isBlank()) return true;
            for (String d : parts[1].trim().split(";")) {
                try {
                    if (Integer.parseInt(d.trim()) == todayDow) return true;
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return false;
    }

    private String normalizeHm(String rawTime) {
        if (rawTime == null) return "";
        String[] hm = rawTime.split(":");
        if (hm.length != 2) return rawTime;
        try {
            return String.format("%02d:%02d", Integer.parseInt(hm[0].trim()), Integer.parseInt(hm[1].trim()));
        } catch (NumberFormatException e) {
            return rawTime;
        }
    }
}
