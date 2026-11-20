CREATE TABLE IF NOT EXISTS fetch_run_tender_updates (
    fetch_run_id BIGINT NOT NULL REFERENCES fetch_runs(id) ON DELETE CASCADE,
    tender_update_id BIGINT NOT NULL REFERENCES tender_updates(id) ON DELETE CASCADE,
    PRIMARY KEY (fetch_run_id, tender_update_id)
);