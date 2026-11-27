-- =============================================================================
-- V21__fetch_run_read_flag.sql
-- Śledzenie nieprzeczytanych raportów (czerwony badge przy zakładce Raporty)
-- oraz wyczyszczenie powiadomień spoza automatyzacji i przesłań.
-- =============================================================================

ALTER TABLE fetch_runs
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_fetch_runs_owner_read
    ON fetch_runs (owner_user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_fetch_runs_target_read
    ON fetch_runs (target_user_id, is_read);

DELETE FROM automation_notifications
WHERE notification_type IS NOT NULL
  AND notification_type NOT IN ('AUTOMATION', 'SHARED_TENDER', 'SHARED_REPORT');
