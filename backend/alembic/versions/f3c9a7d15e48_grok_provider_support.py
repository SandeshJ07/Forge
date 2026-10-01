"""grok (xAI) provider support

Revision ID: f3c9a7d15e48
Revises: e8b1c4f36a92
Create Date: 2026-10-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3c9a7d15e48'
down_revision: Union[str, None] = 'e8b1c4f36a92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_profiles', sa.Column('grok_api_key_set', sa.Boolean(), server_default='false', nullable=False)
    )
    op.drop_constraint('user_profiles_ai_provider_check', 'user_profiles', type_='check')
    op.create_check_constraint(
        'user_profiles_ai_provider_check', 'user_profiles', "ai_provider in ('anthropic','gemini','grok')"
    )
    op.drop_constraint('integration_tokens_provider_check', 'integration_tokens', type_='check')
    op.create_check_constraint(
        'integration_tokens_provider_check', 'integration_tokens', "provider in ('anthropic', 'gemini', 'grok')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM integration_tokens WHERE provider = 'grok'")
    op.execute("UPDATE user_profiles SET ai_provider = 'anthropic' WHERE ai_provider = 'grok'")
    op.drop_constraint('integration_tokens_provider_check', 'integration_tokens', type_='check')
    op.create_check_constraint(
        'integration_tokens_provider_check', 'integration_tokens', "provider in ('anthropic', 'gemini')"
    )
    op.drop_constraint('user_profiles_ai_provider_check', 'user_profiles', type_='check')
    op.create_check_constraint(
        'user_profiles_ai_provider_check', 'user_profiles', "ai_provider in ('anthropic','gemini')"
    )
    op.drop_column('user_profiles', 'grok_api_key_set')
