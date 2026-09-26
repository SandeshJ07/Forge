"""plan refresh reminder: monthly or a custom number of days (weekly / biweekly removed)

Existing weekly and biweekly reminders become custom 7 and 14 days, so nobody's
reminder changes.

Revision ID: b3d7f2a91c68
Revises: a8c4e1f05b37
Create Date: 2026-09-26 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b3d7f2a91c68'
down_revision: Union[str, None] = 'a8c4e1f05b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('plan_refresh_days', sa.Integer(), nullable=True))
    op.drop_constraint('user_profiles_plan_refresh_cadence_check', 'user_profiles', type_='check')
    op.execute(
        """
        UPDATE user_profiles SET
            plan_refresh_days = CASE plan_refresh_cadence WHEN 'weekly' THEN 7 WHEN 'biweekly' THEN 14 END,
            plan_refresh_cadence = 'custom'
        WHERE plan_refresh_cadence IN ('weekly', 'biweekly')
        """
    )
    op.create_check_constraint(
        'user_profiles_plan_refresh_cadence_check', 'user_profiles', "plan_refresh_cadence in ('monthly','custom')"
    )
    op.create_check_constraint(
        'user_profiles_plan_refresh_days_check',
        'user_profiles',
        "plan_refresh_cadence <> 'custom' OR plan_refresh_days BETWEEN 1 AND 365",
    )


def downgrade() -> None:
    op.drop_constraint('user_profiles_plan_refresh_days_check', 'user_profiles', type_='check')
    op.drop_constraint('user_profiles_plan_refresh_cadence_check', 'user_profiles', type_='check')
    # Closest old option: up to 10 days -> weekly, up to 21 -> biweekly, else monthly.
    op.execute(
        """
        UPDATE user_profiles SET plan_refresh_cadence = CASE
            WHEN plan_refresh_days <= 10 THEN 'weekly'
            WHEN plan_refresh_days <= 21 THEN 'biweekly'
            ELSE 'monthly' END
        WHERE plan_refresh_cadence = 'custom'
        """
    )
    op.create_check_constraint(
        'user_profiles_plan_refresh_cadence_check',
        'user_profiles',
        "plan_refresh_cadence in ('weekly','biweekly','monthly')",
    )
    op.drop_column('user_profiles', 'plan_refresh_days')
