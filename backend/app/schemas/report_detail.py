from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class ReportDetailBase(BaseModel):
    title: str = Field(..., max_length=255, description="항목 제목")
    content: Optional[str] = Field(default=None, description="본문 내용 (마크다운)")
    description: Optional[str] = Field(default=None, description="간략 요약/설명")
    image_url: Optional[str] = Field(default=None, description="이미지 첨부 URL 또는 경로")

class ReportDetailCreate(ReportDetailBase):
    parent_id: Optional[int] = Field(default=None, description="부모 항목 ID (최상위인 경우 None)")
    sort_order: Optional[int] = Field(default=None, description="동일 계층 내 정렬 순서 (미지정 시 마지막 순번 자동 부여)")

class ReportDetailUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None

class ReportDetailResponse(ReportDetailBase):
    id: int
    report_id: int
    parent_id: Optional[int] = None
    path: str
    sort_order: int
    depth: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ReportDetailNode(ReportDetailResponse):
    children: List["ReportDetailNode"] = []

ReportDetailNode.model_rebuild()

class ReorderRequest(BaseModel):
    target_detail_id: int
    new_parent_id: Optional[int] = None
    new_sort_order: int
