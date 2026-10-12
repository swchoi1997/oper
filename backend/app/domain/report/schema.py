from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class ReportBase(BaseModel):
    title: str = Field(..., max_length=255, description="일지 제목")
    report_date: Optional[date] = Field(default=None, description="운영 일자")
    author: Optional[str] = Field(default=None, max_length=100, description="작성자")
    status: str = Field(default="DRAFT", max_length=50, description="상태 (DRAFT, COMPLETED, ARCHIVED)")

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    report_date: Optional[date] = None
    author: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, max_length=50)

class ReportResponse(ReportBase):
    id: int
    report_date: date
    created_at: datetime
    updated_at: datetime
    details_count: int = 0

    class Config:
        from_attributes = True

class ReportListResponse(BaseModel):
    items: List[ReportResponse]
    total: int
