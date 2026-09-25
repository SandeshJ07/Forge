"""background plan generation status

Revision ID: 507ca1a93d57
Revises: 144e407d5a34
Create Date: 2026-09-24 22:22:18.211189

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '507ca1a93d57'
down_revision: Union[str, None] = '144e407d5a34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing plans were generated synchronously, so they're all 'ready'.
    op.add_column('generated_plans', sa.Column('status', sa.String(), server_default='ready', nullable=False))
    op.add_column('generated_plans', sa.Column('error', sa.String(), nullable=True))
    op.create_check_constraint(
        'generated_plans_status_check', 'generated_plans', "status in ('generating','ready','failed')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM generated_plans WHERE status <> 'ready'")
    op.drop_constraint('generated_plans_status_check', 'generated_plans', type_='check')
    op.drop_column('generated_plans', 'error')
    op.drop_column('generated_plans', 'status')
