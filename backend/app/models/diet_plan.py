import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.encrypted_types import EncryptedJSON


class DietPlan(Base):
    """
    An AI-generated diet plan. Only for users with their own AI key (never the
    server's shared key). Generated in the background like workout plans: the
    row starts as 'generating' with an empty plan and flips to 'ready' or 'failed'.
    """

    __tablename__ = "diet_plans"
    __table_args__ = (
        CheckConstraint("status in ('generating','ready','failed')", name="diet_plans_status_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String, nullable=False, default="generating")
    error: Mapped[str | None] = mapped_column(String)
    # Meals, targets and notes; encrypted at rest since they can reflect health conditions.
    plan: Mapped[dict] = mapped_column(EncryptedJSON, nullable=False, default=dict)
    # The choices behind this plan (incl. free-text notes); also pre-fills the form next time.
    preferences: Mapped[dict] = mapped_column(EncryptedJSON, nullable=False, default=dict)
    provider: Mapped[str | None] = mapped_column(String)
    model: Mapped[str | None] = mapped_column(String)
