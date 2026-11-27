CREATE TABLE shared_tenders (
    id BIGSERIAL PRIMARY KEY,
    tender_id BIGINT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shared_tenders_recipient ON shared_tenders(recipient_user_id, created_at DESC);
CREATE INDEX idx_shared_tenders_sender ON shared_tenders(sender_user_id);

ALTER TABLE fetch_runs
    ADD COLUMN target_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN shared_by_username VARCHAR(100),
    ADD COLUMN shared_note VARCHAR(500);

CREATE INDEX idx_fetch_runs_target_user ON fetch_runs(target_user_id);

ALTER TABLE automation_notifications
    ADD COLUMN recipient_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN notification_type VARCHAR(40) NOT NULL DEFAULT 'AUTOMATION';

CREATE INDEX idx_automation_notifications_recipient ON automation_notifications(recipient_user_id, created_at DESC);
