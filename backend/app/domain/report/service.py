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
        search: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> ReportListResponse:
        offset = (page - 1) * size
        total = await self.repo.count_reports(
            conn, search=search, start_date=start_date, end_date=end_date
        )
        rows = await self.repo.list_reports(
            conn, offset=offset, limit=size, search=search, start_date=start_date, end_date=end_date
        )
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
        report_id = created["id"]

        if report_in.with_sample:
            await self._create_sample_details(conn, report_id)

        # 세부 항목 수(details_count)가 포함된 최신 레코드를 반환합니다.
        row = await self.repo.get_by_id(conn, report_id)
        return ReportResponse(**row)

    async def _create_sample_details(self, conn: asyncpg.Connection, report_id: int) -> None:
        """기본 샘플 운영 점검 항목(서버 리소스, 네트워크/보안 등 계층 트리)을 순수 SQL로 생성합니다."""
        # 1. Root 1: 서버 리소스 점검
        root1 = await conn.fetchrow("""
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, description, content, created_at, updated_at
            )
            VALUES ($1, NULL, '0', 0, 0, $2, $3, $4, NOW(), NOW())
            RETURNING id
        """, report_id, "1. 서버 리소스 점검", "CPU 및 메모리 사용률 요약", "전체 서버 호스트 CPU 사용률 40% 미만으로 정상")
        root1_id = root1["id"]

        # 1-1. 웹 서버 클러스터
        await conn.execute("""
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, description, content, created_at, updated_at
            )
            VALUES ($1, $2, '0.0', 0, 1, $3, $4, $5, NOW(), NOW())
        """, report_id, root1_id, "1-1. 웹 서버 클러스터", "Nginx & App pods", "인스턴스 4대 모두 정상 동작")

        # 1-2. DB 클러스터
        await conn.execute("""
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, description, content, created_at, updated_at
            )
            VALUES ($1, $2, '0.1', 1, 1, $3, $4, $5, NOW(), NOW())
        """, report_id, root1_id, "1-2. DB 클러스터", "Connection pool optimized", "슬레이브 복제 지연 0초 정상 동기화")

        # 2. Root 2: 네트워크 및 인프라 보안
        root2 = await conn.fetchrow("""
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, description, content, created_at, updated_at
            )
            VALUES ($1, NULL, '1', 1, 0, $2, $3, $4, NOW(), NOW())
            RETURNING id
        """, report_id, "2. 네트워크 및 인프라 보안", "인바운드 트래픽 및 SSL/TLS 인증서 점검", "외부 비정상 패킷 차단 및 방화벽 룰 이상 없음")
        root2_id = root2["id"]

        # 2-1. SSL / TLS 인증서 점검
        await conn.execute("""
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, description, content, created_at, updated_at
            )
            VALUES ($1, $2, '1.0', 0, 1, $3, $4, $5, NOW(), NOW())
        """, report_id, root2_id, "2-1. SSL / TLS 인증서 점검", "와일드카드 인증서 만료일 60일 이상 잔여", "HTTPS 암호화 통신 정상 및 자동 갱신 데몬 정상 가동 중")

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
