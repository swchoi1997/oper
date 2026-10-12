from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db_pool, close_db_pool, init_db
from app.domain.report.controller import router as report_router
from app.domain.report_detail.controller import router as detail_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. asyncpg 커넥션 풀 초기화
    await init_db_pool()
    # 2. 순수 DDL 쿼리로 테이블 및 인덱스 초기화/검증
    await init_db()
    yield
    # 3. 종료 시 커넥션 풀 반환
    await close_db_pool()

app = FastAPI(
    title="Operation Report System API",
    description="운영 일지 및 무한 Depth 재귀적 항목 관리를 위한 REST API (Layered Architecture & Pure SQL)",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 도메인 라우터 등록
app.include_router(report_router)
app.include_router(detail_router)

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "operation-report-api", "architecture": "pure-sql-domain-driven"}
