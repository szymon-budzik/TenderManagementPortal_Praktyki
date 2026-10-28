DO $$
DECLARE
    table_mapping RECORD;
    column_mapping RECORD;
BEGIN
    FOR table_mapping IN
        SELECT * FROM (VALUES
            ('uzytkownicy', 'users'),
            ('slowa_kluczowe', 'keywords'),
            ('przetargi', 'tenders'),
            ('przetargi_dopasowane_slowa', 'tender_matched_keywords'),
            ('oferty', 'bids'),
            ('historia_statusow_przetargow', 'tender_status_history'),
            ('statusy_przetargow_uzytkownikow', 'user_tender_statuses'),
            ('powiadomienia_przetargow', 'tender_notifications'),
            ('zrodla_przetargow', 'tender_sources')
        ) AS mappings(old_name, new_name)
    LOOP
        IF to_regclass('public.' || table_mapping.old_name) IS NOT NULL
            AND to_regclass('public.' || table_mapping.new_name) IS NULL THEN
            EXECUTE format('ALTER TABLE public.%I RENAME TO %I',
                table_mapping.old_name, table_mapping.new_name);
        END IF;
    END LOOP;

    FOR column_mapping IN
        SELECT * FROM (VALUES
            ('users', 'imie', 'first_name'),
            ('users', 'nazwisko', 'last_name'),
            ('users', 'rola', 'role'),
            ('users', 'telefon', 'phone'),
            ('users', 'haslo', 'password_hash'),
            ('users', 'data_utworzenia', 'created_at'),
            ('keywords', 'fraza', 'phrase'),
            ('keywords', 'typ', 'keyword_type'),
            ('keywords', 'kategoria', 'category'),
            ('keywords', 'punkty', 'score'),
            ('keywords', 'aktywne', 'active'),
            ('keywords', 'data_utworzenia', 'created_at'),
            ('tenders', 'tytul', 'title'),
            ('tenders', 'opis', 'description'),
            ('tenders', 'kategoria', 'category'),
            ('tenders', 'lokalizacja', 'location'),
            ('tenders', 'termin_skladania_ofert', 'submission_deadline'),
            ('tenders', 'status_operacyjny', 'operational_status'),
            ('tenders', 'punktacja', 'score'),
            ('tenders', 'status_ustawiony_recznie', 'status_manually_set'),
            ('tenders', 'zrodlo_id', 'source_id'),
            ('tenders', 'zewnetrzne_id', 'external_id'),
            ('tenders', 'adres_zrodla', 'source_url'),
            ('tenders', 'organizator_id', 'organizer_id'),
            ('tenders', 'data_utworzenia', 'created_at'),
            ('tender_matched_keywords', 'przetarg_id', 'tender_id'),
            ('tender_matched_keywords', 'slowo_kluczowe_id', 'keyword_id'),
            ('bids', 'przetarg_id', 'tender_id'),
            ('bids', 'wykonawca_id', 'contractor_id'),
            ('bids', 'cena', 'price'),
            ('bids', 'opis', 'description'),
            ('bids', 'data_zlozenia', 'submitted_at'),
            ('tender_status_history', 'przetarg_id', 'tender_id'),
            ('tender_status_history', 'poprzedni_status', 'previous_status'),
            ('tender_status_history', 'nowy_status', 'new_status'),
            ('tender_status_history', 'zmienil_uzytkownik', 'changed_by'),
            ('tender_status_history', 'uzytkownik_id', 'user_id'),
            ('tender_status_history', 'data_zmiany', 'changed_at'),
            ('user_tender_statuses', 'przetarg_id', 'tender_id'),
            ('user_tender_statuses', 'uzytkownik_id', 'user_id'),
            ('user_tender_statuses', 'data_zmiany', 'changed_at'),
            ('tender_notifications', 'przetarg_id', 'tender_id'),
            ('tender_notifications', 'wiadomosc', 'message'),
            ('tender_notifications', 'liczba_prob', 'attempt_count'),
            ('tender_notifications', 'nastepna_proba', 'next_attempt_at'),
            ('tender_notifications', 'wyslano_at', 'sent_at'),
            ('tender_notifications', 'ostatni_blad', 'last_error'),
            ('tender_notifications', 'utworzono_at', 'created_at'),
            ('tender_sources', 'nazwa', 'name'),
            ('tender_sources', 'adres_endpointu', 'endpoint_url'),
            ('tender_sources', 'metoda', 'http_method'),
            ('tender_sources', 'parametry_json', 'parameters_json'),
            ('tender_sources', 'aktywne', 'active'),
            ('tender_sources', 'data_utworzenia', 'created_at')
        ) AS mappings(table_name, old_name, new_name)
    LOOP
        IF to_regclass('public.' || column_mapping.table_name) IS NOT NULL
            AND EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                    AND table_name = column_mapping.table_name
                    AND column_name = column_mapping.old_name
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                    AND table_name = column_mapping.table_name
                    AND column_name = column_mapping.new_name
            ) THEN
            EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I',
                column_mapping.table_name, column_mapping.old_name, column_mapping.new_name);
        END IF;
    END LOOP;
END $$;
