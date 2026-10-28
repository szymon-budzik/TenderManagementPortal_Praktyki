import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from typing import List, Dict, Tuple, Optional
import hashlib

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8"
}

def fetch_html_tenders(url: str, limit: int = 20, timeout: int = 10) -> Tuple[bool, List[Dict], Optional[str]]:
    """
    Pobiera stronę HTML i wyciąga ogłoszenia do zunifikowanego formatu słownika.
    Zwraca: (sukces, lista_ogloszen, tresc_bledu)
    """
    try:
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
        if response.status_code != 200:
            return False, [], f"Serwer zwrócił kod HTTP {response.status_code}"

        # Automatyczne wykrywanie kodowania (BIP-y często używają ISO-8859-2 lub UTF-8)
        response.encoding = response.apparent_encoding or "utf-8"
        soup = BeautifulSoup(response.text, "lxml")

        items = []

        # 1. Podejście A: Szukanie w tabelach (standard BIP: <table> z wierszami przetargów)
        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            for row in rows[1:]:  # pomijamy nagłówek thead
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    link_tag = row.find("a")
                    title = link_tag.get_text(strip=True) if link_tag else row.get_text(" ", strip=True)
                    
                    if len(title) > 10:  # odrzucenie pustych komórek / pagination
                        href = link_tag.get("href") if link_tag else ""
                        full_url = urljoin(url, href) if href else url
                        uid = hashlib.md5((full_url + title).encode("utf-8")).hexdigest()[:16]

                        items.append({
                            "objectId": uid,
                            "title": title,
                            "orderObject": title,
                            "url": full_url,
                            "raw_html_snippet": str(row)[:300]
                        })

        # 2. Podejście B: Jeśli brak tabel, szukanie klocków/list (divy z klasami notice/tender/item lub tagi article)
        if not items:
            cards = soup.select("article, .notice, .tender, .postepowanie, .ogloszenie, .item, .news-item")
            for card in cards:
                link_tag = card.find("a")
                title = card.get_text(" ", strip=True)
                if link_tag and len(link_tag.get_text(strip=True)) > 8:
                    title = link_tag.get_text(strip=True)

                if len(title) > 10:
                    href = link_tag.get("href") if link_tag else ""
                    full_url = urljoin(url, href) if href else url
                    uid = hashlib.md5((full_url + title).encode("utf-8")).hexdigest()[:16]

                    items.append({
                        "objectId": uid,
                        "title": title,
                        "orderObject": title,
                        "url": full_url
                    })

        # 3. Podejście C: Szukanie bezpośrednio linków z frazami przetargowymi
        if not items:
            for a_tag in soup.find_all("a", href=True):
                text = a_tag.get_text(strip=True)
                href = a_tag["href"].lower()
                text_lower = text.lower()
                
                # Słowa wskazujące na postępowanie
                if any(k in text_lower or k in href for k in ["przetarg", "zamówien", "postępowan", "zapytan", "bzp"]):
                    if len(text) > 15:
                        full_url = urljoin(url, a_tag["href"])
                        uid = hashlib.md5((full_url + text).encode("utf-8")).hexdigest()[:16]
                        items.append({
                            "objectId": uid,
                            "title": text,
                            "orderObject": text,
                            "url": full_url
                        })

        # Usunięcie powtórek i obcięcie do limitu
        unique_items = []
        seen_ids = set()
        for it in items:
            if it["objectId"] not in seen_ids:
                seen_ids.add(it["objectId"])
                unique_items.append(it)
            if len(unique_items) >= limit:
                break

        return True, unique_items, None

    except Exception as e:
        return False, [], str(e)