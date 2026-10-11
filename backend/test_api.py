import asyncio
from app.core.database import engine, Base, AsyncSessionLocal
import app.models
from app.models.report import Report
from app.models.report_detail import ReportDetail
from app.services.tree_service import (
    compute_new_node_position,
    build_tree_structure,
    delete_node_and_descendants
)
from sqlalchemy import select

async def main():
    print("[1] DB 테이블 생성 중...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("테이블 생성 완료!")

    async with AsyncSessionLocal() as db:
        print("[2] 테스트 Report 생성 중...")
        report = Report(title="2026-10-12 주간 인프라 정기 점검 일지", author="최운영", status="DRAFT")
        db.add(report)
        await db.commit()
        await db.refresh(report)
        print(f"Report 생성됨: ID={report.id}, Title={report.title}")

        print("[3] 루트 Detail 0 생성...")
        path0, order0, depth0 = await compute_new_node_position(db, report.id, None)
        d0 = ReportDetail(report_id=report.id, parent_id=None, path=path0, sort_order=order0, depth=depth0, title="1. 서버 리소스 점검", description="CPU 및 메모리 사용률 요약", content="전체 서버 CPU 사용률 40% 미만으로 정상")
        db.add(d0)
        await db.commit()
        await db.refresh(d0)
        print(f"Detail 생성됨: ID={d0.id}, Path={d0.path}, Depth={d0.depth}")

        print("[4] d0의 자식 Detail 생성 (0.0)...")
        path0_0, order0_0, depth0_0 = await compute_new_node_position(db, report.id, d0.id)
        d0_0 = ReportDetail(report_id=report.id, parent_id=d0.id, path=path0_0, sort_order=order0_0, depth=depth0_0, title="1-1. 웹 서버 클러스터", description="Nginx & App pods", content="인스턴스 4대 모두 정상 동작")
        db.add(d0_0)
        await db.commit()
        await db.refresh(d0_0)
        print(f"Detail 생성됨: ID={d0_0.id}, Path={d0_0.path}, Depth={d0_0.depth}")

        print("[5] d0의 두번째 자식 Detail 생성 (0.1)...")
        path0_1, order0_1, depth0_1 = await compute_new_node_position(db, report.id, d0.id)
        d0_1 = ReportDetail(report_id=report.id, parent_id=d0.id, path=path0_1, sort_order=order0_1, depth=depth0_1, title="1-2. DB 클러스터", description="PostgreSQL Master-Replica", content="슬레이브 복제 지연 0초")
        db.add(d0_1)
        await db.commit()
        await db.refresh(d0_1)
        print(f"Detail 생성됨: ID={d0_1.id}, Path={d0_1.path}, Depth={d0_1.depth}")

        print("[6] d0_1의 자식 Detail 생성 (0.1.0)...")
        path0_1_0, order0_1_0, depth0_1_0 = await compute_new_node_position(db, report.id, d0_1.id)
        d0_1_0 = ReportDetail(report_id=report.id, parent_id=d0_1.id, path=path0_1_0, sort_order=order0_1_0, depth=depth0_1_0, title="1-2-1. 커넥션 풀 상태", description="PgBouncer 모니터링", content="활성 커넥션 24/100")
        db.add(d0_1_0)
        await db.commit()
        await db.refresh(d0_1_0)
        print(f"Detail 생성됨: ID={d0_1_0.id}, Path={d0_1_0.path}, Depth={d0_1_0.depth}")

        print("[7] 전체 트리 구조 조회 검증...")
        query = select(ReportDetail).where(ReportDetail.report_id == report.id).order_by(ReportDetail.path.asc())
        res = await db.execute(query)
        all_details = res.scalars().all()
        tree = build_tree_structure(all_details)

        def print_tree(nodes, indent=0):
            for n in nodes:
                print("  " * indent + f"└─ [{n.path}] (depth={n.depth}) {n.title}")
                print_tree(n.children, indent + 1)

        print_tree(tree)

    await engine.dispose()
    print("검증 완료!")

if __name__ == "__main__":
    asyncio.run(main())
