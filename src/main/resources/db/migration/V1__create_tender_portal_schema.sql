CREATE TABLE users (
    id UUID PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE TABLE keywords (
    id UUID PRIMARY KEY,
    phrase VARCHAR(200) NOT NULL,
    keyword_type VARCHAR(24) NOT NULL,
    category VARCHAR(100),
    score INTEGER NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uk_keywords_phrase_type UNIQUE (phrase, keyword_type)
);

CREATE TABLE tenders (
    id UUID PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    location VARCHAR(160) NOT NULL,
    submission_deadline TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    operational_status VARCHAR(24),
    score INTEGER NOT NULL,
    status_manually_set BOOLEAN NOT NULL,
    source_url VARCHAR(2048),
    organizer_id UUID,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT fk_tenders_organizer
        FOREIGN KEY (organizer_id) REFERENCES users (id)
);

CREATE TABLE tender_matched_keywords (
    tender_id UUID NOT NULL,
    keyword_id UUID NOT NULL,
    PRIMARY KEY (tender_id, keyword_id),
    CONSTRAINT fk_tender_matched_keywords_tender
        FOREIGN KEY (tender_id) REFERENCES tenders (id),
    CONSTRAINT fk_tender_matched_keywords_keyword
        FOREIGN KEY (keyword_id) REFERENCES keywords (id)
);

CREATE TABLE bids (
    id UUID PRIMARY KEY,
    tender_id UUID NOT NULL,
    contractor_id UUID NOT NULL,
    price NUMERIC(14, 2) NOT NULL,
    description TEXT NOT NULL,
    submitted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT uk_bids_tender_contractor UNIQUE (tender_id, contractor_id),
    CONSTRAINT fk_bids_tender FOREIGN KEY (tender_id) REFERENCES tenders (id),
    CONSTRAINT fk_bids_contractor FOREIGN KEY (contractor_id) REFERENCES users (id)
);

CREATE TABLE tender_status_history (
    id UUID PRIMARY KEY,
    tender_id UUID NOT NULL,
    previous_status VARCHAR(24),
    new_status VARCHAR(24) NOT NULL,
    changed_by VARCHAR(160),
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT fk_tender_status_history_tender
        FOREIGN KEY (tender_id) REFERENCES tenders (id)
);

CREATE INDEX idx_tenders_operational_status ON tenders (operational_status);
CREATE INDEX idx_tenders_submission_deadline ON tenders (submission_deadline);
CREATE INDEX idx_tender_status_history_tender_changed_at
    ON tender_status_history (tender_id, changed_at);
