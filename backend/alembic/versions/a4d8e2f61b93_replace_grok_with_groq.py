"""replace the grok (xAI) provider with groq

xAI keys don't work with Groq, so any saved Grok key is removed; a user who
had picked Grok now has Groq picked and can add a Groq key in Settings.

Additive on purpose, so the app keeps working whichever of migration and
deploy goes first: the old grok_api_key_set column stays (unused by the app
now) and the provider checks still accept 'grok' alongside 'groq'. A later
cleanup migration can drop them.

Revision ID: a4d8e2f61b93
Revises: f3c9a7d15e48
Create Date: 2026-10-01 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a4d8e2f61b93'
down_revision: Union[str, None] = 'f3c9a7d15e48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _set_checks(providers: str) -> None:
    op.drop_constraint('user_profiles_ai_provider_check', 'user_profiles', type_='check')
    op.drop_constraint('integration_tokens_provider_check', 'integration_tokens', type_='check')
    op.create_check_constraint('user_profiles_ai_provider_check', 'user_profiles', f"ai_provider in ({providers})")
    op.create_check_constraint('integration_tokens_provider_check', 'integration_tokens', f"provider in ({providers})")


def upgrade() -> None:
    op.add_column(
        'user_profiles', sa.Column('groq_api_key_set', sa.Boolean(), server_default='false', nullable=False)
    )
    _set_checks("'anthropic','gemini','grok','groq'")
    op.execute("DELETE FROM integration_tokens WHERE provider = 'grok'")
    op.execute("UPDATE user_profiles SET grok_api_key_set = false")
    op.execute("UPDATE user_profiles SET ai_provider = 'groq' WHERE ai_provider = 'grok'")


def downgrade() -> None:
    op.execute("DELETE FROM integration_tokens WHERE provider = 'groq'")
    op.execute("UPDATE user_profiles SET ai_provider = 'grok' WHERE ai_provider = 'groq'")
    _set_checks("'anthropic','gemini','grok'")
    op.drop_column('user_profiles', 'groq_api_key_set')
