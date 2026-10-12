from typing import Any, Dict, List, Optional
import asyncpg

def record_to_dict(record: Optional[asyncpg.Record]) -> Optional[Dict[str, Any]]:
    """asyncpg Record 객체를 딕셔너리로 변환합니다."""
    if record is None:
        return None
    return dict(record)

def records_to_dicts(records: List[asyncpg.Record]) -> List[Dict[str, Any]]:
    """asyncpg Record 리스트를 딕셔너리 리스트로 변환합니다."""
    return [dict(r) for r in records]
