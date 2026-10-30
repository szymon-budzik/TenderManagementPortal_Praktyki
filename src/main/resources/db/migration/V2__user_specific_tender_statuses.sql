ALTER TABLE tender_status_history
    ADD COLUMN user_id UUID;

ALTER TABLE tender_status_history
    ADD CONSTRAINT fk_tender_status_history_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

CREATE TABLE user_tender_statuses (
    id UUID PRIMARY KEY,
    tender_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(24) NOT NULL,
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uk_user_tender_statuses_tender_user UNIQUE (tender_id, user_id),
    CONSTRAINT fk_user_tender_statuses_tender
        FOREIGN KEY (tender_id) REFERENCES tenders (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_tender_statuses_user
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_user_tender_statuses_user_id
    ON user_tender_statuses (user_id);

WITH latest_user_statuses AS (
    SELECT DISTINCT ON (history.tender_id, history.changed_by)
        history.id,
        history.tender_id,
        users.id AS user_id,
        history.new_status,
        history.changed_at
    FROM tender_status_history history
    JOIN users ON users.id::text = history.changed_by
    ORDER BY history.tender_id, history.changed_by, history.changed_at DESC
)
INSERT INTO user_tender_statuses (id, tender_id, user_id, status, changed_at)
SELECT id, tender_id, user_id, new_status, changed_at
FROM latest_user_statuses;

UPDATE tender_status_history history
SET user_id = users.id
FROM users
WHERE users.id::text = history.changed_by;

UPDATE tenders
SET status_manually_set = false;
