from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkoutResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    source: str
    external_id: str | None
    title: str | None
    date: datetime
    duration_seconds: int | None
    summary: str | None
    perceived_exertion: int | None
    felt_rating: str | None
    enjoyed: bool | None
    notes: str | None
    created_at: datetime


class WorkoutSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workout_id: UUID
    exercise_id: UUID | None
    exercise_name_raw: str | None
    set_index: int
    weight_kg: float | None
    reps: int | None
    duration_seconds: int | None
    distance_meters: float | None
    rpe: float | None


class ManualSetInput(BaseModel):
    # None for exercises that aren't in the glossary (e.g. an AI-planned movement
    # with no exact match) — the set is still logged by name, just without PR tracking.
    exercise_id: UUID | None = None
    exercise_name: str = Field(min_length=1, max_length=200)
    weight_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    rpe: float | None = Field(default=None, ge=0, le=10)


class LogManualWorkoutRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    date: datetime
    sets: list[ManualSetInput] = Field(min_length=1, max_length=500)
    duration_seconds: int | None = Field(default=None, ge=0, le=24 * 3600)


class LogManualWorkoutResponse(BaseModel):
    workout_id: UUID
    new_personal_record_exercise_ids: list[UUID]


class RateWorkoutRequest(BaseModel):
    perceived_exertion: int | None = None
    felt_rating: str | None = None
    enjoyed: bool | None = None
    notes: str | None = None
