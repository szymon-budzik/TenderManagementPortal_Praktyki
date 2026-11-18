CREATE TABLE IF NOT EXISTS smtp_accounts (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    smtp_host VARCHAR(150) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_username VARCHAR(150) NOT NULL,
    smtp_password VARCHAR(255) NOT NULL
);

ALTER TABLE automation_profiles ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(30) NOT NULL DEFAULT 'DAILY';
ALTER TABLE automation_profiles ADD COLUMN IF NOT EXISTS interval_minutes INTEGER DEFAULT 60;
ALTER TABLE automation_profiles ADD COLUMN IF NOT EXISTS cron_days VARCHAR(50) DEFAULT '1,2,3,4,5';
ALTER TABLE automation_profiles ADD COLUMN IF NOT EXISTS smtp_account_id BIGINT;