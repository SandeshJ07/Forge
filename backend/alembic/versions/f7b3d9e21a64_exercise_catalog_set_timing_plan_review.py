"""exercise catalog (clearer names, tracking types, new exercises), per-set timing, plan review

- exercises.tracking_type: how the exercise is logged (weight x reps, time, distance + time, ...)
- curated exercise names ("Bench Press (Barbell)"); the old name is kept in aliases
- workout_sets.started_at / ended_at: when each set began and was finished
- generated_plans.accepted_at / dismissed: new plans wait for the user to accept
  them instead of replacing the current plan; the accepted one is "current"

Revision ID: f7b3d9e21a64
Revises: e5a2c7d94b18
Create Date: 2026-09-26 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.services.exercise_catalog import NEW_EXERCISES, RENAMES, apply_catalog

# revision identifiers, used by Alembic.
revision: str = 'f7b3d9e21a64'
down_revision: Union[str, None] = 'e5a2c7d94b18'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TRACKING_CHECK = (
    "tracking_type in ('weight_reps','bodyweight_reps','weighted_bodyweight','duration',"
    "'distance_duration','weight_distance')"
)


def upgrade() -> None:
    op.add_column(
        'exercises',
        sa.Column('tracking_type', sa.String(), nullable=False, server_default='weight_reps'),
    )
    op.create_check_constraint('exercises_tracking_type_check', 'exercises', TRACKING_CHECK)
    apply_catalog(op.get_bind())
    # Logged sets keep their exercise link; show them under the new names too.
    op.execute(
        """
        UPDATE workout_sets ws SET exercise_name_raw = e.name
        FROM exercises e
        WHERE ws.exercise_id = e.id AND ws.exercise_name_raw IS DISTINCT FROM e.name
        """
    )

    op.add_column('workout_sets', sa.Column('started_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('workout_sets', sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('generated_plans', sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'generated_plans',
        sa.Column('dismissed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    # Until now the newest ready plan was the current one: make it the accepted one.
    op.execute("UPDATE generated_plans SET accepted = false, accepted_at = NULL")
    op.execute(
        """
        UPDATE generated_plans gp SET accepted = true, accepted_at = gp.created_at
        FROM (
            SELECT DISTINCT ON (user_id) id FROM generated_plans
            WHERE status = 'ready' ORDER BY user_id, created_at DESC
        ) latest
        WHERE gp.id = latest.id
        """
    )


def downgrade() -> None:
    op.drop_column('generated_plans', 'dismissed')
    op.drop_column('generated_plans', 'accepted_at')
    op.drop_column('workout_sets', 'ended_at')
    op.drop_column('workout_sets', 'started_at')

    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM exercises WHERE source = 'forge' AND name = ANY(:names)"),
        {"names": [e["name"] for e in NEW_EXERCISES]},
    )
    for old, new in RENAMES.items():
        if old != new:
            conn.execute(
                sa.text(
                    "UPDATE exercises SET name = :old, aliases = array_remove(aliases, CAST(:old AS varchar)) "
                    "WHERE name = :new"
                ),
                {"old": old, "new": new},
            )
    op.drop_constraint('exercises_tracking_type_check', 'exercises', type_='check')
    op.drop_column('exercises', 'tracking_type')
