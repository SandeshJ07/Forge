from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.equipment_catalog import EQUIPMENT_KEYS


class GeneratedPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    plan: dict[str, Any]
    source_summary: dict[str, Any]
    accepted: bool
    status: str
    error: str | None


Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
# Individual muscles only — the user builds each day themselves; nothing is pre-grouped.
Muscle = Literal[
    "chest", "back", "shoulders", "biceps", "triceps", "forearms", "abs",
    "lower_back", "quads", "hamstrings", "glutes", "calves", "cardio",
]


EquipmentItem = Literal[EQUIPMENT_KEYS]  # type: ignore[valid-type]  — individual machines / tools


class PlanPreferences(BaseModel):
    """Optional per-plan choices from the "Plan preferences" screen. Every field may be omitted — the AI decides."""

    training_days: list[Weekday] = Field(default_factory=list, max_length=7)
    # Muscles to train on each day (any number). Days left out are the AI's call.
    day_focus: dict[Weekday, list[Muscle]] = Field(default_factory=dict)
    include_warmup: bool | None = None
    # Individual equipment available for this plan. None = not specified (fall back to profile).
    equipment: list[EquipmentItem] | None = Field(default=None, max_length=len(EQUIPMENT_KEYS))
    session_minutes: Literal[30, 45, 60, 90] | None = None
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("training_days")
    @classmethod
    def _dedupe_days(cls, value: list[str]) -> list[str]:
        order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        return sorted(set(value), key=order.index)

    @field_validator("day_focus")
    @classmethod
    def _dedupe_muscles(cls, value: dict[str, list[str]]) -> dict[str, list[str]]:
        # Keep the user's pick order, drop repeats and days with nothing picked.
        return {day: list(dict.fromkeys(muscles)) for day, muscles in value.items() if muscles}

    @field_validator("equipment")
    @classmethod
    def _dedupe_equipment(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else list(dict.fromkeys(value))

    @field_validator("notes")
    @classmethod
    def _blank_notes_to_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class GeneratePlanRequest(BaseModel):
    preferences: PlanPreferences = Field(default_factory=PlanPreferences)


class PlanGenerationStatus(BaseModel):
    """State of the user's most recent generation request, for the app's background-progress UI."""

    status: Literal["idle", "generating", "ready", "failed"]
    plan_id: UUID | None = None
    error: str | None = None
    started_at: datetime | None = None


class PlanUsage(BaseModel):
    """Today's plan generations on the app's shared AI key. Users with their own key have no limit."""

    own_key: bool
    provider: Literal["anthropic", "gemini"]
    # None when own_key (unlimited).
    limit: int | None
    used: int
    remaining: int | None
    # Next local midnight, when the count starts over.
    resets_at: datetime


class SetPlanAcceptedRequest(BaseModel):
    accepted: bool
