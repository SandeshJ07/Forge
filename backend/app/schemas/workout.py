from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkoutRunInfo(BaseModel):
    """For GPS-recorded workouts: the headline numbers, and (when asked for) a small route outline."""

    activity: str
    distance_m: float
    moving_seconds: int
    elevation_gain_m: float
    # [[lat, lng], ...], ~60 points; only when the list was requested with route_previews=true.
    preview: list[list[float]] | None = None


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
    # Set for GPS-recorded runs / walks / rides.
    run: WorkoutRunInfo | None = None


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
    started_at: datetime | None
    ended_at: datetime | None


class WorkoutDetailExercise(BaseModel):
    """One exercise in a logged workout, with its sets in the order done."""

    exercise_id: UUID | None
    name: str
    tracking_type: str | None
    muscle_groups: list[str]
    secondary_muscle_groups: list[str]
    sets: list[WorkoutSetResponse]
    # A heavier weight than any earlier workout had for this exercise.
    is_pr: bool = False


class WorkoutSessionPR(BaseModel):
    exercise_id: UUID
    name: str
    weight_kg: float
    reps: int | None
    # None when this was the first time the exercise was logged with weight.
    previous_best_kg: float | None


class WorkoutDetailResponse(BaseModel):
    workout: WorkoutResponse
    exercises: list[WorkoutDetailExercise]
    primary_muscles: list[str]
    secondary_muscles: list[str]
    personal_records: list[WorkoutSessionPR]


class ManualSetInput(BaseModel):
    # None for exercises that aren't in the glossary (e.g. an AI-planned movement
    # with no exact match) — the set is still logged by name, just without PR tracking.
    exercise_id: UUID | None = None
    exercise_name: str = Field(min_length=1, max_length=200)
    weight_kg: float | None = Field(default=None, ge=0, le=1000)
    reps: int | None = Field(default=None, ge=0, le=1000)
    duration_seconds: int | None = Field(default=None, ge=0, le=24 * 3600)
    distance_meters: float | None = Field(default=None, ge=0, le=1_000_000)
    rpe: float | None = Field(default=None, ge=0, le=10)
    started_at: datetime | None = None
    ended_at: datetime | None = None


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
