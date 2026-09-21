from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    goal: str | None
    experience_level: str | None
    equipment_access: list[str] | None
    unit_system: str
    anthropic_api_key_set: bool
    include_warmup: bool
    plan_refresh_cadence: str
    gender: str | None
    birth_year: int | None
    height_cm: float | None
    onboarded_at: datetime | None


class UserProfileUpdate(BaseModel):
    goal: str | None = None
    experience_level: str | None = None
    equipment_access: list[str] | None = None
    unit_system: str | None = None
    include_warmup: bool | None = None
    plan_refresh_cadence: str | None = None
    gender: str | None = None
    birth_year: int | None = None
    height_cm: float | None = None

    def dump_set_fields(self) -> dict:
        """Only the fields the client actually sent, so a partial update never
        clobbers other columns with None."""
        return self.model_dump(exclude_unset=True)
