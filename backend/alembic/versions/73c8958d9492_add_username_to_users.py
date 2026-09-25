"""add username to users

Revision ID: 73c8958d9492
Revises: 8cbd10c1ed26
Create Date: 2026-09-23 19:39:20.924219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73c8958d9492'
down_revision: Union[str, None] = '8cbd10c1ed26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Added nullable first so existing rows (pre-dating usernames) don't
    # violate NOT NULL immediately. Backfilled from the email's local part
    # (deduplicated with the row's id, since two emails can share a local
    # part), then locked to NOT NULL once every row has a value.
    op.add_column('users', sa.Column('username', sa.String(), nullable=True))
    op.execute(
        """
        UPDATE users
        SET username = split_part(email, '@', 1) || '_' || substr(id::text, 1, 8)
        WHERE username IS NULL
        """
    )
    op.alter_column('users', 'username', nullable=False)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_column('users', 'username')
