"""diet plans: AI-generated with the user's own key, encrypted at rest

Revision ID: c9e4a1d7b2f5
Revises: b3d7f2a91c68
Create Date: 2026-09-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9e4a1d7b2f5'
down_revision: Union[str, None] = 'b3d7f2a91c68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'diet_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('error', sa.String(), nullable=True),
        sa.Column('plan', sa.Text(), nullable=False),
        sa.Column('preferences', sa.Text(), nullable=False),
        sa.Column('provider', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.CheckConstraint("status in ('generating','ready','failed')", name='diet_plans_status_check'),
    )
    op.create_index('ix_diet_plans_user_id', 'diet_plans', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_diet_plans_user_id', table_name='diet_plans')
    op.drop_table('diet_plans')
