import os
import json
import uuid
import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

WARSAW_TZ = ZoneInfo("Europe/Warsaw")
ENDPOINTS_FILE = os.path.join(os.path.dirname(__file__), "endpoints.json")


def get_connection():
    """Nawiązuje połączenie z bazą PostgreSQL na podstawie zmiennych środowiskowych z compose.yaml."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "db"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "przetarg_app_db"),
        user=os.getenv("DB_USER", "przetarg"),
        password=os.getenv("DB_PASSWORD", "")
    )


# =========================================================
# ZARZĄDZANIE ENDPOINTAMI (Lokalny plik JSON)
# =========================================================

def load_endpoints() -> List[Dict[str, Any]]:
    """Wczytuje listę skonfigurowanych endpointów z pliku JSON."""
    if not os.path.exists(ENDPOINTS_FILE):
        default_endpoints = [
            {
                "id": 1,
                "name": "e-Zamówienia (Wszystkie)",
                "url": "https://ezamowienia.gov.pl/mo-board/api/v1/notice",
                "method": "GET"
            }
        ]
        save_endpoints(default_endpoints)
        return default_endpoints
    try:
        with open(ENDPOINTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_endpoints(endpoints: List[Dict[str, Any]]) -> None:
    """Zapisuje listę endpointów do pliku JSON."""
    with open(ENDPOINTS_FILE, "w", encoding="utf-8") as f:
        json.dump(endpoints, f, ensure_ascii=False, indent=2)


def add_endpoint(name: str, url: str, method: str = "GET") -> None:
    """Dodaje nowe źródło do pliku konfiguracyjnego."""
    endpoints = load_endpoints()
    new_id = max([e.get("id", 0) for e in endpoints], default=0) + 1
    endpoints.append({"id": new_id, "name": name, "url": url, "method": method})
    save_endpoints(endpoints)


def update_endpoint(endpoint_id: int, name: str, url: str) -> None:
    """Aktualizuje dane wskazanego źródła."""
    endpoints = load_endpoints()
    for ep in endpoints:
        if ep["id"] == endpoint_id:
            ep["name"] = name
            ep["url"] = url
            break
    save_endpoints(endpoints)


def delete_endpoint(endpoint_id: int) -> None:
    """Usuwa źródło z pliku konfiguracyjnego."""
    endpoints = [e for e in load_endpoints() if e["id"] != endpoint_id]
    save_endpoints(endpoints)


# =========================================================
# SŁOWA KLUCZOWE (Tabela `keywords` w PostgreSQL)
# =========================================================

def load_keywords() -> List[Dict[str, Any]]:
    """Pobiera aktywne słowa kluczowe ze wspólnej tabeli keywords."""
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, phrase AS word, category, score, keyword_type AS type, active
            FROM keywords
            WHERE active = TRUE
            ORDER BY created_at DESC
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[STORAGE] Błąd pobierania słów kluczowych: {e}")
        return []


def add_keyword(word: str, category: str, score: int, keyword_type: str) -> bool:
    """Dodaje nową regułę do tabeli keywords."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        now_pl = datetime.datetime.now(WARSAW_TZ).replace(tzinfo=None)
        cur.execute("""
            INSERT INTO keywords (id, phrase, keyword_type, category, score, active, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (phrase, keyword_type) DO NOTHING
        """, (str(uuid.uuid4()), word.strip(), keyword_type, category.strip(), score, True, now_pl))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[STORAGE] Błąd dodawania słowa kluczowego: {e}")
        return False


def update_keyword(keyword_id: str, word: str, category: str, score: int, keyword_type: str) -> bool:
    """Aktualizuje istniejącą regułę słowa kluczowego w tabeli keywords."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE keywords
            SET phrase = %s,
                category = %s,
                score = %s,
                keyword_type = %s
            WHERE id = %s
        """, (word.strip(), category.strip(), score, keyword_type, keyword_id))
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[STORAGE] Błąd aktualizacji słowa kluczowego: {e}")
        return False


