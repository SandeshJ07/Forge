"""encrypt sensitive data at rest; hash email codes

Encrypts (Fernet, app/core/crypto.py) every column that holds secrets or
personal/body data, rewriting existing rows in place:
  users.email (+ new users.email_hash blind index for lookups),
  integration_tokens.access_token, user_profiles.gender / birth_year /
  height_cm / plan_preferences, measurements.value, progress_photos.notes
  (and the photo files on disk), workouts.notes, generated_plans.source_summary.
email_codes.code is replaced by code_hash (keyed hash; live codes keep working).

Needs DATA_ENCRYPTION_KEY set. Downgrade decrypts everything back.

Revision ID: c3e8a5d27f14
Revises: b7d2f4a91c05
Create Date: 2026-09-25 06:00:00.000000

"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.core.config import get_settings
from app.core.crypto import InvalidToken, decrypt, decrypt_bytes, email_index, encrypt, encrypt_bytes, keyed_hash

# revision identifiers, used by Alembic.
revision: str = 'c3e8a5d27f14'
down_revision: Union[str, None] = 'b7d2f4a91c05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, primary-key columns, column, SQL type to restore on downgrade)
ENCRYPTED_COLUMNS = [
    ('users', ('id',), 'email', 'varchar'),
    ('integration_tokens', ('user_id', 'provider'), 'access_token', 'varchar'),
    ('user_profiles', ('user_id',), 'gender', 'varchar'),
    ('user_profiles', ('user_id',), 'birth_year', 'integer'),
    ('user_profiles', ('user_id',), 'height_cm', 'numeric'),
    ('user_profiles', ('user_id',), 'plan_preferences', 'jsonb'),
    ('measurements', ('id',), 'value', 'numeric'),
    ('progress_photos', ('id',), 'notes', 'varchar'),
    ('workouts', ('id',), 'notes', 'varchar'),
    ('generated_plans', ('id',), 'source_summary', 'jsonb'),
]

PROFILE_CHECKS = {
    'user_profiles_gender_check': "gender in ('male','female','other','prefer_not_to_say')",
    'user_profiles_birth_year_check': 'birth_year between 1900 and 2100',
    'user_profiles_height_cm_check': 'height_cm between 50 and 300',
}


def _rewrite(table: str, keys: tuple[str, ...], column: str, transform) -> None:
    """Applies `transform` to every non-null value of table.column, row by row."""
    conn = op.get_bind()
    key_list = ', '.join(keys)
    rows = conn.execute(sa.text(f'SELECT {key_list}, {column} FROM {table} WHERE {column} IS NOT NULL')).all()
    where = ' AND '.join(f'{k} = :k{i}' for i, k in enumerate(keys))
    stmt = sa.text(f'UPDATE {table} SET {column} = :value WHERE {where}')
    for row in rows:
        params = {f'k{i}': row[i] for i in range(len(keys))}
        conn.execute(stmt, {'value': transform(row[-1]), **params})


def _photo_files() -> list[Path]:
    root = Path(get_settings().storage_dir) / 'progress_photos'
    return [p for p in root.rglob('*') if p.is_file()] if root.exists() else []


def upgrade() -> None:
    # users.email: keyed-hash index for lookups, then encrypt the address itself.
    op.add_column('users', sa.Column('email_hash', sa.String(), nullable=True))
    conn = op.get_bind()
    for user_id, email in conn.execute(sa.text('SELECT id, email FROM users')).all():
        conn.execute(sa.text('UPDATE users SET email_hash = :h WHERE id = :id'), {'h': email_index(email), 'id': user_id})
    op.alter_column('users', 'email_hash', nullable=False)
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email_hash', 'users', ['email_hash'], unique=True)

    for name in PROFILE_CHECKS:
        op.drop_constraint(name, 'user_profiles', type_='check')

    for table, keys, column, _ in ENCRYPTED_COLUMNS:
        op.alter_column(table, column, type_=sa.Text(), postgresql_using=f'{column}::text')
        _rewrite(table, keys, column, encrypt)

    # email_codes: keep only a keyed hash of each code.
    op.add_column('email_codes', sa.Column('code_hash', sa.String(), nullable=True))
    for code_id, code in conn.execute(sa.text('SELECT id, code FROM email_codes')).all():
        conn.execute(
            sa.text('UPDATE email_codes SET code_hash = :h WHERE id = :id'),
            {'h': keyed_hash(code, 'email-code'), 'id': code_id},
        )
    op.alter_column('email_codes', 'code_hash', nullable=False)
    op.drop_column('email_codes', 'code')

    # Progress photo files on disk.
    for path in _photo_files():
        data = path.read_bytes()
        try:
            decrypt_bytes(data)  # already encrypted (re-run) — leave it
        except InvalidToken:
            path.write_bytes(encrypt_bytes(data))


def downgrade() -> None:
    for path in _photo_files():
        try:
            path.write_bytes(decrypt_bytes(path.read_bytes()))
        except InvalidToken:
            pass  # already plain

    # Hashes can't be reversed: outstanding codes are dropped (users request a new one).
    op.execute('DELETE FROM email_codes')
    op.add_column('email_codes', sa.Column('code', sa.String(), nullable=True))
    op.drop_column('email_codes', 'code_hash')
    op.alter_column('email_codes', 'code', nullable=False)

    for table, keys, column, sql_type in reversed(ENCRYPTED_COLUMNS):
        _rewrite(table, keys, column, decrypt)
        restore = {
            'varchar': sa.String(),
            'integer': sa.Integer(),
            'numeric': sa.Numeric(),
            'jsonb': postgresql.JSONB(astext_type=sa.Text()),
        }[sql_type]
        op.alter_column(table, column, type_=restore, postgresql_using=f'{column}::{sql_type}')

    for name, condition in PROFILE_CHECKS.items():
        op.create_check_constraint(name, 'user_profiles', condition)

    op.drop_index('ix_users_email_hash', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.drop_column('users', 'email_hash')
