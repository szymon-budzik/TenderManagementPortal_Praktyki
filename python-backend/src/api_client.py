import requests
from typing import Tuple, List, Dict, Any
from html_scraper import fetch_html_tenders

def test_connection(url: str, timeout: int = 5) -> Tuple[bool, str]:
    """Sprawdza czy API lub strona odpowiada kodem 2xx."""
    try:
        response = requests.get(url, timeout=timeout)
        if response.status_code in [200, 201]:
            return True, f"Połączono pomyślnie (Status: {response.status_code})"
        return False, f"Błąd odpowiedzi (Status: {response.status_code})"
    except requests.exceptions.RequestException as e:
        return False, f"Brak połączenia: {str(e)}"

def fetch_latest_items(url: str, limit: int = 10) -> Tuple[bool, List[Dict[str, Any]], str]:
    """Pobiera i parsuje obiekty z endpointu API (JSON) lub strony HTML (BeautifulSoup)."""
    # 1. Jeśli w adresie widać typowe rozszerzenia stron BIP/HTML, od razu użyj BeautifulSoup
    if any(hint in url.lower() for hint in [".html", ".htm", "/bip", "bip."]):
        success, items, err = fetch_html_tenders(url, limit=limit)
        msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd scrapingu HTML")
        return success, items, msg

    # 2. Standardowa ścieżka dla API REST (JSON)
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "application/json, text/html, */*"
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return False, [], f"Błąd API: kod {response.status_code}"

        # Jeśli endpoint zwrócił HTML zamiast JSON-a, przełącz na scraper HTML
        content_type = response.headers.get("Content-Type", "").lower()
        if "text/html" in content_type:
            success, items, err = fetch_html_tenders(url, limit=limit)
            msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd scrapingu HTML")
            return success, items, msg

        data = response.json()

        # Obsługa formatów API (lista bezpośrednia lub słownik z polem 'items'/'data'/'results')
        if isinstance(data, dict):
            items = data.get("items") or data.get("data") or data.get("results") or []
        elif isinstance(data, list):
            items = data
        else:
            items = []

        return True, items[:limit], "Pobrano pomyślnie"

    except ValueError:
        # Fallback: gdy requests nie mógł zdekodować JSON-a, próbujemy parsować jako stronę HTML
        success, items, err = fetch_html_tenders(url, limit=limit)
        msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd parsowania odpowiedzi")
        return success, items, msg

    except Exception as e:
        return False, [], f"Błąd parsowania: {str(e)}"