from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.core.database import get_db
from app.models.report import Report
from app.models.report_detail import ReportDetail
from app.schemas.report_detail import (
    ReportDetailCreate,
    ReportDetailUpdate,
    ReportDetailResponse,
    ReportDetailNode,
    ReorderRequest
)
from app.services.tree_service import (
    build_tree_structure,
    compute_new_node_position,
    delete_node_and_descendants,
    reindex_siblings_and_descendants
)

router = APIRouter(prefix="/api/reports/{report_id}/details", tags=["Report Details"])

async def ensure_report_exists(report_id: int, db: AsyncSession) -> Report:
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 운영 일지를 찾을 수 없습니다."
        )
    return report

@router.get("/tree", response_model=List[ReportDetailNode])
async def get_details_tree(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """특정 일지의 모든 세부 항목을 무한 Depth 재귀 트리 구조로 반환합니다."""
    await ensure_report_exists(report_id, db)

    query = select(ReportDetail).where(
        ReportDetail.report_id == report_id
    ).order_by(ReportDetail.path.asc())

    result = await db.execute(query)
    details = result.scalars().all()

    return build_tree_structure(details)

@router.get("/flat", response_model=List[ReportDetailResponse])
async def get_details_flat(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """특정 일지의 모든 세부 항목을 path 순서의 flat 리스트로 반환합니다."""
    await ensure_report_exists(report_id, db)

    query = select(ReportDetail).where(
        ReportDetail.report_id == report_id
    ).order_by(ReportDetail.path.asc())

    result = await db.execute(query)
    details = result.scalars().all()

    return [ReportDetailResponse.model_validate(item) for item in details]

@router.post("", response_model=ReportDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_detail(
    report_id: int,
    detail_in: ReportDetailCreate,
    db: AsyncSession = Depends(get_db)
):
    """신규 세부 항목을 생성합니다. parent_id를 지정하면 해당 항목 아래의 path(예: 0.1.1)가 자동 부여됩니다."""
    await ensure_report_exists(report_id, db)

    path, sort_order, depth = await compute_new_node_position(
        db=db,
        report_id=report_id,
        parent_id=detail_in.parent_id,
        requested_sort_order=detail_in.sort_order
    )

    new_detail = ReportDetail(
        report_id=report_id,
        parent_id=detail_in.parent_id,
        path=path,
        sort_order=sort_order,
        depth=depth,
        title=detail_in.title,
        content=detail_in.content,
        description=detail_in.description,
        image_url=detail_in.image_url
    )

    db.add(new_detail)
    await db.commit()
    await db.refresh(new_detail)

    return ReportDetailResponse.model_validate(new_detail)

@router.get("/{detail_id}", response_model=ReportDetailResponse)
async def get_detail(
    report_id: int,
    detail_id: int,
    db: AsyncSession = Depends(get_db)
):
    """단일 세부 항목의 내용을 조회합니다."""
    await ensure_report_exists(report_id, db)

    detail = await db.get(ReportDetail, detail_id)
    if not detail or detail.report_id != report_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세부 항목을 찾을 수 없습니다."
        )

    return ReportDetailResponse.model_validate(detail)

@router.put("/{detail_id}", response_model=ReportDetailResponse)
async def update_detail(
    report_id: int,
    detail_id: int,
    detail_in: ReportDetailUpdate,
    db: AsyncSession = Depends(get_db)
):
    """단일 세부 항목(제목, 본문 내용, 요약 등)을 수정합니다."""
    await ensure_report_exists(report_id, db)

    detail = await db.get(ReportDetail, detail_id)
    if not detail or detail.report_id != report_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세부 항목을 찾을 수 없습니다."
        )

    update_data = detail_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(detail, field, value)

    await db.commit()
    await db.refresh(detail)

    return ReportDetailResponse.model_validate(detail)

@router.delete("/{detail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_detail(
    report_id: int,
    detail_id: int,
    db: AsyncSession = Depends(get_db)
):
    """특정 세부 항목과 모든 하위 자손 항목을 일괄 삭제하고, 형제 노드 경로를 재인덱싱합니다."""
    await ensure_report_exists(report_id, db)
    await delete_node_and_descendants(db, report_id, detail_id)
    await db.commit()
    return None

@router.post("/reorder", response_model=List[ReportDetailNode])
async def reorder_detail(
    report_id: int,
    reorder_in: ReorderRequest,
    db: AsyncSession = Depends(get_db)
):
    """노드의 부모를 변경하거나 순서를 변경하고 전체 트리를 갱신하여 반환합니다."""
    await ensure_report_exists(report_id, db)

    target = await db.get(ReportDetail, reorder_in.target_detail_id)
    if not target or target.report_id != report_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="이동할 대상을 찾을 수 없습니다."
        )

    old_parent_id = target.parent_id
    new_parent_id = reorder_in.new_parent_id

    # 부모 변경 또는 정렬 순서 변경
    target.parent_id = new_parent_id
    target.sort_order = reorder_in.new_sort_order

    # 새 부모의 depth 기준 depth 갱신
    if new_parent_id is not None:
        new_parent = await db.get(ReportDetail, new_parent_id)
        if not new_parent:
            raise HTTPException(status_code=404, detail="새로운 부모 노드를 찾을 수 없습니다.")
        target.depth = new_parent.depth + 1
    else:
        target.depth = 0

    await db.flush()

    # 이전 부모 및 새 부모의 형제 노드들 재인덱싱
    await reindex_siblings_and_descendants(db, report_id, old_parent_id)
    if old_parent_id != new_parent_id:
        await reindex_siblings_and_descendants(db, report_id, new_parent_id)

    await db.commit()

    # 갱신된 전체 트리 반환
    query = select(ReportDetail).where(
        ReportDetail.report_id == report_id
    ).order_by(ReportDetail.path.asc())
    result = await db.execute(query)
    details = result.scalars().all()
    return build_tree_structure(details)
