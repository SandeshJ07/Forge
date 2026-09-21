from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GeneratedPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    created_at: datetime
    plan: dict[str, Any]
    source_summary: dict[str, Any]
    accepted: bool


class SetPlanAcceptedRequest(BaseModel):
    accepted: bool
