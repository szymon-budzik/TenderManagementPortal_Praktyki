from fastapi import FastAPI

from email_sender import send_excel_email
from excel_export import generate_excel_export
from models import EmailExcelRequest, ExcelExportRequest, ScrapeRequest
from scraper import scrape_url

app = FastAPI(title="Scraper & Excel Worker")


@app.post("/scrape")
def scrape_page(req: ScrapeRequest):
    return scrape_url(req.url, req.selector)


@app.post("/excel/export")
def export_excel(req: ExcelExportRequest):
    return generate_excel_export(req.tenders)


@app.post("/excel/email")
def email_excel(req: EmailExcelRequest):
    return send_excel_email(req.tenders, req.emails, req.subject, req.smtp)
