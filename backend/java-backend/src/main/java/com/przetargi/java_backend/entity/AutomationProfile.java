package com.przetargi.java_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "automation_profiles")
public class AutomationProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false)
    private Boolean enabled = false;

    @Column(name = "schedule_type", nullable = false, length = 30)
    private String scheduleType = "DAILY"; // DAILY | MULTI_TIME | INTERVAL | WEEKLY

    @Column(name = "cron_time", nullable = false, length = 500)
    private String cronTime = "08:00";

    @Column(name = "interval_minutes")
    private Integer intervalMinutes = 60;

    @Column(name = "cron_days", length = 50)
    private String cronDays = "1,2,3,4,5";

    @Column(name = "smtp_account_id")
    private Long smtpAccountId;

    @Column(name = "match_mode", nullable = false, length = 10)
    private String matchMode = "ANY";

    @Column(name = "endpoint_ids", columnDefinition = "TEXT")
    private String endpointIds = "";

    @Column(name = "category_ids", columnDefinition = "TEXT")
    private String categoryIds = "";

    @Column(name = "recipient_emails", columnDefinition = "TEXT")
    private String recipientEmails = "";

    @Column(name = "last_run_at")
    private OffsetDateTime lastRunAt;

    @Column(name = "last_run_status", columnDefinition = "TEXT")
    private String lastRunStatus;

    @Column(name = "notifications_enabled", nullable = false)
    private Boolean notificationsEnabled = true;

    public AutomationProfile() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public String getScheduleType() { return scheduleType; }
    public void setScheduleType(String scheduleType) { this.scheduleType = scheduleType; }

    public String getCronTime() { return cronTime; }
    public void setCronTime(String cronTime) { this.cronTime = cronTime; }

    public Integer getIntervalMinutes() { return intervalMinutes; }
    public void setIntervalMinutes(Integer intervalMinutes) { this.intervalMinutes = intervalMinutes; }

    public String getCronDays() { return cronDays; }
    public void setCronDays(String cronDays) { this.cronDays = cronDays; }

    public Long getSmtpAccountId() { return smtpAccountId; }
    public void setSmtpAccountId(Long smtpAccountId) { this.smtpAccountId = smtpAccountId; }

    public String getMatchMode() { return matchMode; }
    public void setMatchMode(String matchMode) { this.matchMode = matchMode; }

    public String getEndpointIds() { return endpointIds; }
    public void setEndpointIds(String endpointIds) { this.endpointIds = endpointIds; }

    public String getCategoryIds() { return categoryIds; }
    public void setCategoryIds(String categoryIds) { this.categoryIds = categoryIds; }

    public String getRecipientEmails() { return recipientEmails; }
    public void setRecipientEmails(String recipientEmails) { this.recipientEmails = recipientEmails; }

    public OffsetDateTime getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(OffsetDateTime lastRunAt) { this.lastRunAt = lastRunAt; }

    public String getLastRunStatus() { return lastRunStatus; }
    public void setLastRunStatus(String lastRunStatus) { this.lastRunStatus = lastRunStatus; }

    public Boolean getNotificationsEnabled() { return notificationsEnabled; }
    public void setNotificationsEnabled(Boolean notificationsEnabled) { this.notificationsEnabled = notificationsEnabled; }
}