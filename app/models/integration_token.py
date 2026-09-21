import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IntegrationToken(Base):
    """
    Holds secrets that must never reach the client (currently just the
    user's optional Anthropic API key). Deliberately has no corresponding
    Pydantic response schema that includes access_token — only this
    backend's own services read it.
    """

    __tablename__ = "integration_tokens"
    __table_args__ = (CheckConstraint("provider = 'anthropic'", name="integration_tokens_provider_check"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    provider: Mapped[str] = mapped_column(String, primary_key=True, default="anthropic")
    access_token: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
