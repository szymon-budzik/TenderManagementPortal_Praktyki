import requests
import pandas as pd
from sqlalchemy import create_engine, text
from apscheduler.schedulers.blocking import BlockingScheduler

# Połączenie z bazą danych PostgreSQL
DB_URL = "postgresql+psycopg2://admin:rootpassword@db:5432/przetargi_db"
engine = create_engine(DB_URL)

def pobierz_konfiguracje():
    """Odczytuje aktualne endpointy i słowa kluczowe z bazy danych"""
    with engine.connect() as conn:
        endpoints_df = pd.read_sql("SELECT * FROM endpoints WHERE status = 'Aktywny'", conn)
        keywords_df = pd.read_sql("SELECT * FROM keywords WHERE category = 'Pożądane'", conn)
    return endpoints_df, keywords_df

def uruchom_pobieranie():
    print("🚀 Uruchamiam Ingestion Engine...")
    endpoints, keywords = pobierz_konfiguracje()
    
    if endpoints.empty:
        print("Brak aktywnych endpointów w bazie. Przerywam pracę.")
        return
        
    # Pobieramy słowa i zamieniamy na małe litery, żeby łatwiej było szukać
    lista_slow = [slowo.lower() for slowo in keywords['word'].tolist()]
    print(f"🎯 Szukam przetargów zawierających słowa: {lista_slow}")
    
    for index, row in endpoints.iterrows():
        nazwa = row['name']
        url = row['url']
        typ = row['type']
        
        print(f"\n📡 Przeszukuję źródło: {nazwa} ({url})")
        
        try:
            if "API" in typ:
                response = requests.get(url, timeout=15)
                response.raise_for_status() # Wyrzuca błąd jeśli status to np. 404 lub 500
                dane = response.json()
                
                # API e-Zamówień zwraca wyniki w różnej formie, często pod kluczem 'data' lub 'results'
                elementy = dane if isinstance(dane, list) else dane.get('data', dane.get('results', []))
                znalezione = 0
                
                for ogloszenie in elementy:
                    # Wyciągamy tytuł/opis z JSONa (dostosuj klucz 'orderTitle' jeśli Twoje API używa innej nazwy)
                    tytul = str(ogloszenie.get('orderTitle', ogloszenie.get('title', ''))).lower()
                    
                    if any(slowo in tytul for slowo in lista_slow):
                        znalezione += 1
                        print(f"✅ Trafienie: {tytul[:80]}...")
                        # Docelowo tutaj dodasz zapis tego ogłoszenia do bazy danych
                        
                print(f"📊 Zakończono. Trafienia w tym źródle: {znalezione}")
                
            else:
                print("🛠️ To źródło wymaga web scrapingu (HTML) - do zaimplementowania.")
                
        except Exception as e:
            print(f"❌ Błąd podczas pobierania z {nazwa}: {e}")

if __name__ == "__main__":
    print("🕒 Startuję harmonogram APScheduler...")
    scheduler = BlockingScheduler()
    
    # Odpalamy raz od razu przy uruchomieniu
    uruchom_pobieranie()
    
    # Następnie ustawiamy cykliczne uruchamianie, np. co 60 minut (do testów możesz wpisać minutes=1)
    scheduler.add_job(uruchom_pobieranie, 'interval', minutes=60)
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("Zatrzymano harmonogram.")