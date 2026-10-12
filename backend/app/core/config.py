from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/operation_db"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    APP_PORT: int = 8000

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def asyncpg_dsn(self) -> str:
        """asyncpg.create_pool 에 사용할 순수 PostgreSQL DSN 반환"""
        return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

