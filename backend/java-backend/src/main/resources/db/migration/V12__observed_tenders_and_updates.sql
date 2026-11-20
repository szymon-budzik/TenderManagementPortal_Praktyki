ALTER TABLE tenders
    ADD COLUMN IF NOT EXISTS submission_deadline TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS group_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS has_unread_update BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_tenders_group_key ON tenders(group_key);

CREATE TABLE IF NOT EXISTS tender_updates (
    id BIGSERIAL PRIMARY KEY,
    tender_id BIGINT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    external_id VARCHAR(150),
    title TEXT NOT NULL,
    description TEXT,
    submission_deadline TIMESTAMP WITH TIME ZONE,
    change_summary TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tender_updates_tender_id ON tender_updates(tender_id);