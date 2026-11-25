import base64
import smtplib
from email.message import EmailMessage
from typing import List, Optional

from fastapi import HTTPException

from excel_export import build_dated_filename, build_excel_bytes
from models import SmtpConfig, TenderExcelItem


def send_excel_email(
    tenders: List[TenderExcelItem],
    emails: List[str],
    subject: Optional[str],
    smtp_cfg: Optional[SmtpConfig],
) -> dict:
    if not emails:
        raise HTTPException(status_code=400, detail="Podaj przynajmniej jeden adres e-mail.")

    excel_bytes = build_excel_bytes(tenders)
    b64 = base64.b64encode(excel_bytes).decode("ascii")
    filename = build_dated_filename()

    if not smtp_cfg or not smtp_cfg.host or not smtp_cfg.username or not smtp_cfg.password:
        return {
            "sent": False,
            "filename": filename,
            "base64": b64,
            "message": (
                f"Wygenerowano plik {filename} ({len(tenders)} przetargów) dla: {', '.join(emails)}. "
                "Aby wysłać wiadomość przez serwer pocztowy, uzupełnij dane w Konfiguracji SMTP."
            ),
        }

    try:
        msg = EmailMessage()
        msg["Subject"] = f"{subject or 'Raport przetargow'} ({filename})"
        msg["From"] = smtp_cfg.username
        msg["To"] = ", ".join(emails)
        msg.set_content(
            f"W załączniku znajduje się wygenerowany arkusz Excel ({filename}) zawierający {len(tenders)} przetargów."
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
            "message": f"Wysłano plik {filename} ({len(tenders)} przetargów) na adresy: {', '.join(emails)}.",
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Błąd wysyłki SMTP: {str(exc)}")
