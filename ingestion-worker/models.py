from typing import List, Optional
from pydantic import BaseModel


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
