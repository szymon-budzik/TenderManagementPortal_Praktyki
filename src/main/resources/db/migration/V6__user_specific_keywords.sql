ALTER TABLE keywords ADD COLUMN owner_id UUID;

ALTER TABLE keywords
    ADD CONSTRAINT fk_keywords_owner
    FOREIGN KEY (owner_id) REFERENCES users (id);

-- Zachowaj istniejące reguły przy migracji, przypisując je pierwszemu istniejącemu kontu.
UPDATE keywords
SET owner_id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1)
WHERE owner_id IS NULL;

ALTER TABLE keywords
    ALTER COLUMN owner_id SET NOT NULL;

DO $$
DECLARE
    old_constraint RECORD;
BEGIN
    FOR old_constraint IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.keywords'::regclass
          AND c.contype = 'u'
          AND pg_get_constraintdef(c.oid) LIKE '%phrase%'
          AND pg_get_constraintdef(c.oid) LIKE '%keyword_type%'
    LOOP
        EXECUTE format('ALTER TABLE public.keywords DROP CONSTRAINT %I', old_constraint.conname);
    END LOOP;
END $$;

DO $$
DECLARE
    old_index RECORD;
BEGIN
    FOR old_index IN
        SELECT indexrelid::regclass AS index_name
        FROM pg_index
        WHERE indrelid = 'public.keywords'::regclass
          AND indisunique
          AND pg_get_indexdef(indexrelid) LIKE '%phrase%'
          AND pg_get_indexdef(indexrelid) LIKE '%keyword_type%'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %s', old_index.index_name);
    END LOOP;
END $$;

CREATE UNIQUE INDEX uk_keywords_owner_phrase_type
    ON keywords (owner_id, phrase, keyword_type);

CREATE INDEX idx_keywords_owner_active
    ON keywords (owner_id, active);
