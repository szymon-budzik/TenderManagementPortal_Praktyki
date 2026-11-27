-- =============================================================================
-- V22__user_notification_preferences.sql
-- Preferencje użytkownika dotyczące powiadomień dla przesłanych przetargów i raportów.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_shared_tenders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_shared_reports BOOLEAN NOT NULL DEFAULT TRUE;
