from datetime import datetime
from uuid import UUID

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Goal = Literal["strength", "hypertrophy", "general_fitness", "endurance"]
MAX_GOALS = 2


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    goals: list[str]
    experience_level: str | None
    equipment_access: list[str] | None
    unit_system: str
    ai_provider: str
    anthropic_api_key_set: bool
    gemini_api_key_set: bool
    include_warmup: bool
    plan_refresh_cadence: str
    gender: str | None
    birth_year: int | None
    height_cm: float | None
    onboarded_at: datetime | None
    has_password: bool
    plan_preferences: dict[str, Any] | None = None


class UserProfileUpdate(BaseModel):
    # Most important first; at most MAX_GOALS.
    goals: list[Goal] | None = Field(default=None, max_length=MAX_GOALS)
    experience_level: str | None = None
    equipment_access: list[str] | None = None
    unit_system: str | None = None
    ai_provider: Literal["anthropic", "gemini"] | None = None
    include_warmup: bool | None = None
    plan_refresh_cadence: str | None = None
    # Stored encrypted, so the database can't enforce these — validated here instead.
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    height_cm: float | None = Field(default=None, ge=50, le=300)

    @field_validator("goals")
    @classmethod
    def _dedupe_goals(cls, value: list[str] | None) -> list[str]:
        # An explicit null clears them; an omitted field (exclude_unset) leaves them alone.
        return [] if value is None else list(dict.fromkeys(value))

    def dump_set_fields(self) -> dict:
        """Only the fields the client actually sent, so a partial update never
        clobbers other columns with None."""
        return self.model_dump(exclude_unset=True)
