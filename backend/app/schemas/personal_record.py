from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PersonalRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    exercise_id: UUID
    exercise_name: str
    best_weight_kg: float
    best_weight_reps: int | None
    achieved_at: datetime
    workout_id: UUID | None
    updated_at: datetime
