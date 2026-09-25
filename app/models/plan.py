import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GeneratedPlan(Base):
    __tablename__ = "generated_plans"
    __table_args__ = (
        CheckConstraint("status in ('generating','ready','failed')", name="generated_plans_status_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    plan: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_summary: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Plans are generated in the background: the row is created as 'generating'
    # (with an empty plan) and flipped to 'ready' or 'failed' when the AI call ends.
    status: Mapped[str] = mapped_column(String, nullable=False, default="ready", server_default="ready")
    error: Mapped[str | None] = mapped_column(String)
