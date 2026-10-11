from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import reports, report_details
import app.models  # 모델 메타데이터 등록을 위한 import

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 애플리케이션 시작 시 DB 테이블 자동 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # 애플리케이션 종료 시 엔진 리소스 해제
    await engine.dispose()

app = FastAPI(
    title="Operation Report System API",
    description="운영 일지 및 무한 Depth 재귀적 항목 관리를 위한 REST API",
    version="1.0.0",
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

# 라우터 등록
app.include_router(reports.router)
app.include_router(report_details.router)

@app.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "operation-report-api"}
