CREATE TABLE IF NOT EXISTS automation_notifications (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT,
    profile_name VARCHAR(150) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    details TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_notifications_created_at
    ON automation_notifications(created_at DESC);