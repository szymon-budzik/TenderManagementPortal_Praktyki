-- 1. Lekka tabela łącząca user_tenders (stan, punktacja i widoczność przetargów per użytkownik)
CREATE TABLE user_tenders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tender_id BIGINT NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    score INTEGER NOT NULL DEFAULT 0,
    score_breakdown TEXT,
    has_unread_update BOOLEAN NOT NULL DEFAULT FALSE,
    last_read_update_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_tenders_user_tender UNIQUE (user_id, tender_id)
);

CREATE INDEX idx_user_tenders_user_status ON user_tenders(user_id, status);
CREATE INDEX idx_user_tenders_tender_id ON user_tenders(tender_id);
CREATE INDEX idx_user_tenders_user_score ON user_tenders(user_id, score);

-- 2. Właściciel profili automatyzacji
ALTER TABLE automation_profiles
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_automation_profiles_owner ON automation_profiles(owner_user_id);

-- 3. Właściciel historii pobrań / raportów
ALTER TABLE fetch_runs
    ADD COLUMN owner_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX idx_fetch_runs_owner ON fetch_runs(owner_user_id);

-- 4. Wsteczna kompatybilność: przypisanie wszystkich dotychczasowych danych do istniejącego administratora
DO $$
DECLARE
    admin_id BIGINT;
BEGIN
    SELECT id INTO admin_id
    FROM users
    WHERE role = 'ROLE_ADMIN'
    ORDER BY id ASC
    LIMIT 1;

    IF admin_id IS NULL THEN
        SELECT id INTO admin_id
        FROM users
        ORDER BY id ASC
        LIMIT 1;
    END IF;

    IF admin_id IS NOT NULL THEN
        INSERT INTO user_tenders (
            user_id,
            tender_id,
            status,
            score,
            score_breakdown,
            has_unread_update,
            created_at,
            updated_at
        )
        SELECT
            admin_id,
            t.id,
            COALESCE(t.status, 'NEW'),
            COALESCE(t.score, 0),
            CASE
                WHEN t.description LIKE 'Punktacja kategorii:%'
                THEN split_part(t.description, E'\n', 1)
                ELSE NULL
            END,
            COALESCE(t.has_unread_update, FALSE),
            COALESCE(t.created_at, CURRENT_TIMESTAMP),
            COALESCE(t.last_updated_at, t.created_at, CURRENT_TIMESTAMP)
        FROM tenders t
        ON CONFLICT (user_id, tender_id) DO NOTHING;

        UPDATE automation_profiles
        SET owner_user_id = admin_id
        WHERE owner_user_id IS NULL;

        UPDATE fetch_runs
        SET owner_user_id = COALESCE(target_user_id, admin_id)
        WHERE owner_user_id IS NULL;

        UPDATE automation_notifications
        SET recipient_user_id = admin_id
        WHERE recipient_user_id IS NULL;
    END IF;
END $$;
