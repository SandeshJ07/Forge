from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

MAX_POINTS = 40_000  # ~11 hours at one fix a second


class RecordedPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    # Seconds since the run started (pauses included).
    t: float = Field(ge=0, le=48 * 3600)
    alt: float | None = Field(default=None, ge=-500, le=9000)
    # Horizontal accuracy in metres, as reported by the device.
    acc: float | None = Field(default=None, ge=0, le=10_000)


class SaveRunRequest(BaseModel):
    activity: Literal["run", "walk", "ride"] = "run"
    title: str = Field(default="", max_length=120)
    started_at: datetime
    # Wall-clock time from start to finish, pauses included.
    elapsed_seconds: int = Field(ge=1, le=48 * 3600)
    # One list per recording segment: a pause ends a segment and resuming starts the next.
    segments: list[list[RecordedPoint]] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _limit_points(self) -> "SaveRunRequest":
        if sum(len(s) for s in self.segments) > MAX_POINTS:
            raise ValueError(f"A run can have at most {MAX_POINTS} points")
        return self


class SaveRunResponse(BaseModel):
    workout_id: UUID
    distance_m: float
    moving_seconds: int


class RunSummary(BaseModel):
    activity: str
    distance_m: float
    moving_seconds: int
    elapsed_seconds: int
    elevation_gain_m: float
    max_speed_mps: float


class RunRouteResponse(RunSummary):
    workout_id: UUID
    # [[lat, lng], ...] per segment.
    segments: list[list[list[float]]]
    # {"km": 1, "distance_m": 1000, "seconds": 312}; the last one may be a partial km.
    splits: list[dict]
    # [[distance_m, altitude_m], ...]
    elevation_profile: list[list[float]]
