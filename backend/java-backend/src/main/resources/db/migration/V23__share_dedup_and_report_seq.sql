-- =============================================================================
-- V23__share_dedup_and_report_seq.sql
-- 1. Deduplikacja shared_tenders dla (recipient_user_id, tender_id) + UNIQUE.
-- 2. Numeracja raportów per użytkownik (user_seq_no) w fetch_runs.
-- =============================================================================

-- 1. Usuń ewentualne duplikaty w shared_tenders (zostaw najnowszy wpis dla pary odbiorca + przetarg)
DELETE FROM shared_tenders st
USING (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY recipient_user_id, tender_id
               ORDER BY created_at DESC NULLS LAST, id DESC
           ) AS rn
    FROM shared_tenders
) dup
WHERE st.id = dup.id
  AND dup.rn > 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uq_shared_tenders_recipient_tender'
    ) THEN
        ALTER TABLE shared_tenders
            ADD CONSTRAINT uq_shared_tenders_recipient_tender UNIQUE (recipient_user_id, tender_id);
    END IF;
END $$;

-- 2. Dodaj per-user numerację raportów w fetch_runs i uzupełnij istniejące rekordy
ALTER TABLE fetch_runs
    ADD COLUMN IF NOT EXISTS user_seq_no INTEGER;

UPDATE fetch_runs fr
SET user_seq_no = numbered.seq_no
FROM (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY COALESCE(owner_user_id, target_user_id, 0)
               ORDER BY id ASC
           ) AS seq_no
    FROM fetch_runs
) numbered
WHERE fr.id = numbered.id
  AND fr.user_seq_no IS NULL;

CREATE INDEX IF NOT EXISTS idx_fetch_runs_owner_seq
    ON fetch_runs (owner_user_id, user_seq_no);
