DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenders' AND column_name = 'source_id'
    ) THEN
        ALTER TABLE public.tenders DROP COLUMN source_id CASCADE;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenders' AND column_name = 'external_id'
    ) THEN
        ALTER TABLE public.tenders DROP COLUMN external_id CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF to_regclass('public.tender_sources') IS NOT NULL THEN
        DROP TABLE public.tender_sources;
    END IF;

    IF to_regclass('public.tender_notifications') IS NOT NULL THEN
        DROP TABLE public.tender_notifications;
    END IF;
END
$$;
