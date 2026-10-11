from typing import List, Dict, Optional
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.report_detail import ReportDetail
from app.schemas.report_detail import ReportDetailNode, ReportDetailResponse

def build_tree_structure(details: List[ReportDetail]) -> List[ReportDetailNode]:
    """
    Flat한 ReportDetail 객체 목록을 받아 계층형 트리 구조(ReportDetailNode)로 조립합니다.
    """
    node_map: Dict[int, ReportDetailNode] = {}
    root_nodes: List[ReportDetailNode] = []

    # 1. 모든 노드를 Pydantic Node로 변환하여 맵에 저장
    for item in details:
        resp = ReportDetailResponse.model_validate(item)
        node = ReportDetailNode(
            **resp.model_dump(),
            children=[]
        )
        node_map[item.id] = node

    # 2. parent_id를 기반으로 트리 관계 구성
    for item in details:
        node = node_map[item.id]
        if item.parent_id is not None and item.parent_id in node_map:
            parent_node = node_map[item.parent_id]
            parent_node.children.append(node)
        else:
            root_nodes.append(node)

    # 3. 각 레벨에서 sort_order 순으로 정렬
    def sort_children(n: ReportDetailNode):
        n.children.sort(key=lambda x: x.sort_order)
        for child in n.children:
            sort_children(child)

    root_nodes.sort(key=lambda x: x.sort_order)
    for root in root_nodes:
        sort_children(root)

    return root_nodes

async def compute_new_node_position(
    db: AsyncSession,
    report_id: int,
    parent_id: Optional[int],
    requested_sort_order: Optional[int] = None
) -> tuple[str, int, int]:
    """
    신규 노드 생성 시 필요한 (path, sort_order, depth)를 계산합니다.
    Path 형식: "0", "0.1", "0.1.1" (0-indexed 계층)
    """
    if parent_id is None:
        # 최상위(루트) 노드
        depth = 0
        query = select(ReportDetail).where(
            and_(
                ReportDetail.report_id == report_id,
                ReportDetail.parent_id.is_(None)
            )
        ).order_by(ReportDetail.sort_order.desc())
        result = await db.execute(query)
        existing_roots = result.scalars().all()

        if requested_sort_order is not None:
            sort_order = requested_sort_order
        else:
            sort_order = (existing_roots[0].sort_order + 1) if existing_roots else 0

        path = str(sort_order)
        return path, sort_order, depth
    else:
        # 자식 노드
        parent = await db.get(ReportDetail, parent_id)
        if not parent or parent.report_id != report_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="지정한 부모 항목을 찾을 수 없거나 해당 일지에 속하지 않습니다."
            )

        depth = parent.depth + 1
        query = select(ReportDetail).where(
            and_(
                ReportDetail.report_id == report_id,
                ReportDetail.parent_id == parent_id
            )
        ).order_by(ReportDetail.sort_order.desc())
        result = await db.execute(query)
        existing_siblings = result.scalars().all()

        if requested_sort_order is not None:
            sort_order = requested_sort_order
        else:
            sort_order = (existing_siblings[0].sort_order + 1) if existing_siblings else 0

        path = f"{parent.path}.{sort_order}"
        return path, sort_order, depth

async def delete_node_and_descendants(
    db: AsyncSession,
    report_id: int,
    detail_id: int
) -> None:
    """
    특정 노드 및 해당 노드의 모든 하위(자손) 노드를 일괄 삭제합니다.
    """
    target = await db.get(ReportDetail, detail_id)
    if not target or target.report_id != report_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="삭제할 항목을 찾을 수 없습니다."
        )

    prefix = f"{target.path}."
    target_path = target.path
    parent_id = target.parent_id
    deleted_sort_order = target.sort_order

    # 1. 대상 노드 및 하위 path를 가진 모든 자손 노드 삭제
    delete_stmt = delete(ReportDetail).where(
        and_(
            ReportDetail.report_id == report_id,
            (ReportDetail.id == detail_id) | 
            (ReportDetail.path == target_path) | 
            (ReportDetail.path.startswith(prefix))
        )
    )
    await db.execute(delete_stmt)
    await db.flush()

    # 2. 형제 노드들의 순번과 path 재정렬 (deleted_sort_order보다 큰 노드들 -1 처리)
    await reindex_siblings_and_descendants(db, report_id, parent_id)

async def reindex_siblings_and_descendants(
    db: AsyncSession,
    report_id: int,
    parent_id: Optional[int]
) -> None:
    """
    특정 부모 아래의 형제 노드들을 순서대로 0부터 재할당하고, 하위 자손들의 path도 일괄 갱신합니다.
    """
    # 1. 해당 형제 노드 목록 조회
    if parent_id is None:
        query = select(ReportDetail).where(
            and_(
                ReportDetail.report_id == report_id,
                ReportDetail.parent_id.is_(None)
            )
        ).order_by(ReportDetail.sort_order.asc(), ReportDetail.id.asc())
        parent_path = ""
    else:
        parent = await db.get(ReportDetail, parent_id)
        if not parent:
            return
        parent_path = parent.path
        query = select(ReportDetail).where(
            and_(
                ReportDetail.report_id == report_id,
                ReportDetail.parent_id == parent_id
            )
        ).order_by(ReportDetail.sort_order.asc(), ReportDetail.id.asc())

    result = await db.execute(query)
    siblings = result.scalars().all()

    for idx, sibling in enumerate(siblings):
        old_path = sibling.path
        new_path = f"{parent_path}.{idx}" if parent_path else str(idx)

        sibling.sort_order = idx
        sibling.path = new_path

        # 하위 자손들의 path prefix 갱신
        if old_path != new_path:
            old_prefix = f"{old_path}."
            desc_query = select(ReportDetail).where(
                and_(
                    ReportDetail.report_id == report_id,
                    ReportDetail.path.startswith(old_prefix)
                )
            )
            desc_res = await db.execute(desc_query)
            descendants = desc_res.scalars().all()
            for desc in descendants:
                desc.path = f"{new_path}." + desc.path[len(old_prefix):]
