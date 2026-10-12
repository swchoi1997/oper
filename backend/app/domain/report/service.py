from datetime import date
from typing import Optional
from fastapi import HTTPException, status
import asyncpg
from app.domain.report.repository import ReportRepository
from app.domain.report.schema import (
    ReportCreate,
    ReportUpdate,
    ReportResponse,
    ReportListResponse
)

class ReportService:
    """
    운영 일지(Report) 비즈니스 로직 서비스 계층.
    """

    def __init__(self, repository: Optional[ReportRepository] = None):
        self.repo = repository or ReportRepository()

    async def list_reports(
        self,
        conn: asyncpg.Connection,
        page: int = 1,
        size: int = 10,
        search: Optional[str] = None
    ) -> ReportListResponse:
        offset = (page - 1) * size
        total = await self.repo.count_reports(conn, search=search)
        rows = await self.repo.list_reports(conn, offset=offset, limit=size, search=search)
        items = [ReportResponse(**row) for row in rows]
        return ReportListResponse(items=items, total=total)

    async def get_report(self, conn: asyncpg.Connection, report_id: int) -> ReportResponse:
        row = await self.repo.get_by_id(conn, report_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="운영 일지를 찾을 수 없습니다."
            )
        return ReportResponse(**row)

    async def ensure_report_exists(self, conn: asyncpg.Connection, report_id: int) -> None:
        exists = await self.repo.exists(conn, report_id)
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 운영 일지를 찾을 수 없습니다."
            )

    async def create_report(
        self,
        conn: asyncpg.Connection,
        report_in: ReportCreate
    ) -> ReportResponse:
        report_date = report_in.report_date or date.today()
        created = await self.repo.create(
            conn=conn,
            title=report_in.title,
            report_date=report_date,
            author=report_in.author,
            status=report_in.status
        )
        return ReportResponse(**created)

    async def update_report(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        report_in: ReportUpdate
    ) -> ReportResponse:
        await self.ensure_report_exists(conn, report_id)
        update_data = report_in.model_dump(exclude_unset=True)
        updated = await self.repo.update(conn, report_id, update_data)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="운영 일지를 찾을 수 없습니다."
            )
        return ReportResponse(**updated)

    async def delete_report(self, conn: asyncpg.Connection, report_id: int) -> None:
        await self.ensure_report_exists(conn, report_id)
        deleted = await self.repo.delete(conn, report_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="운영 일지를 찾을 수 없습니다."
            )
