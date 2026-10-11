from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.models.report import Report
from app.models.report_detail import ReportDetail
from app.schemas.report import ReportCreate, ReportUpdate, ReportResponse, ReportListResponse

router = APIRouter(prefix="/api/reports", tags=["Reports"])

@router.get("", response_model=ReportListResponse)
async def list_reports(
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(10, ge=1, le=100, description="페이지 크기"),
    search: Optional[str] = Query(None, description="제목 또는 작성자 검색"),
    db: AsyncSession = Depends(get_db)
):
    """운영 일지 목록을 페이징 및 검색 조건으로 조회합니다."""
    query = select(Report)
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Report.title.ilike(search_filter)) | (Report.author.ilike(search_filter))
        )

    # 전체 카운트
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 페이징 및 정렬
    query = query.order_by(desc(Report.report_date), desc(Report.id))
    query = query.offset((page - 1) * size).limit(size)
    result = await db.execute(query)
    reports = result.scalars().all()

    # 각 리포트의 detail 카운트 함께 조회
    report_responses = []
    for r in reports:
        count_stmt = select(func.count(ReportDetail.id)).where(ReportDetail.report_id == r.id)
        c_res = await db.execute(count_stmt)
        count = c_res.scalar_one()

        resp = ReportResponse(
            id=r.id,
            title=r.title,
            report_date=r.report_date,
            author=r.author,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at,
            details_count=count
        )
        report_responses.append(resp)

    return ReportListResponse(items=report_responses, total=total)

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db)
):
    """새로운 운영 일지를 생성합니다."""
    report_data = report_in.model_dump()
    if report_data.get("report_date") is None:
        from datetime import date
        report_data["report_date"] = date.today()

    new_report = Report(**report_data)
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)

    return ReportResponse(
        id=new_report.id,
        title=new_report.title,
        report_date=new_report.report_date,
        author=new_report.author,
        status=new_report.status,
        created_at=new_report.created_at,
        updated_at=new_report.updated_at,
        details_count=0
    )

@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """특정 운영 일지의 기본 정보를 조회합니다."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="운영 일지를 찾을 수 없습니다."
        )

    count_stmt = select(func.count(ReportDetail.id)).where(ReportDetail.report_id == report.id)
    c_res = await db.execute(count_stmt)
    count = c_res.scalar_one()

    return ReportResponse(
        id=report.id,
        title=report.title,
        report_date=report.report_date,
        author=report.author,
        status=report.status,
        created_at=report.created_at,
        updated_at=report.updated_at,
        details_count=count
    )

@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: int,
    report_in: ReportUpdate,
    db: AsyncSession = Depends(get_db)
):
    """특정 운영 일지의 기본 정보를 수정합니다."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="운영 일지를 찾을 수 없습니다."
        )

    update_data = report_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)

    await db.commit()
    await db.refresh(report)

    count_stmt = select(func.count(ReportDetail.id)).where(ReportDetail.report_id == report.id)
    c_res = await db.execute(count_stmt)
    count = c_res.scalar_one()

    return ReportResponse(
        id=report.id,
        title=report.title,
        report_date=report.report_date,
        author=report.author,
        status=report.status,
        created_at=report.created_at,
        updated_at=report.updated_at,
        details_count=count
    )

@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """특정 운영 일지를 삭제합니다 (하위 세부 항목도 CASCADE 삭제)."""
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="운영 일지를 찾을 수 없습니다."
        )

    await db.delete(report)
    await db.commit()
    return None
