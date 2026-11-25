import hashlib
import io
from typing import Dict, List, Optional
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup
from fastapi import HTTPException

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
)


def make_id(prefix: str, text: str) -> str:
    digest = hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()[:10].upper()
    return f"{prefix}-{digest}"


def fetch_html(url: str, timeout: int = 15) -> str:
    headers = {"User-Agent": DEFAULT_USER_AGENT}
    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Błąd pobierania strony HTML: {str(exc)}")


def extract_element_item(el, base_url: str, min_len: int) -> Optional[Dict[str, str]]:
    if el.name == "tr":
        cells = [c.get_text(" ", strip=True) for c in el.find_all(["td", "th"])]
        cells = [c for c in cells if c]
        if not cells:
            return None
        title_text = max(cells, key=len)
        full_text = " | ".join(cells)
    else:
        heading = el.find(["h1", "h2", "h3", "h4", "a", "strong"])
        title_text = heading.get_text(" ", strip=True) if heading else el.get_text(" ", strip=True)
        full_text = el.get_text(" ", strip=True)

    if len(title_text) < min_len:
        return None
    if len(title_text) > 260:
        title_text = title_text[:260] + "..."

    link_tag = el if el.name == "a" else el.find("a", href=True)
    raw_href = link_tag["href"] if (link_tag and link_tag.has_attr("href")) else ""
    full_href = urljoin(base_url, raw_href) if raw_href else base_url

    desc = f"Link: {full_href}\n"
    if full_text and full_text != title_text:
        desc += f"Treść: {full_text[:700]}"

    return {
        "externalId": make_id("BS4", base_url + title_text),
        "title": title_text,
        "description": desc.strip(),
    }


def _scrape_with_custom_selector(soup: BeautifulSoup, url: str, selector: str) -> dict:
    try:
        raw_matches = soup.select(selector)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Niepoprawny selektor CSS '{selector}': {str(exc)}",
        )

    expanded_candidates = []
    for el in raw_matches:
        if el.name == "table":
            rows = el.find_all("tr")
            if rows:
                expanded_candidates.extend(rows)
            else:
                expanded_candidates.append(el)
        else:
            expanded_candidates.append(el)

    items: List[Dict[str, str]] = []
    seen_titles = set()
    for el in expanded_candidates:
        extracted = extract_element_item(el, url, min_len=3)
        if not extracted:
            continue
        key = extracted["title"].lower()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        items.append(extracted)
        if len(items) >= 150:
            break

    return {
        "success": True,
        "mode": "CUSTOM_SELECTOR",
        "selector": selector,
        "matchedElementsCount": len(raw_matches),
        "count": len(items),
        "items": items,
    }


def _scrape_automatically(soup: BeautifulSoup, html_text: str, url: str) -> dict:
    items: List[Dict[str, str]] = []
    seen_titles = set()

    try:
        tables = pd.read_html(io.StringIO(html_text))
        for df in tables:
            df = df.dropna(how="all").fillna("")
            if df.empty or len(df.columns) < 2:
                continue
            for _, row in df.iterrows():
                vals = [
                    str(v).strip()
                    for v in row.values
                    if str(v).strip() and str(v).strip() != "nan"
                ]
                if not vals:
                    continue
                title = max(vals, key=len)
                if len(title) < 12 or title.lower() in seen_titles:
                    continue
                seen_titles.add(title.lower())
                desc_parts = [
                    f"{col}: {str(row[col]).strip()}"
                    for col in df.columns
                    if str(row[col]).strip()
                ]
                items.append({
                    "externalId": make_id("TBL", url + title),
                    "title": title[:280],
                    "description": f"Link: {url}\n" + "\n".join(desc_parts[:10]),
                })
    except Exception:
        pass

    for tag in soup(["nav", "footer", "header"]):
        tag.decompose()

    candidates = soup.select("article, tr, .tender, .notice, .offer, li, div.item")
    if not candidates:
        candidates = soup.find_all(["h2", "h3", "a"])

    for el in candidates:
        extracted = extract_element_item(el, url, min_len=15)
        if not extracted:
            continue
        key = extracted["title"].lower()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        items.append(extracted)
        if len(items) >= 100:
            break

    return {
        "success": True,
        "mode": "AUTO",
        "selector": "",
        "matchedElementsCount": len(candidates),
        "count": len(items),
        "items": items,
    }


def scrape_url(url: str, raw_selector: Optional[str] = None) -> dict:
    html_text = fetch_html(url)
    selector = (raw_selector or "").strip()

    soup = BeautifulSoup(html_text, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    if selector:
        return _scrape_with_custom_selector(soup, url, selector)
    return _scrape_automatically(soup, html_text, url)
