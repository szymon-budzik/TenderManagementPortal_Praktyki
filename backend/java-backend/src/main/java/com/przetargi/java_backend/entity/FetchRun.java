package com.przetargi.java_backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "fetch_runs")
public class FetchRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_type", nullable = false, length = 150)
    private String sourceType;

    @Column(name = "sources_summary", columnDefinition = "TEXT")
    private String sourcesSummary;

    @Column(name = "total_fetched", nullable = false)
    private Integer totalFetched = 0;

    @Column(name = "saved_count", nullable = false)
    private Integer savedCount = 0;

    @Column(name = "excluded_count", nullable = false)
    private Integer excludedCount = 0;

    @Column(name = "zero_score_count", nullable = false)
    private Integer zeroScoreCount = 0;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "target_user_id")
    private Long targetUserId;

    @Column(name = "shared_by_username", length = 100)
    private String sharedByUsername;

    @Column(name = "shared_note", length = 500)
    private String sharedNote;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "fetch_run_tenders",
            joinColumns = @JoinColumn(name = "fetch_run_id"),
            inverseJoinColumns = @JoinColumn(name = "tender_id")
    )
    private List<Tender> tenders = new ArrayList<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "fetch_run_tender_updates",
            joinColumns = @JoinColumn(name = "fetch_run_id"),
            inverseJoinColumns = @JoinColumn(name = "tender_update_id")
    )
    private Set<TenderUpdate> tenderUpdates = new LinkedHashSet<>();

    public FetchRun() {
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public String getSourcesSummary() { return sourcesSummary; }
    public void setSourcesSummary(String sourcesSummary) { this.sourcesSummary = sourcesSummary; }

    public Integer getTotalFetched() { return totalFetched; }
    public void setTotalFetched(Integer totalFetched) { this.totalFetched = totalFetched; }

    public Integer getSavedCount() { return savedCount; }
    public void setSavedCount(Integer savedCount) { this.savedCount = savedCount; }

    public Integer getExcludedCount() { return excludedCount; }
    public void setExcludedCount(Integer excludedCount) { this.excludedCount = excludedCount; }

    public Integer getZeroScoreCount() { return zeroScoreCount; }
    public void setZeroScoreCount(Integer zeroScoreCount) { this.zeroScoreCount = zeroScoreCount; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public List<Tender> getTenders() { return tenders; }
    public void setTenders(List<Tender> tenders) { this.tenders = tenders; }

    public Set<TenderUpdate> getTenderUpdates() { return tenderUpdates; }
    public void setTenderUpdates(Set<TenderUpdate> tenderUpdates) { this.tenderUpdates = tenderUpdates; }

    public Long getTargetUserId() { return targetUserId; }
    public void setTargetUserId(Long targetUserId) { this.targetUserId = targetUserId; }

    public String getSharedByUsername() { return sharedByUsername; }
    public void setSharedByUsername(String sharedByUsername) { this.sharedByUsername = sharedByUsername; }

    public String getSharedNote() { return sharedNote; }
    public void setSharedNote(String sharedNote) { this.sharedNote = sharedNote; }
}