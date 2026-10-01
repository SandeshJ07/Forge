from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

DietType = Literal["vegetarian", "non_vegetarian", "vegan"]
Budget = Literal["low", "moderate", "flexible"]
# minimal: under ~15 min a meal; moderate: ~30 min; plenty: happy to cook.
CookingTime = Literal["minimal", "moderate", "plenty"]


class DietPreferences(BaseModel):
    """Choices from the diet plan form. Only the diet type and meals a day are required; the AI decides the rest."""

    diet_type: DietType
    meals_per_day: int = Field(ge=2, le=6)
    # Always kilograms here; the app converts from pounds for imperial users.
    target_weight_kg: float | None = Field(default=None, ge=30, le=300)
    budget: Budget | None = None
    cooking_time: CookingTime | None = None
    # Cuisine(s) to base meals on, in the user's words; Indian unless they say otherwise.
    cuisine: str = Field(default="Indian", max_length=100)
    # Allergies, foods to avoid, medical notes — anything else.
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes")
    @classmethod
    def _blank_notes_to_none(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None

    @field_validator("cuisine")
    @classmethod
    def _blank_cuisine_to_indian(cls, value: str) -> str:
        return value.strip() or "Indian"


class GenerateDietPlanRequest(BaseModel):
    preferences: DietPreferences


class DietPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    status: str
    error: str | None
    plan: dict[str, Any]
    preferences: dict[str, Any]
    provider: str | None


class DietGenerationStatus(BaseModel):
    status: Literal["idle", "generating", "ready", "failed"]
    plan_id: UUID | None = None
    error: str | None = None
    started_at: datetime | None = None


class DietAccess(BaseModel):
    """Diet plans need the user's own AI key. provider is the one that would be used (None when no key)."""

    available: bool
    provider: Literal["anthropic", "gemini", "grok"] | None
