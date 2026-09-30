"""gym reminders (time, weekdays, timezone, web push subscriptions) and exercise tracking fixes

- user_profiles.gym_reminder_time / gym_reminder_days / timezone / gym_reminder_last_sent
- push_subscriptions: browsers that get web push reminders
- tracking fixes: Dead Hang / Wall Sit are timed (a same-named hand-added row had been
  classified as reps), squats and other dynamic drills filed as stretches are reps;
  saved plans are re-synced to the corrected types

Revision ID: e8b1c4f36a92
Revises: c9e4a1d7b2f5
Create Date: 2026-09-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.services.exercise_catalog import apply_catalog, sync_plan_tracking

# revision identifiers, used by Alembic.
revision: str = 'e8b1c4f36a92'
down_revision: Union[str, None] = 'c9e4a1d7b2f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('gym_reminder_time', sa.String(), nullable=True))
    op.add_column(
        'user_profiles',
        sa.Column('gym_reminder_days', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
    )
    op.add_column('user_profiles', sa.Column('timezone', sa.String(), nullable=True))
    op.add_column('user_profiles', sa.Column('gym_reminder_last_sent', sa.Date(), nullable=True))
    op.create_check_constraint(
        'user_profiles_gym_reminder_time_check',
        'user_profiles',
        "gym_reminder_time IS NULL OR gym_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'",
    )

    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('endpoint', sa.String(), nullable=False),
        sa.Column('p256dh', sa.String(), nullable=False),
        sa.Column('auth', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('endpoint'),
    )
    op.create_index('ix_push_subscriptions_user_id', 'push_subscriptions', ['user_id'])

    conn = op.get_bind()
    apply_catalog(conn)
    sync_plan_tracking(conn)


def downgrade() -> None:
    # The tracking fixes are corrections and stay in place.
    op.drop_index('ix_push_subscriptions_user_id', table_name='push_subscriptions')
    op.drop_table('push_subscriptions')
    op.drop_constraint('user_profiles_gym_reminder_time_check', 'user_profiles', type_='check')
    op.drop_column('user_profiles', 'gym_reminder_last_sent')
    op.drop_column('user_profiles', 'timezone')
    op.drop_column('user_profiles', 'gym_reminder_days')
    op.drop_column('user_profiles', 'gym_reminder_time')
