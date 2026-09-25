import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailCode(Base):
    """
    Short-lived, single-use codes emailed to a user for either email
    verification (at sign-up) or password reset. Not a full audit log —
    old rows can be pruned periodically; nothing else references them.
    """

    __tablename__ = "email_codes"
    __table_args__ = (CheckConstraint("purpose in ('verify_email', 'reset_password')", name="email_codes_purpose_check"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Wrong guesses against this code. Once it hits the cap in
    # app/services/email_codes.py the code is burned (used_at set), so a
    # 6-digit code can't be brute-forced within its expiry window.
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
