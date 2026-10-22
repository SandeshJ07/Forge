"""user_profiles.ai_day_edits_on / ai_day_edits_count: daily allowance for AI edits of one plan day

Revision ID: d2a7f5c18b64
Revises: c6f2a8d34e71
Create Date: 2026-10-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd2a7f5c18b64'
down_revision: Union[str, None] = 'c6f2a8d34e71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('ai_day_edits_on', sa.Date(), nullable=True))
    op.add_column(
        'user_profiles', sa.Column('ai_day_edits_count', sa.Integer(), nullable=False, server_default='0')
    )


def downgrade() -> None:
    op.drop_column('user_profiles', 'ai_day_edits_count')
    op.drop_column('user_profiles', 'ai_day_edits_on')
