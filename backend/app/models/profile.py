import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import select
from sqlalchemy.orm import Mapped, column_property, mapped_column

from app.core.database import Base
from app.models.user import User
from app.core.encrypted_types import EncryptedFloat, EncryptedInt, EncryptedJSON, EncryptedString


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (
        # Up to two goals, most important first.
        CheckConstraint(
            "goals <@ ARRAY['strength','hypertrophy','general_fitness','endurance','weight_loss']::varchar[] "
            "AND cardinality(goals) <= 2",
            name="user_profiles_goals_check",
        ),
        CheckConstraint(
            "experience_level in ('beginner','intermediate','advanced')", name="user_profiles_experience_level_check"
        ),
        CheckConstraint("unit_system in ('metric','imperial')", name="user_profiles_unit_system_check"),
        CheckConstraint(
            "plan_refresh_cadence in ('weekly','biweekly','monthly')", name="user_profiles_plan_refresh_cadence_check"
        ),
        CheckConstraint("ai_provider in ('anthropic','gemini')", name="user_profiles_ai_provider_check"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list, server_default="{}")
    experience_level: Mapped[str | None] = mapped_column(String)
    equipment_access: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    unit_system: Mapped[str] = mapped_column(String, nullable=False, default="metric")
    ai_provider: Mapped[str] = mapped_column(String, nullable=False, default="anthropic", server_default="anthropic")
    anthropic_api_key_set: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gemini_api_key_set: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    include_warmup: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    plan_refresh_cadence: Mapped[str] = mapped_column(String, nullable=False, default="weekly")
    # Personal / body data, encrypted at rest (app/core/crypto.py). Ranges are
    # checked in UserProfileUpdate — the database can't see inside ciphertext.
    gender: Mapped[str | None] = mapped_column(EncryptedString)
    birth_year: Mapped[int | None] = mapped_column(EncryptedInt)
    height_cm: Mapped[float | None] = mapped_column(EncryptedFloat)
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Last choices from the Plan preferences screen — saved the moment the user
    # taps "Create my plan", whether or not that generation then succeeds.
    # Encrypted: its free-text notes can mention injuries or health conditions.
    plan_preferences: Mapped[dict | None] = mapped_column(EncryptedJSON)

    # Read-only, from users: whether the account has a password (Google-only
    # accounts don't). The app uses it to ask for the right re-confirmation.
    has_password: Mapped[bool] = column_property(
        select(User.password_hash.is_not(None)).where(User.id == user_id).correlate_except(User).scalar_subquery()
    )
