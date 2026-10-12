from typing import Optional, List, Dict, Any
import asyncpg
from app.core.utils import record_to_dict, records_to_dicts

class ReportDetailRepository:
    """
    운영 일지 세부 항목(ReportDetail) 및 무한 Depth 계층 트리에 대한 순수 SQL 접근 계층 (No ORM).
    asyncpg parameterized query($1, $2, ...)를 직접 실행합니다.
    """

    async def check_report_exists(self, conn: asyncpg.Connection, report_id: int) -> bool:
        val = await conn.fetchval("SELECT 1 FROM reports WHERE id = $1", report_id)
        return val is not None

    async def get_all_by_report_id(
        self,
        conn: asyncpg.Connection,
        report_id: int
    ) -> List[Dict[str, Any]]:
        query = """
            SELECT id, report_id, parent_id, path, sort_order, depth,
                   title, content, description, image_url, created_at, updated_at
            FROM report_details
            WHERE report_id = $1
            ORDER BY path ASC
        """
        rows = await conn.fetch(query, report_id)
        return records_to_dicts(rows)

    async def get_by_id(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int
    ) -> Optional[Dict[str, Any]]:
        query = """
            SELECT id, report_id, parent_id, path, sort_order, depth,
                   title, content, description, image_url, created_at, updated_at
            FROM report_details
            WHERE id = $1 AND report_id = $2
        """
        row = await conn.fetchrow(query, detail_id, report_id)
        return record_to_dict(row)

    async def get_max_sort_order(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        parent_id: Optional[int]
    ) -> Optional[int]:
        if parent_id is None:
            query = """
                SELECT MAX(sort_order)
                FROM report_details
                WHERE report_id = $1 AND parent_id IS NULL
            """
            return await conn.fetchval(query, report_id)
        else:
            query = """
                SELECT MAX(sort_order)
                FROM report_details
                WHERE report_id = $1 AND parent_id = $2
            """
            return await conn.fetchval(query, report_id, parent_id)

    async def insert(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        parent_id: Optional[int],
        path: str,
        sort_order: int,
        depth: int,
        title: str,
        content: Optional[str],
        description: Optional[str],
        image_url: Optional[str]
    ) -> Dict[str, Any]:
        query = """
            INSERT INTO report_details (
                report_id, parent_id, path, sort_order, depth,
                title, content, description, image_url, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING id, report_id, parent_id, path, sort_order, depth,
                      title, content, description, image_url, created_at, updated_at
        """
        row = await conn.fetchrow(
            query,
            report_id, parent_id, path, sort_order, depth,
            title, content, description, image_url
        )
        return record_to_dict(row)

    async def update(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int,
        update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if not update_data:
            return await self.get_by_id(conn, report_id, detail_id)

        set_clauses = []
        params = [detail_id, report_id]
        idx = 3
        for col, val in update_data.items():
            set_clauses.append(f"{col} = ${idx}")
            params.append(val)
            idx += 1
        set_clauses.append("updated_at = NOW()")

        query = f"""
            UPDATE report_details
            SET {', '.join(set_clauses)}
            WHERE id = $1 AND report_id = $2
            RETURNING id, report_id, parent_id, path, sort_order, depth,
                      title, content, description, image_url, created_at, updated_at
        """
        row = await conn.fetchrow(query, *params)
        return record_to_dict(row)

    async def delete_node_and_descendants(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int,
        target_path: str
    ) -> None:
        query = """
            DELETE FROM report_details
            WHERE report_id = $1 AND (id = $2 OR path = $3 OR path LIKE $4)
        """
        prefix_pattern = f"{target_path}.%"
        await conn.execute(query, report_id, detail_id, target_path, prefix_pattern)

    async def get_siblings(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        parent_id: Optional[int]
    ) -> List[Dict[str, Any]]:
        if parent_id is None:
            query = """
                SELECT id, path, sort_order
                FROM report_details
                WHERE report_id = $1 AND parent_id IS NULL
                ORDER BY sort_order ASC, id ASC
            """
            rows = await conn.fetch(query, report_id)
        else:
            query = """
                SELECT id, path, sort_order
                FROM report_details
                WHERE report_id = $1 AND parent_id = $2
                ORDER BY sort_order ASC, id ASC
            """
            rows = await conn.fetch(query, report_id, parent_id)
        return records_to_dicts(rows)

    async def update_path_and_order(
        self,
        conn: asyncpg.Connection,
        detail_id: int,
        new_path: str,
        new_sort_order: int
    ) -> None:
        query = """
            UPDATE report_details
            SET path = $1, sort_order = $2, updated_at = NOW()
            WHERE id = $3
        """
        await conn.execute(query, new_path, new_sort_order, detail_id)

    async def update_descendant_paths(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        old_prefix: str,
        new_prefix: str,
        old_prefix_len: int
    ) -> None:
        query = """
            UPDATE report_details
            SET path = $1 || SUBSTRING(path FROM $2), updated_at = NOW()
            WHERE report_id = $3 AND path LIKE $4
        """
        like_pattern = f"{old_prefix}%"
        # SUBSTRING FROM start_position (1-indexed, starts immediately after old_prefix)
        start_pos = old_prefix_len + 1
        await conn.execute(query, new_prefix, start_pos, report_id, like_pattern)

    async def update_node_placement(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int,
        new_parent_id: Optional[int],
        new_sort_order: int,
        new_depth: int
    ) -> None:
        query = """
            UPDATE report_details
            SET parent_id = $1, sort_order = $2, depth = $3, updated_at = NOW()
            WHERE id = $4 AND report_id = $5
        """
        await conn.execute(query, new_parent_id, new_sort_order, new_depth, detail_id, report_id)
