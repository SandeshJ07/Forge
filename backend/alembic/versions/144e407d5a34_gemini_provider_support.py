"""gemini provider support

Revision ID: 144e407d5a34
Revises: 5d01c5e0e54d
Create Date: 2026-09-24 21:58:14.345992

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '144e407d5a34'
down_revision: Union[str, None] = '5d01c5e0e54d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_profiles', sa.Column('ai_provider', sa.String(), server_default='anthropic', nullable=False))
    op.add_column('user_profiles', sa.Column('gemini_api_key_set', sa.Boolean(), server_default='false', nullable=False))
    op.create_check_constraint(
        'user_profiles_ai_provider_check', 'user_profiles', "ai_provider in ('anthropic','gemini')"
    )
    # Autogenerate doesn't see check-constraint edits: widen the token provider list by hand.
    op.drop_constraint('integration_tokens_provider_check', 'integration_tokens', type_='check')
    op.create_check_constraint(
        'integration_tokens_provider_check', 'integration_tokens', "provider in ('anthropic', 'gemini')"
    )


def downgrade() -> None:
    op.execute("DELETE FROM integration_tokens WHERE provider = 'gemini'")
    op.drop_constraint('integration_tokens_provider_check', 'integration_tokens', type_='check')
    op.create_check_constraint('integration_tokens_provider_check', 'integration_tokens', "provider = 'anthropic'")
    op.drop_constraint('user_profiles_ai_provider_check', 'user_profiles', type_='check')
    op.drop_column('user_profiles', 'gemini_api_key_set')
    op.drop_column('user_profiles', 'ai_provider')
