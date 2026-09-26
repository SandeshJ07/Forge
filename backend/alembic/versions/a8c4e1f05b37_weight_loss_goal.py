"""weight_loss goal

Revision ID: a8c4e1f05b37
Revises: f7b3d9e21a64
Create Date: 2026-09-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a8c4e1f05b37'
down_revision: Union[str, None] = 'f7b3d9e21a64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GOALS = "ARRAY['strength','hypertrophy','general_fitness','endurance','weight_loss']::varchar[]"
OLD_GOALS = "ARRAY['strength','hypertrophy','general_fitness','endurance']::varchar[]"


def upgrade() -> None:
    op.drop_constraint('user_profiles_goals_check', 'user_profiles', type_='check')
    op.create_check_constraint(
        'user_profiles_goals_check', 'user_profiles', f'goals <@ {GOALS} AND cardinality(goals) <= 2'
    )


def downgrade() -> None:
    op.execute("UPDATE user_profiles SET goals = array_remove(goals, 'weight_loss')")
    op.drop_constraint('user_profiles_goals_check', 'user_profiles', type_='check')
    op.create_check_constraint(
        'user_profiles_goals_check', 'user_profiles', f'goals <@ {OLD_GOALS} AND cardinality(goals) <= 2'
    )
