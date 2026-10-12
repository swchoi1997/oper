from typing import Optional
from fastapi import APIRouter, Depends, Query, status
import asyncpg
from app.core.database import get_db_connection
from app.domain.report.service import ReportService
from app.domain.report.schema import (
    ReportCreate,
    ReportUpdate,
    ReportResponse,
    ReportListResponse
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])
report_service = ReportService()

@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="제목 또는 작성자 검색"),
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """운영 일지 목록을 페이징 및 검색 조건으로 조회합니다."""
    return await report_service.list_reports(conn, page=page, size=size, search=search)

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_in: ReportCreate,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """새로운 운영 일지를 생성합니다."""
    return await report_service.create_report(conn, report_in)

@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 운영 일지의 기본 정보를 조회합니다."""
    return await report_service.get_report(conn, report_id)

@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: int,
    report_in: ReportUpdate,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 운영 일지의 기본 정보를 수정합니다."""
    return await report_service.update_report(conn, report_id, report_in)

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 운영 일지를 삭제합니다 (하위 세부 항목도 CASCADE 삭제)."""
    await report_service.delete_report(conn, report_id)
    return None
