"""Google sign-in: users.google_sub_hash; password optional

Revision ID: d4f1b6c83e27
Revises: c3e8a5d27f14
Create Date: 2026-09-25 07:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4f1b6c83e27'
down_revision: Union[str, None] = 'c3e8a5d27f14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub_hash', sa.String(), nullable=True))
    op.create_index('ix_users_google_sub_hash', 'users', ['google_sub_hash'], unique=True)
    # Accounts created with Google have no password until they set one.
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Google-only accounts can't survive without a password column value; they
    # would have to sign up again. Refuse rather than silently delete them.
    conn = op.get_bind()
    if conn.execute(sa.text('SELECT count(*) FROM users WHERE password_hash IS NULL')).scalar():
        raise RuntimeError('Some users only sign in with Google (no password); downgrade would lock them out.')
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=False)
    op.drop_index('ix_users_google_sub_hash', table_name='users')
    op.drop_column('users', 'google_sub_hash')
