package com.przetargi.java_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cron_config")
public class CronConfig {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private Boolean enabled = false;

    @Column(name = "cron_time", nullable = false, length = 20)
    private String cronTime = "08:00";

    @Column(name = "match_mode", nullable = false, length = 10)
    private String matchMode = "ANY";

    @Column(name = "endpoint_ids", columnDefinition = "TEXT")
    private String endpointIds = "";

    @Column(name = "category_ids", columnDefinition = "TEXT")
    private String categoryIds = "";

    @Column(name = "recipient_emails", columnDefinition = "TEXT")
    private String recipientEmails = "";

    @Column(name = "smtp_host", length = 150)
    private String smtpHost = "";

    @Column(name = "smtp_port")
    private Integer smtpPort = 587;

    @Column(name = "smtp_username", length = 150)
    private String smtpUsername = "";

    @Column(name = "smtp_password", length = 255)
    private String smtpPassword = "";

    @Column(name = "last_run_at")
    private OffsetDateTime lastRunAt;

    @Column(name = "last_run_status", columnDefinition = "TEXT")
    private String lastRunStatus;

    public CronConfig() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }

    public String getCronTime() { return cronTime; }
    public void setCronTime(String cronTime) { this.cronTime = cronTime; }

    public String getMatchMode() { return matchMode; }
    public void setMatchMode(String matchMode) { this.matchMode = matchMode; }

    public String getEndpointIds() { return endpointIds; }
    public void setEndpointIds(String endpointIds) { this.endpointIds = endpointIds; }

    public String getCategoryIds() { return categoryIds; }
    public void setCategoryIds(String categoryIds) { this.categoryIds = categoryIds; }

    public String getRecipientEmails() { return recipientEmails; }
    public void setRecipientEmails(String recipientEmails) { this.recipientEmails = recipientEmails; }

    public String getSmtpHost() { return smtpHost; }
    public void setSmtpHost(String smtpHost) { this.smtpHost = smtpHost; }

    public Integer getSmtpPort() { return smtpPort; }
    public void setSmtpPort(Integer smtpPort) { this.smtpPort = smtpPort; }

    public String getSmtpUsername() { return smtpUsername; }
    public void setSmtpUsername(String smtpUsername) { this.smtpUsername = smtpUsername; }

    public String getSmtpPassword() { return smtpPassword; }
    public void setSmtpPassword(String smtpPassword) { this.smtpPassword = smtpPassword; }

    public OffsetDateTime getLastRunAt() { return lastRunAt; }
    public void setLastRunAt(OffsetDateTime lastRunAt) { this.lastRunAt = lastRunAt; }

    public String getLastRunStatus() { return lastRunStatus; }
    public void setLastRunStatus(String lastRunStatus) { this.lastRunStatus = lastRunStatus; }
}