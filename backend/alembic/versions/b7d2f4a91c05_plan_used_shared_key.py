"""generated_plans.used_shared_key, for the per-user daily limit on the shared AI key

Revision ID: b7d2f4a91c05
Revises: 9a4e2b7c1d3f
Create Date: 2026-09-25 05:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7d2f4a91c05'
down_revision: Union[str, None] = '9a4e2b7c1d3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing plans default to false: history before the limit doesn't count against anyone.
    op.add_column(
        'generated_plans',
        sa.Column('used_shared_key', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )


def downgrade() -> None:
    op.drop_column('generated_plans', 'used_shared_key')
