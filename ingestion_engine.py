import requests
from bs4 import BeautifulSoup
from datetime import datetime
from apscheduler.schedulers.blocking import BlockingScheduler 

# ==========================================
# MODUŁ 1: NORMALIZATOR I WALIDATOR
# ==========================================

def clean_html_content(raw_html):
    """
    Usuwa wszelkie znaczniki HTML z tekstu (np. <p>, <b>).
    Zgodnie z założeniami projektu, przygotowuje czysty tekst dla Javy.
    """
    if not raw_html:
        return ""
    # BeautifulSoup analizuje kod HTML i wyciąga z niego tylko czysty tekst
    soup = BeautifulSoup(raw_html, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def normalize_tender_data(raw_tender):
    """
    Przekształca surowe dane z zewnętrznego API (np. dane.gov.pl) 
    do ujednoliconego formatu JSON.
    """
    # Pobieramy dane z surowego rekordu (używamy .get(), by uniknąć błędu, gdy brakuje klucza)
    raw_title = raw_tender.get('title', 'Brak tytułu')
    raw_description = raw_tender.get('description', '') 
    
    # Oczyszczamy opis ze zbędnego kodu HTML
    clean_description = clean_html_content(raw_description)
    
    # Zwracamy słownik o stałej, przewidywalnej strukturze
    return {
        "externalId": raw_tender.get('id'),
        "title": raw_title,
        "description": clean_description,
        "source": "dane.gov.pl",
        # Dodajemy aktualną datę pobrania w standardowym formacie ISO
        "ingestedAt": datetime.now().isoformat() 
    }

# ==========================================
# MODUŁ 2: KOMUNIKACJA Z BACKENDEM (JAVA)
# ==========================================

def send_to_java_backend(payload):
    """
    Wysyła oczyszczony i znormalizowany pakiet danych (payload) do Javy
    poprzez wewnętrzny endpoint POST.
    """
    # Adres docelowy aplikacji w Javie (zgodnie z dokumentacją)
    java_api_url = "http://localhost:8080/api/internal/tenders"
    
    print(f"\n[WYSYŁANIE] Przekazuję dane do Javy: {java_api_url}...")
    
    try:
        # json=payload automatycznie konwertuje słownik na format JSON i wysyła go metodą POST
        response = requests.post(java_api_url, json=payload)
        
        # Wyrzuca błąd, jeśli Java odpowie kodem błędu HTTP (np. 404, 500)
        response.raise_for_status() 
        
        print(f"[SUKCES] Java poprawnie odebrała dane (Kod: {response.status_code})")
        
    except requests.exceptions.ConnectionError:
        # Ten błąd wystąpi, dopóki Twój kolega z zespołu nie uruchomi serwera Spring Boot
        print("[BŁĄD POŁĄCZENIA] Serwer Java nie odpowiada. Wymagane uruchomienie backendu Javy!")
    except requests.exceptions.RequestException as e:
        # Przechwytuje inne nieoczekiwane błędy sieciowe
        print(f"[INNY BŁĄD] Wystąpił problem podczas wysyłania: {e}")

# ==========================================
# MODUŁ 3: POBIERANIE DANYCH (INGESTION)
# ==========================================

def fetch_test_data():
    """
    Główna funkcja wykonująca jeden pełny cykl operacyjny:
    1. Pobiera dane z publicznego API.
    2. Normalizuje rekord.
    3. Wysyła go do Javy.
    """
    print(f"\n--- NOWY CYKL [{datetime.now().strftime('%H:%M:%S')}] ---")
    
    # Testowy adres API
    url = "https://api.dane.gov.pl/1.4/datasets"
    
    try:
        # Zapytanie GET do publicznego serwera
        response = requests.get(url)
        response.raise_for_status()
        
        # Odczytujemy odpowiedź jako słownik (JSON)
        data = response.json()
        
        # Sprawdzamy, czy struktura zawiera dane i czy lista nie jest pusta
        if 'data' in data and len(data['data']) > 0:
            first_item = data['data'][0] # Pobieramy testowo tylko pierwszy element
            
            # Etap 1: Czyszczenie danych (Normalizator)
            processed_item = normalize_tender_data(first_item)
            
            # Etap 2: Wysłanie paczki danych do Javy
            send_to_java_backend(processed_item)
            
    except requests.exceptions.RequestException as e:
        print(f"[BŁĄD API] Nie udało się pobrać danych z zewnętrznego źródła: {e}")

# ==========================================
# PUNKT STARTOWY APLIKACJI I HARMONOGRAM
# ==========================================

if __name__ == "__main__":
    print("Inicjalizacja Modułu Ingestion Engine (Python)...")
    
    # Tworzymy obiekt harmonogramu, który będzie utrzymywał skrypt przy życiu (nieskończona pętla)
    scheduler = BlockingScheduler()
    
    # Konfigurujemy zadanie: wywołaj funkcję `fetch_test_data` dokładnie co 10 sekund
    # Do testów 10 sekund, na produkcji zmienisz to np. na: hours=3 lub minutes=30
    scheduler.add_job(fetch_test_data, 'interval', seconds=10)
    
    # Wywołujemy pierwszy cykl ręcznie, żeby nie czekać na start pierwszych 10 sekund
    fetch_test_data()
    
    try:
        print("\nUruchamiam harmonogram działania w tle...")
        print("Aby zatrzymać skrypt, kliknij w to okno i wciśnij skrót klawiszowy: Ctrl+C")
        
        # Uruchamiamy pętlę harmonogramu - skrypt czeka na kolejne wywołania czasowe
        scheduler.start()
        
    except (KeyboardInterrupt, SystemExit):
        # Czyste zamknięcie aplikacji po wciśnięciu Ctrl+C przez użytkownika
        print("\nZatrzymano działanie skryptu.")