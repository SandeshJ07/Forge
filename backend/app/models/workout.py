import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, SmallInteger, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedString


class Workout(Base):
    __tablename__ = "workouts"
    __table_args__ = (
        CheckConstraint("source = 'manual'", name="workouts_source_check"),
        CheckConstraint(
            "felt_rating in ('too_easy','just_right','too_hard')", name="workouts_felt_rating_check"
        ),
        CheckConstraint("perceived_exertion between 1 and 10", name="workouts_perceived_exertion_check"),
        UniqueConstraint("user_id", "source", "external_id", name="workouts_user_source_external_id_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="manual")
    external_id: Mapped[str | None] = mapped_column(String)
    title: Mapped[str | None] = mapped_column(String)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(String)
    perceived_exertion: Mapped[int | None] = mapped_column(SmallInteger)
    felt_rating: Mapped[str | None] = mapped_column(String)
    enjoyed: Mapped[bool | None] = mapped_column()
    # Free text — may mention injuries or how the user felt; encrypted at rest.
    notes: Mapped[str | None] = mapped_column(EncryptedString)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WorkoutSet(Base):
    __tablename__ = "workout_sets"
    __table_args__ = (CheckConstraint("rpe between 0 and 10", name="workout_sets_rpe_check"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exercise_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="SET NULL"), index=True
    )
    exercise_name_raw: Mapped[str | None] = mapped_column(String)
    set_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    weight_kg: Mapped[float | None] = mapped_column(Numeric)
    reps: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    distance_meters: Mapped[float | None] = mapped_column(Numeric)
    rpe: Mapped[float | None] = mapped_column(Numeric)
