import base64
import hashlib
import io
import re
import smtplib
from datetime import datetime
from email.message import EmailMessage
from typing import List, Optional
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import pandas as pd
import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from openpyxl.styles import Alignment, Font, PatternFill
from pydantic import BaseModel

app = FastAPI(title="Scraper & Excel Worker")


class ScrapeRequest(BaseModel):
    url: str
    selector: Optional[str] = None


class TenderExcelItem(BaseModel):
    externalId: str
    title: str
    score: int
    scoreBreakdown: Optional[str] = None
    status: Optional[str] = None
    publicationDate: Optional[str] = None
    runInfo: Optional[str] = None
    description: Optional[str] = None


class ExcelExportRequest(BaseModel):
    tenders: List[TenderExcelItem]


class SmtpConfig(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = 587
    username: Optional[str] = None
    password: Optional[str] = None


class EmailExcelRequest(BaseModel):
    tenders: List[TenderExcelItem]
    emails: List[str]
    subject: Optional[str] = "Raport przetargow z aplikacji"
    smtp: Optional[SmtpConfig] = None


def make_id(prefix: str, text: str) -> str:
    digest = hashlib.md5(text.encode("utf-8", errors="ignore")).hexdigest()[:10].upper()
    return f"{prefix}-{digest}"


def build_dated_filename() -> str:
    now_pl = datetime.now(ZoneInfo("Europe/Warsaw"))
    stamp = now_pl.strftime("%Y-%m-%d_%H-%M")
    return f"raport_przetargi_{stamp}.xlsx"


def extract_element_item(el, base_url: str, min_len: int):
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


@app.post("/scrape")
def scrape_page(req: ScrapeRequest):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"
    }
    try:
        resp = requests.get(req.url, headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Błąd pobierania strony HTML: {str(e)}")

    html_text = resp.text
    items = []
    seen_titles = set()
    selector = (req.selector or "").strip()

    soup = BeautifulSoup(html_text, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    # TRYB PRECYZYJNY: użytkownik podał konkretny selektor CSS
    if selector:
        try:
            raw_matches = soup.select(selector)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Niepoprawny selektor CSS '{selector}': {str(e)}",
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

        for el in expanded_candidates:
            extracted = extract_element_item(el, req.url, min_len=3)
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

    # TRYB AUTOMATYCZNY (brak selektora): Pandas dla tabel + domyślne selektory BS4
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
                    "externalId": make_id("TBL", req.url + title),
                    "title": title[:280],
                    "description": f"Link: {req.url}\n" + "\n".join(desc_parts[:10]),
                })
    except Exception:
        pass

    for tag in soup(["nav", "footer", "header"]):
        tag.decompose()

    candidates = soup.select("article, tr, .tender, .notice, .offer, li, div.item")
    if not candidates:
        candidates = soup.find_all(["h2", "h3", "a"])

    for el in candidates:
        extracted = extract_element_item(el, req.url, min_len=15)
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


def parse_tender_description(desc: Optional[str], title: str = "", external_id: str = ""):
    source_name = ""
    link_url = ""
    clean_lines = []

    if not desc:
        return source_name, link_url, ""

    title_norm = (title or "").strip().lower()
    ext_norm = (external_id or "").strip().lower()

    for raw_line in desc.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        lower = line.lower()

        if lower.startswith("punktacja kategorii:"):
            continue

        if lower.startswith("źródło:") or lower.startswith("zrodlo:"):
            if not source_name:
                source_name = line.split(":", 1)[1].strip()
            continue

        if lower.startswith("link:"):
            val = line.split(":", 1)[1].strip()
            if val.startswith("http://") or val.startswith("https://"):
                if not link_url:
                    link_url = val
            continue

        if ":" in line:
            val_part = line.split(":", 1)[1].strip().lower()
            if val_part and (val_part == title_norm or val_part == ext_norm):
                continue

        clean_lines.append(line)

    if not link_url:
        match = re.search(r"https?://[^\s]+", desc)
        if match:
            link_url = match.group(0).rstrip(".,;)")

    details_text = "\n".join(clean_lines)
    if len(details_text) > 1200:
        details_text = details_text[:1200].rstrip() + "..."

    return source_name, link_url, details_text


def format_pub_date(raw: Optional[str]) -> str:
    if not raw or not raw.strip():
        return ""
    try:
        dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        return dt.astimezone(ZoneInfo("Europe/Warsaw")).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return raw.strip()


