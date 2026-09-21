from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
    exercise_id: UUID
    exercise_name: str
    weight_kg: float | None = None
    reps: int | None = None
    rpe: float | None = None


class LogManualWorkoutRequest(BaseModel):
    title: str
    date: datetime
    sets: list[ManualSetInput]


class LogManualWorkoutResponse(BaseModel):
    workout_id: UUID
    new_personal_record_exercise_ids: list[UUID]


class RateWorkoutRequest(BaseModel):
    perceived_exertion: int | None = None
    felt_rating: str | None = None
    enjoyed: bool | None = None
    notes: str | None = None
