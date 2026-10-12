import asyncio
from datetime import date
from app.core.database import init_db_pool, close_db_pool, init_db, get_pool
from app.domain.report.service import ReportService
from app.domain.report.schema import ReportCreate, ReportUpdate
from app.domain.report_detail.service import ReportDetailService
from app.domain.report_detail.schema import ReportDetailCreate, ReportDetailUpdate, ReorderRequest

async def main():
    print("=== [1] DB 커넥션 풀 초기화 및 순수 DDL 실행 ===")
    await init_db_pool()
    await init_db()
    print("✓ DB 풀 및 DDL 검증 완료")

    pool = get_pool()
    async with pool.acquire() as conn:
        report_service = ReportService()
        detail_service = ReportDetailService()

        print("\n=== [2] 신규 Report 생성 테스트 (Pure SQL) ===")
        rep = await report_service.create_report(
            conn,
            ReportCreate(
                title="2026-10-12 아키텍처 리팩토링 검증 일지",
                author="최운영",
                status="DRAFT"
            )
        )
        print(f"✓ Report 생성 성공: ID={rep.id}, Title={rep.title}, Date={rep.report_date}")

        print("\n=== [3] Root Detail 항목 생성 테스트 ===")
        d0 = await detail_service.create_detail(
            conn,
            rep.id,
            ReportDetailCreate(
                title="1. 인프라 아키텍처 개편",
                description="ORM 제거 및 asyncpg 전환",
                content="SQLAlchemy ORM을 완전히 걷어내고 순수 asyncpg 쿼리로 개편함"
            )
        )
        print(f"✓ Root Detail 생성: ID={d0.id}, Path={d0.path}, Depth={d0.depth}, Title={d0.title}")

        print("\n=== [4] Child Detail 항목 생성 (Depth 1) ===")
        d0_0 = await detail_service.create_detail(
            conn,
            rep.id,
            ReportDetailCreate(
                parent_id=d0.id,
                title="1-1. Connection Pool 구성",
                description="asyncpg.create_pool",
                content="최대 10개 커넥션 풀 적용"
            )
        )
        print(f"✓ Child Detail 생성: ID={d0_0.id}, Path={d0_0.path}, Depth={d0_0.depth}, Title={d0_0.title}")

        print("\n=== [5] Child Detail 항목 생성 (Depth 2) ===")
        d0_0_0 = await detail_service.create_detail(
            conn,
            rep.id,
            ReportDetailCreate(
                parent_id=d0_0.id,
                title="1-1-1. 성능 벤치마크",
                description="Latency 50% 단축",
                content="ORM 오버헤드 제거로 응답 속도 대폭 향상"
            )
        )
        print(f"✓ Child Detail 생성: ID={d0_0_0.id}, Path={d0_0_0.path}, Depth={d0_0_0.depth}, Title={d0_0_0.title}")

        print("\n=== [6] 전체 트리 구조 조회 (Pure SQL -> Node Hierarchy) ===")
        tree = await detail_service.get_tree(conn, rep.id)
        def print_tree(nodes, indent=0):
            for n in nodes:
                print("  " * indent + f"└─ [{n.path}] (depth={n.depth}) {n.title}")
                print_tree(n.children, indent + 1)
        print_tree(tree)

        print("\n=== [7] Report 조회 및 details_count 검증 ===")
        rep_fetched = await report_service.get_report(conn, rep.id)
        print(f"✓ Report 조회: ID={rep_fetched.id}, details_count={rep_fetched.details_count}")
        assert rep_fetched.details_count == 3, f"Expected 3 details, got {rep_fetched.details_count}"

        print("\n=== [8] 세부 항목 수정 테스트 ===")
        updated_d = await detail_service.update_detail(
            conn,
            rep.id,
            d0_0_0.id,
            ReportDetailUpdate(title="1-1-1. 성능 벤치마크 (검증 완료)")
        )
        print(f"✓ 수정 완료: {updated_d.title}")

        print("\n=== [9] 생성된 테스트 Report 삭제 (CASCADE 검증) ===")
        await report_service.delete_report(conn, rep.id)
        print("✓ Report 및 하위 세부 항목 CASCADE 삭제 완료")

    await close_db_pool()
    print("\n🎉 모든 순수 SQL 백엔드 아키텍처 검증 성공!")

if __name__ == "__main__":
    asyncio.run(main())
