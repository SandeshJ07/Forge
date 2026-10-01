import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedJSON, EncryptedString


class RunRoute(Base):
    """
    The GPS route of a recorded run / walk / ride, attached to its workout.
    The route is precise location history, so it's encrypted at rest; the
    summary numbers stay plain for listing.
    """

    __tablename__ = "run_routes"
    __table_args__ = (CheckConstraint("activity in ('run','walk','ride')", name="run_routes_activity_check"),)

    workout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workouts.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity: Mapped[str] = mapped_column(String, nullable=False, default="run")
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    moving_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    elevation_gain_m: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    max_speed_mps: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    # app/services/runs.py pack_route(): compressed points per segment.
    route: Mapped[str] = mapped_column(EncryptedString, nullable=False)
    # ~60-point outline for list thumbnails.
    preview: Mapped[list] = mapped_column(EncryptedJSON, nullable=False, default=list)
    # Per-km splits and a sampled elevation profile, computed once at save time.
    splits: Mapped[list] = mapped_column(EncryptedJSON, nullable=False, default=list)
    elevation_profile: Mapped[list] = mapped_column(EncryptedJSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