def build_excel_bytes(tenders: List[TenderExcelItem]) -> bytes:
    columns = [
        "ID Zewnętrzne",
        "Tytuł przetargu",
        "Źródło (Endpoint)",
        "Link do przetargu",
        "Punkty (Score)",
        "Suma punktów",
        "Data publikacji",
        "Pobranie",
        "Szczegóły",
    ]

    rows = []
    for t in tenders:
        score_display = (
            t.scoreBreakdown
            if (t.scoreBreakdown and t.scoreBreakdown.strip())
            else f"{t.score} pkt"
        )
        source_name, link_url, clean_details = parse_tender_description(
            t.description, t.title, t.externalId
        )
        rows.append({
            "ID Zewnętrzne": t.externalId,
            "Tytuł przetargu": t.title,
            "Źródło (Endpoint)": source_name,
            "Link do przetargu": link_url,
            "Punkty (Score)": score_display,
            "Suma punktów": t.score,
            "Data publikacji": format_pub_date(t.publicationDate),
            "Pobranie": t.runInfo or "",
            "Szczegóły": clean_details,
        })

    df = pd.DataFrame(rows, columns=columns) if rows else pd.DataFrame(columns=columns)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Przetargi")
        worksheet = writer.sheets["Przetargi"]

        worksheet.freeze_panes = "A2"
        worksheet.auto_filter.ref = worksheet.dimensions

        header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        link_font = Font(color="0563C1", underline="single")
        top_align = Alignment(vertical="top", horizontal="left")
        wrap_align = Alignment(vertical="top", horizontal="left", wrap_text=True)

        for cell in worksheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(vertical="center", horizontal="left")

        title_col_idx = columns.index("Tytuł przetargu") + 1
        link_col_idx = columns.index("Link do przetargu") + 1
        details_col_idx = columns.index("Szczegóły") + 1

        for row_idx in range(2, worksheet.max_row + 1):
            for col_idx in range(1, len(columns) + 1):
                cell = worksheet.cell(row=row_idx, column=col_idx)
                cell.alignment = wrap_align if col_idx in (title_col_idx, details_col_idx) else top_align

            link_cell = worksheet.cell(row=row_idx, column=link_col_idx)
            val = str(link_cell.value or "").strip()
            if val.startswith("http://") or val.startswith("https://"):
                link_cell.hyperlink = val
                link_cell.font = link_font

        for col_cells in worksheet.columns:
            col_letter = col_cells[0].column_letter
            max_line_len = 0
            for cell in col_cells:
                val_str = str(cell.value or "")
                for line in val_str.splitlines() or [""]:
                    if len(line) > max_line_len:
                        max_line_len = len(line)
            worksheet.column_dimensions[col_letter].width = min(max(max_line_len + 3, 14), 55)

    return output.getvalue()


@app.post("/excel/export")
def export_excel(req: ExcelExportRequest):
    excel_bytes = build_excel_bytes(req.tenders)
    b64 = base64.b64encode(excel_bytes).decode("ascii")
    filename = build_dated_filename()
    return {
        "filename": filename,
        "base64": b64,
        "count": len(req.tenders),
    }


@app.post("/excel/email")
def email_excel(req: EmailExcelRequest):
    if not req.emails:
        raise HTTPException(status_code=400, detail="Podaj przynajmniej jeden adres e-mail.")

    excel_bytes = build_excel_bytes(req.tenders)
    b64 = base64.b64encode(excel_bytes).decode("ascii")
    filename = build_dated_filename()

    smtp_cfg = req.smtp
    if not smtp_cfg or not smtp_cfg.host or not smtp_cfg.username or not smtp_cfg.password:
        return {
            "sent": False,
            "filename": filename,
            "base64": b64,
            "message": (
                f"Wygenerowano plik {filename} ({len(req.tenders)} przetargów) dla: {', '.join(req.emails)}. "
                "Aby wysłać wiadomość przez serwer pocztowy, uzupełnij dane w Konfiguracji SMTP."
            ),
        }

    try:
        msg = EmailMessage()
        msg["Subject"] = f"{req.subject or 'Raport przetargow'} ({filename})"
        msg["From"] = smtp_cfg.username
        msg["To"] = ", ".join(req.emails)
        msg.set_content(
            f"W załączniku znajduje się wygenerowany arkusz Excel ({filename}) zawierający {len(req.tenders)} przetargów."
        )
        msg.add_attachment(
            excel_bytes,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename,
        )

        port = smtp_cfg.port or 587
        if port == 465:
            with smtplib.SMTP_SSL(smtp_cfg.host, port, timeout=15) as server:
                server.login(smtp_cfg.username, smtp_cfg.password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_cfg.host, port, timeout=15) as server:
                server.starttls()
                server.login(smtp_cfg.username, smtp_cfg.password)
                server.send_message(msg)

        return {
            "sent": True,
            "filename": filename,
            "base64": b64,
            "message": f"Wysłano plik {filename} ({len(req.tenders)} przetargów) na adresy: {', '.join(req.emails)}.",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Błąd wysyłki SMTP: {str(e)}")