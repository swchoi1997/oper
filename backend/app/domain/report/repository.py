from datetime import date
from typing import Optional, List, Dict, Any
import asyncpg
from app.core.utils import record_to_dict, records_to_dicts

class ReportRepository:
    """
    운영 일지(Report)에 대한 순수 SQL 기반 데이터 접근 계층 (No ORM).
    asyncpg parameterized query($1, $2, ...)를 직접 실행합니다.
    """

    async def count_reports(
        self,
        conn: asyncpg.Connection,
        search: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        conditions: List[str] = []
        params: List[Any] = []

        if search:
            params.append(f"%{search}%")
            conditions.append(f"(title ILIKE ${len(params)} OR author ILIKE ${len(params)})")
        if start_date:
            params.append(start_date)
            conditions.append(f"report_date >= ${len(params)}")
        if end_date:
            params.append(end_date)
            conditions.append(f"report_date <= ${len(params)}")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT count(*)::int FROM reports {where_clause}"
        val = await conn.fetchval(query, *params)
        return val or 0

    async def list_reports(
        self,
        conn: asyncpg.Connection,
        offset: int,
        limit: int,
        search: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        conditions: List[str] = []
        params: List[Any] = []

        if search:
            params.append(f"%{search}%")
            conditions.append(f"(r.title ILIKE ${len(params)} OR r.author ILIKE ${len(params)})")
        if start_date:
            params.append(start_date)
            conditions.append(f"r.report_date >= ${len(params)}")
        if end_date:
            params.append(end_date)
            conditions.append(f"r.report_date <= ${len(params)}")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        limit_idx = len(params) + 1
        offset_idx = len(params) + 2

        query = f"""
            SELECT r.id, r.title, r.report_date, r.author, r.status, r.created_at, r.updated_at,
                   COUNT(d.id)::int AS details_count
            FROM reports r
            LEFT JOIN report_details d ON d.report_id = r.id
            {where_clause}
            GROUP BY r.id
            ORDER BY r.report_date DESC, r.id DESC
            LIMIT ${limit_idx} OFFSET ${offset_idx}
        """
        rows = await conn.fetch(query, *params, limit, offset)
        return records_to_dicts(rows)

    async def get_by_id(self, conn: asyncpg.Connection, report_id: int) -> Optional[Dict[str, Any]]:
        query = """
            SELECT r.id, r.title, r.report_date, r.author, r.status, r.created_at, r.updated_at,
                   COUNT(d.id)::int AS details_count
            FROM reports r
            LEFT JOIN report_details d ON d.report_id = r.id
            WHERE r.id = $1
            GROUP BY r.id
        """
        row = await conn.fetchrow(query, report_id)
        return record_to_dict(row)

    async def exists(self, conn: asyncpg.Connection, report_id: int) -> bool:
        val = await conn.fetchval("SELECT 1 FROM reports WHERE id = $1", report_id)
        return val is not None

    async def create(
        self,
        conn: asyncpg.Connection,
        title: str,
        report_date: date,
        author: Optional[str],
        status: str
    ) -> Dict[str, Any]:
        query = """
            INSERT INTO reports (title, report_date, author, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, title, report_date, author, status, created_at, updated_at
        """
        row = await conn.fetchrow(query, title, report_date, author, status)
        result = record_to_dict(row)
        result["details_count"] = 0
        return result

    async def update(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if not update_data:
            return await self.get_by_id(conn, report_id)

        set_clauses = []
        params = [report_id]
        idx = 2
        for col, val in update_data.items():
            set_clauses.append(f"{col} = ${idx}")
            params.append(val)
            idx += 1
        set_clauses.append("updated_at = NOW()")

        query = f"""
            UPDATE reports
            SET {', '.join(set_clauses)}
            WHERE id = $1
            RETURNING id, title, report_date, author, status, created_at, updated_at
        """
        row = await conn.fetchrow(query, *params)
        if not row:
            return None

        # details_count 계산
        count = await conn.fetchval(
            "SELECT count(*)::int FROM report_details WHERE report_id = $1", report_id
        )
        res = record_to_dict(row)
        res["details_count"] = count or 0
        return res

    async def delete(self, conn: asyncpg.Connection, report_id: int) -> bool:
        val = await conn.fetchval(
            "DELETE FROM reports WHERE id = $1 RETURNING id", report_id
        )
        return val is not None
