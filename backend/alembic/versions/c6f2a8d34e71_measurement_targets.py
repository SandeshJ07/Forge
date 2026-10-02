"""user_profiles.measurement_targets: target per measurement type (Progress chart baseline)

Revision ID: c6f2a8d34e71
Revises: b9e5c3a72d16
Create Date: 2026-10-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c6f2a8d34e71'
down_revision: Union[str, None] = 'b9e5c3a72d16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Encrypted JSON (app/core/encrypted_types.py), stored as text.
    op.add_column('user_profiles', sa.Column('measurement_targets', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_profiles', 'measurement_targets')
