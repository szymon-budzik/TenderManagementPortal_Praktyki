CREATE INDEX idx_user_tender_statuses_user_status
    ON user_tender_statuses (user_id, status);
