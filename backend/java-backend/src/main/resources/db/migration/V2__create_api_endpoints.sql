CREATE TABLE api_endpoints (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    url TEXT NOT NULL,
    http_method VARCHAR(10) NOT NULL DEFAULT 'GET',
    payload TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Przykładowy domyślny wpis (można edytować/usunąć przez CRUD)
INSERT INTO api_endpoints (name, url, http_method, payload, is_active)
VALUES (
    'e-Zamówienia BZP (Oficjalne API)',
    'https://ezamowienia.gov.pl/mo-board/api/v1/board/search',
    'POST',
    '{"PageSize": 25, "PageNumber": 1, "SortingColumnName": "PublicationDate", "SortingDirection": "DESC", "NoticeType": ["ContractNotice"]}',
    TRUE
);