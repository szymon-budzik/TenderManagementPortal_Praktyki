ALTER TABLE automation_profiles
    ADD COLUMN category_query TEXT,
    ADD COLUMN use_category_query BOOLEAN NOT NULL DEFAULT FALSE;
