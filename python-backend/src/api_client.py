import time
import urllib.parse
from typing import Tuple, List, Dict, Any
import requests
from html_scraper import fetch_html_tenders


def test_connection(url: str, timeout: int = 5) -> Tuple[bool, str]:
    """Sprawdza czy API lub strona odpowiada kodem 2xx lub 400 (wymagane parametry zapytania)."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/html, */*"
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code in [200, 201]:
            return True, f"Połączono pomyślnie (Status: {response.status_code})"
        if response.status_code == 400:
            # Wiele rządowych API (np. e-Zamówienia) bez podanych parametrów zwraca 400, co oznacza, że serwer żyje
            return True, "Serwer osiągalny (Status: 400 - wymagane parametry zapytania)"
        return False, f"Błąd odpowiedzi (Status: {response.status_code})"
    except requests.exceptions.RequestException as e:
        return False, f"Brak połączenia: {str(e)}"


def _build_page_url(base_url: str, page_param: str, page_number: int) -> str:
    """Dynamicznie wstrzykuje lub aktualizuje parametr numeru strony w URL bez psucia reszty parametrów."""
    parsed = urllib.parse.urlsplit(base_url)
    query_dict = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    query_dict[page_param] = [str(page_number)]
    new_query = urllib.parse.urlencode(query_dict, doseq=True)
    return urllib.parse.urlunsplit((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        new_query,
        parsed.fragment
    ))


def fetch_latest_items(url: str, limit: int = 10) -> Tuple[bool, List[Dict[str, Any]], str]:
    """
    Pobiera i parsuje obiekty z endpointu API (JSON) z automatyczną obsługą wielu podstron
    lub ze strony HTML (BeautifulSoup). Zwraca (sukces, lista_obiektów, komunikat).
    """
    if not url:
        return False, [], "Brak zdefiniowanego adresu URL"

    # 1. Ścieżka dla stron BIP/HTML
    if any(hint in url.lower() for hint in [".html", ".htm", "/bip", "bip."]):
        success, items, err = fetch_html_tenders(url, limit=limit)
        msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd scrapingu HTML")
        return success, items, msg

    # 2. Analiza parametrów paginacji w URL (bez hardcodowania domeny)
    parsed_url = urllib.parse.urlsplit(url)
    query_params = urllib.parse.parse_qs(parsed_url.query, keep_blank_values=True)

    # Sprawdzamy, czy w przekazanym URL istnieje już parametr strony
    page_param_name = None
    start_page = 1
    has_existing_page_param = False

    for param_key in query_params.keys():
        if param_key.lower() in ["pagenumber", "pageindex", "page", "p", "strona"]:
            page_param_name = param_key
            has_existing_page_param = True
            try:
                start_page = int(query_params[param_key][0])
            except (ValueError, IndexError):
                start_page = 1
            break

    # Jeśli w URL nie zdefiniowano parametru strony:
    # jeśli URL posiada PageSize -> domyślnie pageNumber, w pozostałych -> page
    if not page_param_name:
        has_page_size = any(k.lower() in ["pagesize", "per_page"] for k in query_params.keys())
        page_param_name = "pageNumber" if has_page_size else "page"

    # Odczyt zadeklarowanego rozmiaru strony (jeśli istnieje w URL)
    declared_page_size = None
    for k, v in query_params.items():
        if k.lower() in ["pagesize", "size", "limit", "per_page"]:
            try:
                declared_page_size = int(v[0])
                break
            except (ValueError, IndexError):
                pass

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html, */*"
    }

    all_items = []
    current_page = start_page
    last_page_data_sample = None

    try:
        while len(all_items) < limit:
            # Pierwsze zapytanie wysyłamy na oryginalny URL (jeśli nie miał parametru strony)
            if current_page == start_page and not has_existing_page_param:
                request_url = url
            else:
                request_url = _build_page_url(url, page_param_name, current_page)

            response = requests.get(request_url, headers=headers, timeout=12)

            # Błąd na pierwszej stronie przerywa działanie; na kolejnych stronach zwraca to, co już pobrano
            if response.status_code != 200:
                if current_page == start_page:
                    return False, [], f"Błąd API: kod {response.status_code}"
                break

            # Obsługa sytuacji, gdy endpoint zwrócił HTML zamiast JSON
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" in content_type:
                success, items, err = fetch_html_tenders(url, limit=limit)
                msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd scrapingu HTML")
                return success, items, msg

            data = response.json()

            # Ekstrakcja rekordów z różnych standardów API (lista, items, data, results, content)
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = (
                    data.get("items")
                    or data.get("data")
                    or data.get("results")
                    or data.get("content")
                    or []
                )

            # Koniec danych na serwerze
            if not items:
                break

            # Zabezpieczenie przed API, które ignoruje parametry paginacji i zwraca w kółko to samo
            current_sample = str(items[:2])
            if current_sample == last_page_data_sample:
                break
            last_page_data_sample = current_sample

            all_items.extend(items)

            # Jeśli otrzymano mniej rekordów niż deklarowany rozmiar strony, to była to ostatnia strona
            if declared_page_size and len(items) < declared_page_size:
                break

            current_page += 1

            # Odstęp czasowy tylko w przypadku konieczności wykonania kolejnego zapytania
            if len(all_items) < limit:
                time.sleep(0.3)

        return True, all_items[:limit], f"Pobrano pomyślnie ({len(all_items[:limit])} rekordów)"

    except ValueError:
        # Fallback na HTML parser, jeśli dekodowanie JSON-a się nie powiodło
        if current_page == start_page:
            success, items, err = fetch_html_tenders(url, limit=limit)
            msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd parsowania odpowiedzi")
            return success, items, msg
        return True, all_items[:limit], "Pobrano częściowe dane"

    except Exception as e:
        if all_items:
            return True, all_items[:limit], f"Pobrano częściowo z ostrzeżeniem: {str(e)}"
        return False, [], f"Błąd parsowania: {str(e)}"