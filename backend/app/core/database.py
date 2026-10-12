from typing import AsyncGenerator, Optional
import logging
import asyncpg
from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None

async def init_db_pool() -> asyncpg.Pool:
    """애플리케이션 시작 시 asyncpg 커넥션 풀을 초기화합니다."""
    global _pool
    if _pool is None:
        logger.info(f"Connecting to database pool: {settings.asyncpg_dsn.split('@')[-1]}")
        _pool = await asyncpg.create_pool(
            dsn=settings.asyncpg_dsn,
            min_size=2,
            max_size=10
        )
    return _pool

async def close_db_pool() -> None:
    """애플리케이션 종료 시 asyncpg 커넥션 풀을 닫습니다."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed.")

def get_pool() -> asyncpg.Pool:
    """현재 활성화된 커넥션 풀을 반환합니다."""
    if _pool is None:
        raise RuntimeError("Database connection pool is not initialized.")
    return _pool

async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    FastAPI 의존성 주입용 DB 커넥션 제공자 (순수 asyncpg 커넥션).
    요청 완료 후 자동으로 커넥션을 풀로 반환합니다.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn

async def init_db() -> None:
    """
    ORM 없이 순수 DDL 쿼리로 테이블 및 인덱스를 생성합니다.
    """
    pool = get_pool()
    async with pool.acquire() as conn:
        # 1. reports 테이블 생성
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                report_date DATE NOT NULL DEFAULT CURRENT_DATE,
                author VARCHAR(100),
                status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ix_reports_title ON reports (title);
        """)

        # 2. report_details 테이블 생성
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS report_details (
                id SERIAL PRIMARY KEY,
                report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
                parent_id INTEGER REFERENCES report_details(id) ON DELETE CASCADE,
                path VARCHAR(255) NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                description TEXT,
                depth INTEGER NOT NULL DEFAULT 0,
                image_url VARCHAR(500),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ix_report_details_report_id ON report_details (report_id);
            CREATE INDEX IF NOT EXISTS ix_report_details_parent_id ON report_details (parent_id);
            CREATE INDEX IF NOT EXISTS ix_report_details_path ON report_details (path);
        """)
        logger.info("Database tables verified/created via raw DDL.")
