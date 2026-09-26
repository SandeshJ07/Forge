import uuid
from datetime import datetime

from sqlalchemy import ARRAY, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        CheckConstraint("difficulty in ('beginner','intermediate','advanced')", name="exercises_difficulty_check"),
        CheckConstraint("media_type in ('image','gif')", name="exercises_media_type_check"),
        CheckConstraint(
            "tracking_type in ('weight_reps','bodyweight_reps','weighted_bodyweight','duration',"
            "'distance_duration','weight_distance')",
            name="exercises_tracking_type_check",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    aliases: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    muscle_groups: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    secondary_muscle_groups: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    equipment: Mapped[str | None] = mapped_column(String, index=True)
    difficulty: Mapped[str | None] = mapped_column(String)
    instructions: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    # First how-to image, kept for list thumbnails; media_urls has all of them in order.
    media_url: Mapped[str | None] = mapped_column(String)
    media_urls: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list, server_default="{}")
    media_type: Mapped[str | None] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, nullable=False, default="free-exercise-db")
    # How a set is logged — see app/services/exercise_catalog.py.
    tracking_type: Mapped[str] = mapped_column(String, nullable=False, default="weight_reps", server_default="weight_reps")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserExerciseFeedback(Base):
    __tablename__ = "user_exercise_feedback"
    __table_args__ = (
        CheckConstraint("rating in ('like','dislike','neutral')", name="user_exercise_feedback_rating_check"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    exercise_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True
    )
    rating: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
