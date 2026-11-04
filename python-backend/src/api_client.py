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
            return True, "Serwer osiągalny (Status: 400 - wymagane parametry zapytania)"
        return False, f"Błąd odpowiedzi (Status: {response.status_code})"
    except requests.exceptions.RequestException as e:
        return False, f"Brak połączenia: {str(e)}"


def _build_page_url(base_url: str, page_param: str, page_number: int) -> str:
    """Dynamicznie wstrzykuje lub aktualizuje parametr numeru strony w URL."""
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


def fetch_latest_items(url: str, limit: int = 50) -> Tuple[bool, List[Dict[str, Any]], str]:
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

    # 2. Analiza parametrów paginacji w URL
    parsed_url = urllib.parse.urlsplit(url)
    query_params = urllib.parse.parse_qs(parsed_url.query, keep_blank_values=True)

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

    if not page_param_name:
        if "PageSize" in query_params:
            page_param_name = "PageNumber"
        else:
            has_page_size = any(k.lower() in ["pagesize", "per_page"] for k in query_params.keys())
            page_param_name = "pageNumber" if has_page_size else "page"

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
    last_page_sample = None

    try:
        while len(all_items) < limit:
            if current_page == start_page and not has_existing_page_param:
                request_url = url
            else:
                request_url = _build_page_url(url, page_param_name, current_page)

            print(f"[DEBUG PAGINACJA] Pobieram stronę {current_page} -> URL: {request_url}", flush=True)

            response = requests.get(request_url, headers=headers, timeout=15)

            if response.status_code != 200:
                print(f"[DEBUG PAGINACJA] Błąd HTTP {response.status_code} na stronie {current_page}", flush=True)
                if current_page == start_page:
                    return False, [], f"Błąd API: kod {response.status_code}"
                break

            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" in content_type:
                success, items, err = fetch_html_tenders(url, limit=limit)
                msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd scrapingu HTML")
                return success, items, msg

            data = response.json()

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

            print(f"[DEBUG PAGINACJA] Strona {current_page} zwróciła {len(items)} elementów. Suma: {len(all_items) + len(items)}/{limit}", flush=True)

            if not items:
                print(f"[DEBUG PAGINACJA] Brak kolejnych elementów, kończę pętlę.", flush=True)
                break

            current_sample = str(items[:2])
            if current_sample == last_page_sample:
                print(f"[DEBUG PAGINACJA] API powtórzyło dane ze strony {current_page - 1}, zatrzymuję.", flush=True)
                break
            last_page_sample = current_sample

            all_items.extend(items)

            current_page += 1

            if len(all_items) < limit:
                time.sleep(0.3)

        result_items = all_items[:limit]
        return True, result_items, f"Pobrano pomyślnie ({len(result_items)} rekordów)"

    except ValueError:
        if current_page == start_page:
            success, items, err = fetch_html_tenders(url, limit=limit)
            msg = "Pobrano pomyślnie przez scraper HTML" if success else (err or "Błąd parsowania odpowiedzi")
            return success, items, msg
        return True, all_items[:limit], "Pobrano częściowe dane"

    except Exception as e:
        if all_items:
            return True, all_items[:limit], f"Pobrano częściowo z ostrzeżeniem: {str(e)}"
        return False, [], f"Błąd: {str(e)}"