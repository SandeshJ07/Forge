"""run_routes: GPS-recorded runs / walks / rides attached to their workout

Revision ID: b9e5c3a72d16
Revises: a4d8e2f61b93
Create Date: 2026-10-01 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b9e5c3a72d16'
down_revision: Union[str, None] = 'a4d8e2f61b93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'run_routes',
        sa.Column('workout_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('activity', sa.String(), nullable=False),
        sa.Column('distance_m', sa.Float(), nullable=False),
        sa.Column('moving_seconds', sa.Integer(), nullable=False),
        sa.Column('elapsed_seconds', sa.Integer(), nullable=False),
        sa.Column('elevation_gain_m', sa.Float(), nullable=False),
        sa.Column('max_speed_mps', sa.Float(), nullable=False),
        sa.Column('route', sa.Text(), nullable=False),
        sa.Column('preview', sa.Text(), nullable=False),
        sa.Column('splits', sa.Text(), nullable=False),
        sa.Column('elevation_profile', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.CheckConstraint("activity in ('run','walk','ride')", name='run_routes_activity_check'),
        sa.ForeignKeyConstraint(['workout_id'], ['workouts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('workout_id'),
    )
    op.create_index('ix_run_routes_user_id', 'run_routes', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_run_routes_user_id', table_name='run_routes')
    op.drop_table('run_routes')
