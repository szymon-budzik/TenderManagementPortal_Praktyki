import base64
import io
import re
from datetime import datetime
from typing import List, Optional, Tuple
from zoneinfo import ZoneInfo

import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill

from models import TenderExcelItem

POLAND_TZ = ZoneInfo("Europe/Warsaw")

EXCEL_COLUMNS = [
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


def build_dated_filename() -> str:
    now_pl = datetime.now(POLAND_TZ)
    stamp = now_pl.strftime("%Y-%m-%d_%H-%M")
    return f"raport_przetargi_{stamp}.xlsx"


def parse_tender_description(
    desc: Optional[str], title: str = "", external_id: str = ""
) -> Tuple[str, str, str]:
    source_name = ""
    link_url = ""
    clean_lines: List[str] = []

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
        return dt.astimezone(POLAND_TZ).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return raw.strip()


def build_excel_bytes(tenders: List[TenderExcelItem]) -> bytes:
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

    df = pd.DataFrame(rows, columns=EXCEL_COLUMNS) if rows else pd.DataFrame(columns=EXCEL_COLUMNS)

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

        title_col_idx = EXCEL_COLUMNS.index("Tytuł przetargu") + 1
        link_col_idx = EXCEL_COLUMNS.index("Link do przetargu") + 1
        details_col_idx = EXCEL_COLUMNS.index("Szczegóły") + 1

        for row_idx in range(2, worksheet.max_row + 1):
            for col_idx in range(1, len(EXCEL_COLUMNS) + 1):
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


def generate_excel_export(tenders: List[TenderExcelItem]) -> dict:
    excel_bytes = build_excel_bytes(tenders)
    b64 = base64.b64encode(excel_bytes).decode("ascii")
    filename = build_dated_filename()
    return {
        "filename": filename,
        "base64": b64,
        "count": len(tenders),
    }
