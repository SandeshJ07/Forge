import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PersonalRecord(Base):
    __tablename__ = "personal_records"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True
    )
    best_weight_kg: Mapped[float] = mapped_column(Numeric, nullable=False)
    best_weight_reps: Mapped[int | None] = mapped_column(Integer)
    achieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    workout_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
