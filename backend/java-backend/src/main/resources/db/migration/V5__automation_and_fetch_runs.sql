CREATE TABLE IF NOT EXISTS fetch_runs (
    id BIGSERIAL PRIMARY KEY,
    source_type VARCHAR(30) NOT NULL,
    sources_summary TEXT,
    total_fetched INTEGER NOT NULL DEFAULT 0,
    saved_count INTEGER NOT NULL DEFAULT 0,
    excluded_count INTEGER NOT NULL DEFAULT 0,
    zero_score_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fetch_run_tenders (
    fetch_run_id BIGINT NOT NULL REFERENCES fetch_runs(id) ON DELETE CASCADE,
    tender_id BIGINT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    PRIMARY KEY (fetch_run_id, tender_id)
);

CREATE TABLE IF NOT EXISTS cron_config (
    id BIGINT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    cron_time VARCHAR(20) NOT NULL DEFAULT '08:00',
    match_mode VARCHAR(10) NOT NULL DEFAULT 'ANY',
    endpoint_ids TEXT,
    category_ids TEXT,
    recipient_emails TEXT,
    smtp_host VARCHAR(150),
    smtp_port INTEGER DEFAULT 587,
    smtp_username VARCHAR(150),
    smtp_password VARCHAR(255),
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_run_status TEXT
);

INSERT INTO cron_config (id, enabled, cron_time, match_mode, endpoint_ids, category_ids, recipient_emails, smtp_port)
VALUES (1, FALSE, '08:00', 'ANY', '', '', '', 587)
ON CONFLICT (id) DO NOTHING;