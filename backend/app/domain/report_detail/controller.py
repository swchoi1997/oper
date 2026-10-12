from typing import List
from fastapi import APIRouter, Depends, status
import asyncpg
from app.core.database import get_db_connection
from app.domain.report_detail.service import ReportDetailService
from app.domain.report_detail.schema import (
    ReportDetailCreate,
    ReportDetailUpdate,
    ReportDetailResponse,
    ReportDetailNode,
    ReorderRequest
)

router = APIRouter(prefix="/api/reports/{report_id}/details", tags=["Report Details"])
detail_service = ReportDetailService()

@router.get("/tree", response_model=List[ReportDetailNode])
async def get_details_tree(
    report_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 일지의 모든 세부 항목을 무한 Depth 재귀 트리 구조로 반환합니다."""
    return await detail_service.get_tree(conn, report_id)

@router.get("/flat", response_model=List[ReportDetailResponse])
async def get_details_flat(
    report_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 일지의 모든 세부 항목을 path 순서의 flat 리스트로 반환합니다."""
    return await detail_service.get_flat(conn, report_id)

@router.post("", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_detail(
    report_id: int,
    detail_in: ReportDetailCreate,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """신규 세부 항목을 생성합니다. parent_id를 지정하면 해당 항목 아래의 path(예: 0.1.1)가 자동 부여됩니다."""
    return await detail_service.create_detail(conn, report_id, detail_in)

@router.get("/{detail_id}", response_model=ReportDetailResponse)
async def get_detail(
    report_id: int,
    detail_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """단일 세부 항목의 내용을 조회합니다."""
    return await detail_service.get_detail(conn, report_id, detail_id)

@router.put("/{detail_id}", response_model=ReportDetailResponse)
async def update_detail(
    report_id: int,
    detail_id: int,
    detail_in: ReportDetailUpdate,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """단일 세부 항목(제목, 본문 내용, 요약 등)을 수정합니다."""
    return await detail_service.update_detail(conn, report_id, detail_id, detail_in)

@router.delete("/{detail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_detail(
    report_id: int,
    detail_id: int,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """특정 세부 항목과 모든 하위 자손 항목을 일괄 삭제하고, 형제 노드 경로를 재인덱싱합니다."""
    await detail_service.delete_detail(conn, report_id, detail_id)
    return None

@router.post("/reorder", response_model=List[ReportDetailNode])
async def reorder_detail(
    report_id: int,
    reorder_in: ReorderRequest,
    conn: asyncpg.Connection = Depends(get_db_connection)
):
    """노드의 부모를 변경하거나 순서를 변경하고 전체 트리를 갱신하여 반환합니다."""
    return await detail_service.reorder_detail(conn, report_id, reorder_in)
