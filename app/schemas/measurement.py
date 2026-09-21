from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MeasurementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: str
    value: float
    unit: str
    date: date
    created_at: datetime


class AddMeasurementRequest(BaseModel):
    type: str
    value: float
    unit: str
    date: date


class ProgressPhotoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    storage_path: str
    date: date
    notes: str | None
    created_at: datetime