def delete_keyword(keyword_id: str) -> None:
    """Usuwa regułę słowa kluczowego."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM keywords WHERE id = %s", (keyword_id,))
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[STORAGE] Błąd usuwania słowa kluczowego: {e}")


# =========================================================
# ZAPIS PRZETARGÓW (Tabele `tenders` i `tender_matched_keywords`)
# =========================================================

def append_tenders_to_history(endpoint_name: str, evaluated_items: List[Dict[str, Any]]) -> int:
    """
    Zapisuje ocenione ogłoszenia do tabeli tenders 
    oraz powiązane trafienia (w tym słowa wykluczające) do tabeli tender_matched_keywords.
    """
    conn = get_connection()
    cur = conn.cursor()
    saved_count = 0
    now_pl = datetime.datetime.now(WARSAW_TZ).replace(tzinfo=None)

    for item in evaluated_items:
        data = item.get("data", {})
        ev = item.get("evaluation", {})

        title = (data.get("orderObject") or data.get("title") or "Brak tytułu")[:160]
        description = data.get("body") or data.get("description") or title
        category = (ev.get("matched_categories") or ["Ogólne"])[0][:100]
        location = (data.get("location") or "Polska")[:160]
        source_url = (data.get("url") or "")[:2048]

        deadline = data.get("submissionDeadline")
        if not deadline:
            deadline = now_pl + datetime.timedelta(days=14)

        status = ev.get("status", "NEUTRAL")  # MATCHED / NEUTRAL / REJECTED
        score = int(ev.get("score", 0))

        # Przygotowujemy listę wszystkich powiązanych słów (dopasowane + wykluczające)
        all_associated_words = list(ev.get("matched_keywords", []))
        rejected_word = ev.get("rejected_by")
        if rejected_word and rejected_word not in all_associated_words:
            all_associated_words.append(rejected_word)

        # Sprawdzamy, czy ogłoszenie już istnieje w bazie
        cur.execute("SELECT id FROM tenders WHERE title = %s AND source_url = %s", (title, source_url))
        exists = cur.fetchone()

        if exists:
            # Ogłoszenie już istnieje: uzupełniamy brakujące powiązania słów kluczowych
            existing_tender_id = str(exists[0])
            if all_associated_words:
                clean_words = [w.strip().lower() for w in all_associated_words if w and w.strip()]
                cur.execute("""
                    SELECT id FROM keywords 
                    WHERE LOWER(TRIM(phrase)) = ANY(%s)
                """, (clean_words,))
                kw_rows = cur.fetchall()
                for (kw_id,) in kw_rows:
                    cur.execute("""
                        INSERT INTO tender_matched_keywords (tender_id, keyword_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                    """, (existing_tender_id, kw_id))
                conn.commit()
            continue

        # Nowy przetarg
        tender_id = str(uuid.uuid4())

        # Logika statusu operacyjnego
        if status == "REJECTED":
            operational_status = "REJECTED"
        elif score > 0:
            operational_status = "INTERESTING"
        else:
            operational_status = "NEW"

        try:
            cur.execute("""
                INSERT INTO tenders (
                    id, title, description, category, location,
                    submission_deadline, status, operational_status,
                    score, status_manually_set, source_url, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                tender_id, title, description, category, location,
                deadline, status, operational_status,
                score, False, source_url, now_pl
            ))

            # Bezpieczne zapisywanie powiązań (case-insensitive)
            if all_associated_words:
                clean_words = [w.strip().lower() for w in all_associated_words if w and w.strip()]
                cur.execute("""
                    SELECT id FROM keywords 
                    WHERE LOWER(TRIM(phrase)) = ANY(%s)
                """, (clean_words,))
                kw_rows = cur.fetchall()
                for (kw_id,) in kw_rows:
                    cur.execute("""
                        INSERT INTO tender_matched_keywords (tender_id, keyword_id)
                        VALUES (%s, %s)
                        ON CONFLICT DO NOTHING
                    """, (tender_id, kw_id))

            saved_count += 1
        except Exception as err:
            conn.rollback()
            print(f"[STORAGE] Błąd zapisu ogłoszenia '{title[:30]}': {err}")
            continue

    conn.commit()
    cur.close()
    conn.close()
    return saved_count


# =========================================================
# ANALITYKA I HISTORIA PRZETARGÓW
# =========================================================

def load_tender_history(limit: int = 500) -> List[Dict[str, Any]]:
    """
    Pobiera historię ogłoszeń wraz ze słowami wykluczającymi wyciągniętymi
    z relacji tender_matched_keywords dla rekordów odrzuconych.
    """
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        safe_limit = int(limit)
        cur.execute(f"""
            SELECT 
                t.id,
                t.title,
                t.description,
                t.category,
                t.location,
                t.submission_deadline,
                t.status AS system_status,
                t.status,
                t.operational_status,
                t.operational_status AS business_status,
                t.score,
                t.source_url,
                COALESCE(NULLIF(t.source_url, ''), 'e-Zamówienia') AS endpoint,
                COALESCE(NULLIF(t.source_url, ''), 'e-Zamówienia') AS endpoint_name,
                t.created_at AS scanned_at,
                t.created_at,
                COALESCE(
                    MAX(CASE 
                        WHEN k.keyword_type ~* '(wyklucz|exclud)' 
                        THEN k.phrase 
                    END),
                    ''
                ) AS rejected_by,
                ARRAY[t.category]::text[] AS matched_categories,
                COALESCE(
                    ARRAY_AGG(k.phrase) FILTER (
                        WHERE k.phrase IS NOT NULL 
                        AND NOT (k.keyword_type ~* '(wyklucz|exclud)')
                    ),
                    ARRAY[]::VARCHAR[]
                ) AS matched_keywords
            FROM tenders t
            LEFT JOIN tender_matched_keywords tmk ON t.id = tmk.tender_id
            LEFT JOIN keywords k ON tmk.keyword_id = k.id
            GROUP BY 
                t.id, t.title, t.description, t.category, t.location,
                t.submission_deadline, t.status, t.operational_status,
                t.score, t.source_url, t.created_at
            ORDER BY t.created_at DESC
            LIMIT {safe_limit};
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[STORAGE ERROR] Błąd pobierania historii przetargów: {e}", flush=True)
        raise e


def clear_tender_history() -> bool:
    """Czyści zapisaną historię przetargów wraz ze wszystkimi tabelami powiązanymi kluczami obcymi."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM tender_matched_keywords;")
        cur.execute("DELETE FROM tender_status_history;")
        cur.execute("DELETE FROM user_tender_statuses;")
        cur.execute("DELETE FROM bids;")
        cur.execute("DELETE FROM tenders;")
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"[STORAGE] Błąd czyszczenia historii przetargów: {e}")
        return False