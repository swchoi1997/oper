from typing import List, Dict, Optional, Tuple, Any
from fastapi import HTTPException, status
import asyncpg
from app.domain.report_detail.repository import ReportDetailRepository
from app.domain.report_detail.schema import (
    ReportDetailCreate,
    ReportDetailUpdate,
    ReportDetailResponse,
    ReportDetailNode,
    ReorderRequest
)

class ReportDetailService:
    """
    운영 일지 세부 항목(ReportDetail) 비즈니스 로직 및 트리 알고리즘 서비스 계층.
    """

    def __init__(self, repository: Optional[ReportDetailRepository] = None):
        self.repo = repository or ReportDetailRepository()

    async def ensure_report_exists(self, conn: asyncpg.Connection, report_id: int) -> None:
        exists = await self.repo.check_report_exists(conn, report_id)
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 운영 일지를 찾을 수 없습니다."
            )

    def build_tree_structure(self, details: List[Dict[str, Any]]) -> List[ReportDetailNode]:
        """
        Flat한 ReportDetail row 딕셔너리 목록을 받아 계층형 트리 구조(ReportDetailNode)로 조립합니다.
        """
        node_map: Dict[int, ReportDetailNode] = {}
        root_nodes: List[ReportDetailNode] = []

        # 1. 모든 row를 Pydantic Node로 변환하여 map에 저장
        for item in details:
            resp = ReportDetailResponse(**item)
            node = ReportDetailNode(
                **resp.model_dump(),
                children=[]
            )
            node_map[item["id"]] = node

        # 2. parent_id를 기반으로 트리 관계 구성
        for item in details:
            node = node_map[item["id"]]
            parent_id = item.get("parent_id")
            if parent_id is not None and parent_id in node_map:
                parent_node = node_map[parent_id]
                parent_node.children.append(node)
            else:
                root_nodes.append(node)

        # 3. 각 레벨에서 sort_order 순 정렬
        def sort_children(n: ReportDetailNode):
            n.children.sort(key=lambda x: x.sort_order)
            for child in n.children:
                sort_children(child)

        root_nodes.sort(key=lambda x: x.sort_order)
        for root in root_nodes:
            sort_children(root)

        return root_nodes

    async def get_tree(
        self,
        conn: asyncpg.Connection,
        report_id: int
    ) -> List[ReportDetailNode]:
        await self.ensure_report_exists(conn, report_id)
        rows = await self.repo.get_all_by_report_id(conn, report_id)
        return self.build_tree_structure(rows)

    async def get_flat(
        self,
        conn: asyncpg.Connection,
        report_id: int
    ) -> List[ReportDetailResponse]:
        await self.ensure_report_exists(conn, report_id)
        rows = await self.repo.get_all_by_report_id(conn, report_id)
        return [ReportDetailResponse(**row) for row in rows]

    async def compute_new_node_position(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        parent_id: Optional[int],
        requested_sort_order: Optional[int] = None
    ) -> Tuple[str, int, int]:
        """
        신규 노드 생성 시 필요한 (path, sort_order, depth)를 계산합니다.
        """
        if parent_id is None:
            depth = 0
            max_order = await self.repo.get_max_sort_order(conn, report_id, None)
            if requested_sort_order is not None:
                sort_order = requested_sort_order
            else:
                sort_order = 0 if max_order is None else (max_order + 1)
            path = str(sort_order)
            return path, sort_order, depth
        else:
            parent = await self.repo.get_by_id(conn, report_id, parent_id)
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="지정한 부모 항목을 찾을 수 없거나 해당 일지에 속하지 않습니다."
                )

            depth = parent["depth"] + 1
            max_order = await self.repo.get_max_sort_order(conn, report_id, parent_id)
            if requested_sort_order is not None:
                sort_order = requested_sort_order
            else:
                sort_order = 0 if max_order is None else (max_order + 1)

            path = f"{parent['path']}.{sort_order}"
            return path, sort_order, depth

    async def create_detail(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_in: ReportDetailCreate
    ) -> ReportDetailResponse:
        await self.ensure_report_exists(conn, report_id)

        path, sort_order, depth = await self.compute_new_node_position(
            conn=conn,
            report_id=report_id,
            parent_id=detail_in.parent_id,
            requested_sort_order=detail_in.sort_order
        )

        row = await self.repo.insert(
            conn=conn,
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
        return ReportDetailResponse(**row)

    async def get_detail(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int
    ) -> ReportDetailResponse:
        await self.ensure_report_exists(conn, report_id)
        row = await self.repo.get_by_id(conn, report_id, detail_id)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="세부 항목을 찾을 수 없습니다."
            )
        return ReportDetailResponse(**row)

    async def update_detail(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int,
        detail_in: ReportDetailUpdate
    ) -> ReportDetailResponse:
        await self.ensure_report_exists(conn, report_id)
        update_data = detail_in.model_dump(exclude_unset=True)
        row = await self.repo.update(conn, report_id, detail_id, update_data)
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="세부 항목을 찾을 수 없습니다."
            )
        return ReportDetailResponse(**row)

    async def delete_detail(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        detail_id: int
    ) -> None:
        await self.ensure_report_exists(conn, report_id)
        target = await self.repo.get_by_id(conn, report_id, detail_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="삭제할 항목을 찾을 수 없습니다."
            )

        async with conn.transaction():
            # 1. 대상 노드 및 하위 자손 일괄 삭제
            await self.repo.delete_node_and_descendants(
                conn, report_id, detail_id, target["path"]
            )
            # 2. 형제 노드들 재인덱싱
            await self.reindex_siblings_and_descendants(
                conn, report_id, target["parent_id"]
            )

    async def reindex_siblings_and_descendants(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        parent_id: Optional[int]
    ) -> None:
        """
        특정 부모 아래의 형제 노드들을 순서대로 0부터 재할당하고, 하위 자손들의 path도 일괄 갱신합니다.
        """
        if parent_id is None:
            parent_path = ""
        else:
            parent = await self.repo.get_by_id(conn, report_id, parent_id)
            if not parent:
                return
            parent_path = parent["path"]

        siblings = await self.repo.get_siblings(conn, report_id, parent_id)

        for idx, sibling in enumerate(siblings):
            old_path = sibling["path"]
            new_path = f"{parent_path}.{idx}" if parent_path else str(idx)

            if old_path != new_path or sibling["sort_order"] != idx:
                await self.repo.update_path_and_order(conn, sibling["id"], new_path, idx)

            if old_path != new_path:
                old_prefix = f"{old_path}."
                new_prefix = f"{new_path}."
                await self.repo.update_descendant_paths(
                    conn,
                    report_id=report_id,
                    old_prefix=old_prefix,
                    new_prefix=new_prefix,
                    old_prefix_len=len(old_prefix)
                )

    async def reorder_detail(
        self,
        conn: asyncpg.Connection,
        report_id: int,
        reorder_in: ReorderRequest
    ) -> List[ReportDetailNode]:
        await self.ensure_report_exists(conn, report_id)

        target = await self.repo.get_by_id(conn, report_id, reorder_in.target_detail_id)
        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="이동할 대상을 찾을 수 없습니다."
            )

        old_parent_id = target["parent_id"]
        new_parent_id = reorder_in.new_parent_id

        if new_parent_id is not None:
            new_parent = await self.repo.get_by_id(conn, report_id, new_parent_id)
            if not new_parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="새로운 부모 노드를 찾을 수 없습니다."
                )
            new_depth = new_parent["depth"] + 1
        else:
            new_depth = 0

        async with conn.transaction():
            await self.repo.update_node_placement(
                conn=conn,
                report_id=report_id,
                detail_id=reorder_in.target_detail_id,
                new_parent_id=new_parent_id,
                new_sort_order=reorder_in.new_sort_order,
                new_depth=new_depth
            )

            # 이전 부모 및 새 부모의 형제 노드들 재인덱싱
            await self.reindex_siblings_and_descendants(conn, report_id, old_parent_id)
            if old_parent_id != new_parent_id:
                await self.reindex_siblings_and_descendants(conn, report_id, new_parent_id)

        # 갱신된 전체 트리 반환
        return await self.get_tree(conn, report_id)
