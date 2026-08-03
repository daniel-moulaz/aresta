import os
from dataclasses import dataclass


def _split_csv(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Aresta API")
    environment: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./aresta.db")
    cors_origins: tuple[str, ...] = _split_csv(
        os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:4173")
    )


settings = Settings()
