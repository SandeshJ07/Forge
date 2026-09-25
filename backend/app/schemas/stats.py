from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PeriodStats(BaseModel):
    workouts: int
    volume_kg: float
    records: int


class StrengthGain(BaseModel):
    exercise_id: UUID
    exercise_name: str
    first_best_kg: float
    current_best_kg: float
    gain_kg: float
    gain_pct: float


class Milestone(BaseModel):
    target: int
    remaining: int
    previous: int


class StatsOverview(BaseModel):
    first_workout_at: datetime | None
    total_workouts: int
    total_sets: int
    total_reps: int
    total_volume_kg: float
    this_month: PeriodStats
    last_month: PeriodStats
    strength_gains: list[StrengthGain]
    next_milestone: Milestone | None
