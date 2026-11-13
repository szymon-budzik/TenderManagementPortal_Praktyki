ALTER TABLE fetch_runs ALTER COLUMN source_type TYPE VARCHAR(150);

CREATE TABLE IF NOT EXISTS automation_profiles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    cron_time VARCHAR(20) NOT NULL DEFAULT '08:00',
    match_mode VARCHAR(10) NOT NULL DEFAULT 'ANY',
    endpoint_ids TEXT,
    category_ids TEXT,
    recipient_emails TEXT,
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status TEXT
);