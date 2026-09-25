from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    # AI plan generation. Each user picks a provider (user_profiles.ai_provider)
    # and may add their own key for it (PUT /ai-keys/{provider}), which is
    # preferred; these shared keys are the fallback when they haven't.
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    # Tried in order when the main Gemini model is overloaded / rate-limited /
    # retired. Comma-separated; set empty to disable fallback.
    gemini_fallback_models: str = "gemini-3.7-flash,gemini-3.5-flash-lite"
    # Plan generations per user per day (user's local calendar day) on the shared
    # keys above. Users with their own key aren't limited. 0 disables the shared keys.
    shared_key_daily_plan_limit: int = 5

    storage_dir: str = "storage"
    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    # --- SMTP (email verification + password reset codes) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_address: str = "no-reply@forge.app"
    smtp_use_tls: bool = True

    email_code_expire_minutes: int = 30

    @field_validator("anthropic_api_key", "gemini_api_key", mode="before")
    @classmethod
    def _placeholder_means_unset(cls, value: str | None) -> str | None:
        # .env.example ships "your-anthropic-api-key"; a copied-but-unedited .env must not
        # count as a configured shared key (jobs would queue, then fail on the provider).
        if not value or not value.strip() or value.strip().lower().startswith("your-"):
            return None
        return value.strip()

    @property
    def gemini_model_chain(self) -> list[str]:
        fallbacks = [m.strip() for m in self.gemini_fallback_models.split(",") if m.strip()]
        return list(dict.fromkeys([self.gemini_model, *fallbacks]))  # dedupe, keep order

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
