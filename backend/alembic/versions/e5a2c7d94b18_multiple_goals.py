"""user_profiles.goal -> goals (up to two, most important first)

Revision ID: e5a2c7d94b18
Revises: d4f1b6c83e27
Create Date: 2026-09-25 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e5a2c7d94b18'
down_revision: Union[str, None] = 'd4f1b6c83e27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GOALS = "ARRAY['strength','hypertrophy','general_fitness','endurance']::varchar[]"


def upgrade() -> None:
    op.add_column(
        'user_profiles',
        sa.Column('goals', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
    )
    op.execute('UPDATE user_profiles SET goals = ARRAY[goal] WHERE goal IS NOT NULL')
    op.drop_constraint('user_profiles_goal_check', 'user_profiles', type_='check')
    op.drop_column('user_profiles', 'goal')
    op.create_check_constraint(
        'user_profiles_goals_check', 'user_profiles', f'goals <@ {GOALS} AND cardinality(goals) <= 2'
    )


def downgrade() -> None:
    # Keeps the primary (first) goal; a second goal is dropped.
    op.add_column('user_profiles', sa.Column('goal', sa.String(), nullable=True))
    op.execute('UPDATE user_profiles SET goal = goals[1]')
    op.drop_constraint('user_profiles_goals_check', 'user_profiles', type_='check')
    op.drop_column('user_profiles', 'goals')
    op.create_check_constraint(
        'user_profiles_goal_check', 'user_profiles', "goal in ('strength','hypertrophy','general_fitness','endurance')"
    )
