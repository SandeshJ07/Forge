from datetime import datetime
from uuid import UUID

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Goal = Literal["strength", "hypertrophy", "general_fitness", "endurance", "weight_loss"]
MAX_GOALS = 2


class MeasurementTarget(BaseModel):
    """A target value for one measurement type, in the unit it was entered in."""

    value: float = Field(gt=0, le=10_000)
    unit: str = Field(min_length=1, max_length=10)


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
    groq_api_key_set: bool = False
    include_warmup: bool
    plan_refresh_cadence: str
    plan_refresh_days: int | None = None
    gender: str | None
    birth_year: int | None
    height_cm: float | None
    onboarded_at: datetime | None
    has_password: bool
    plan_preferences: dict[str, Any] | None = None
    gym_reminder_time: str | None = None
    gym_reminder_days: list[str] = []
    timezone: str | None = None
    measurement_targets: dict[str, MeasurementTarget] = {}

    @field_validator("measurement_targets", mode="before")
    @classmethod
    def _none_to_empty(cls, value: Any) -> Any:
        return value or {}


Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class UserProfileUpdate(BaseModel):
    # Most important first; at most MAX_GOALS.
    goals: list[Goal] | None = Field(default=None, max_length=MAX_GOALS)
    experience_level: str | None = None
    equipment_access: list[str] | None = None
    unit_system: str | None = None
    ai_provider: Literal["anthropic", "gemini", "groq"] | None = None
    include_warmup: bool | None = None
    # "custom" reminds every plan_refresh_days days (1-365).
    plan_refresh_cadence: Literal["monthly", "custom"] | None = None
    plan_refresh_days: int | None = Field(default=None, ge=1, le=365)
    # Stored encrypted, so the database can't enforce these — validated here instead.
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    height_cm: float | None = Field(default=None, ge=50, le=300)
    # Gym reminder: local "HH:MM" (null turns it off), which weekdays, and the device's timezone.
    gym_reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    gym_reminder_days: list[Weekday] | None = Field(default=None, max_length=7)
    timezone: str | None = Field(default=None, max_length=64)
    # The whole target map: the app sends every target each time (null / {} clears them all).
    measurement_targets: dict[str, MeasurementTarget] | None = Field(default=None, max_length=50)

    @field_validator("measurement_targets")
    @classmethod
    def _valid_target_keys(cls, value: dict | None) -> dict | None:
        if value is None:
            return None
        for key in value:
            if not key or len(key) > 50:
                raise ValueError("Invalid measurement type")
        return value

    @field_validator("gym_reminder_days")
    @classmethod
    def _order_days(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else sorted(set(value), key=WEEKDAY_ORDER.index)

    @field_validator("timezone")
    @classmethod
    def _known_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone") from None
        return value

    @field_validator("goals")
    @classmethod
    def _dedupe_goals(cls, value: list[str] | None) -> list[str]:
        # An explicit null clears them; an omitted field (exclude_unset) leaves them alone.
        return [] if value is None else list(dict.fromkeys(value))

    def dump_set_fields(self) -> dict:
        """Only the fields the client actually sent, so a partial update never
        clobbers other columns with None."""
        return self.model_dump(exclude_unset=True)
