from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # Shared fallback Anthropic key. Individual users can override this with
    # their own key (see app/services/anthropic_key.py) — that one is
    # preferred whenever it's set.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"

    storage_dir: str = "storage"
    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
