import requests
import pandas as pd
from sqlalchemy import create_engine, text
import time
from datetime import datetime, timedelta

DB_URL = "postgresql+psycopg2://admin:rootpassword@db:5432/przetargi_db"
engine = create_engine(DB_URL)

def inicjalizuj_baze():
    """Tworzy tabele do komunikacji między GUI a Workerem, jeśli nie istnieją."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_settings (
                id SERIAL PRIMARY KEY,
                worker_status VARCHAR(20) DEFAULT 'stopped',
                run_interval INT DEFAULT 60,
                last_run TIMESTAMP
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS worker_logs (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message TEXT
            )
        """))
        
        # Inicjalizacja domyślnych ustawień (tylko pierwszy wiersz)
        wynik = conn.execute(text("SELECT COUNT(*) FROM app_settings")).scalar()
        if wynik == 0:
            conn.execute(text("INSERT INTO app_settings (id, worker_status, run_interval) VALUES (1, 'stopped', 60)"))
        conn.commit()

def log_msg(wiadomosc):
    """Zapisuje log jednocześnie w konsoli Dockera i w bazie (dla mini-konsoli w GUI)"""
    teraz = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pelny_msg = f"[{teraz}] {wiadomosc}"
    print(pelny_msg)
    try:
        with engine.connect() as conn:
            conn.execute(text("INSERT INTO worker_logs (message) VALUES (:m)"), {"m": wiadomosc})
            conn.commit()
    except Exception as e:
        print(f"Błąd zapisu logu: {e}")

def pobierz_konfiguracje():
    with engine.connect() as conn:
        endpoints_df = pd.read_sql("SELECT * FROM endpoints WHERE status = 'Aktywny'", conn)
        keywords_df = pd.read_sql("SELECT * FROM keywords WHERE category = 'Pożądane'", conn)
    return endpoints_df, keywords_df

def uruchom_pobieranie():
    log_msg("🚀 Rozpoczynam cykl pobierania danych...")
    endpoints, keywords = pobierz_konfiguracje()
    
    if endpoints.empty:
        log_msg("⚠️ Brak aktywnych endpointów. Przerywam.")
        return
        
    lista_slow = [slowo.lower() for slowo in keywords['word'].tolist()]
    log_msg(f"🎯 Szukane słowa: {lista_slow}")
    
    for index, row in endpoints.iterrows():
        nazwa = row['name']
        url = row['url']
        typ = row['type']
        
        log_msg(f"📡 Źródło: {nazwa}")
        
        try:
            if "API" in typ:
                naglowki = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
                
                response = requests.get(url, headers=naglowki, timeout=15)
                response.raise_for_status() 
                dane = response.json()
                
                elementy = dane if isinstance(dane, list) else []
                znalezione = 0
                
                for ogloszenie in elementy:
                    tytul = str(ogloszenie.get('orderObject', '')).lower()
                    
                    if tytul and any(slowo in tytul for slowo in lista_slow):
                        znalezione += 1
                        try:
                            with engine.connect() as conn_insert:
                                # Sprawdzamy czy nie ma już takiego tytułu by uniknąć duplikatów
                                exists = conn_insert.execute(
                                    text("SELECT 1 FROM tenders WHERE title = :t LIMIT 1"), {"t": tytul}
                                ).scalar()
                                
                                if not exists:
                                    conn_insert.execute(
                                        text("INSERT INTO tenders (title, source_name) VALUES (:t, :s)"), 
                                        {"t": tytul, "s": nazwa}
                                    )
                                    conn_insert.commit()
                        except Exception as ex:
                            log_msg(f"❌ Błąd zapisu SQL: {ex}")
                        
                log_msg(f"✅ Znaleziono pasujących ogłoszeń: {znalezione}")
                
            else:
                log_msg("🛠️ Źródło HTML pominięte (brak implementacji).")
                
        except Exception as e:
            log_msg(f"❌ Błąd pobierania {nazwa}: {e}")
            
    log_msg("🏁 Cykl zakończony.")

if __name__ == "__main__":
    print("🕒 Oczekiwane na gotowość bazy danych...")
    for i in range(10):
        try:
            with engine.connect():
                print("✅ Baza gotowa!")
                break
        except Exception:
            time.sleep(3)

    inicjalizuj_baze()
    
    # Wymuszamy natychmiastowe uruchomienie cyklu po włączeniu kontenera
    try:
        with engine.connect() as conn:
            conn.execute(text("UPDATE app_settings SET worker_status = 'running', last_run = NULL WHERE id = 1"))
            conn.commit()
    except Exception as e:
        print(f"Błąd resetu ustawień: {e}")

    log_msg("🤖 Skrypt w gotowości. Wykonuję natychmiastowe pierwsze sprawdzanie...")

    while True:
        try:
            with engine.connect() as conn:
                wynik = conn.execute(text("SELECT worker_status, run_interval, last_run FROM app_settings WHERE id = 1")).fetchone()
                status, interval_min, last_run = wynik
                
                if status == 'running':
                    teraz = datetime.now()
                    # Uruchom jeśli to pierwszy raz po włączeniu, lub minął interwał
                    if last_run is None or teraz >= (last_run + timedelta(minutes=interval_min)):
                        uruchom_pobieranie()
                        
                        # Aktualizujemy czas OSTATNIEGO wykonania
                        conn.execute(text("UPDATE app_settings SET last_run = :now WHERE id = 1"), {"now": datetime.now()})
                        conn.commit()
                        
        except Exception as e:
            print(f"Błąd głównej pętli: {e}")
            
        # Krótsza drzemka dla szybszej reakcji przycisków w GUI
        time.sleep(5)