from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    aliases: list[str] | None
    muscle_groups: list[str]
    secondary_muscle_groups: list[str] | None
    equipment: str | None
    difficulty: str | None
    instructions: list[str]
    media_url: str | None
    media_type: str | None
    category: str | None
    source: str
    created_at: datetime


class ExerciseFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    exercise_id: UUID
    rating: str
    updated_at: datetime


class SetExerciseFeedbackRequest(BaseModel):
    rating: str
