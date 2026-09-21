import uuid
from datetime import date as date_type
from datetime import datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Measurement(Base):
    __tablename__ = "measurements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    value: Mapped[float] = mapped_column(Numeric, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProgressPhoto(Base):
    __tablename__ = "progress_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
