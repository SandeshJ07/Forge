"""exercise media_urls: every how-to image, not just the first

Revision ID: 9a4e2b7c1d3f
Revises: 7c6c1d3adbe5
Create Date: 2026-09-25 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9a4e2b7c1d3f'
down_revision: Union[str, None] = '7c6c1d3adbe5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'exercises',
        sa.Column('media_urls', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'),
    )
    # free-exercise-db ships a start (0.jpg) and end (1.jpg) position photo per
    # exercise; the seed only kept the first. Rebuild the pair from it so
    # existing databases don't need re-seeding.
    op.execute(
        """
        UPDATE exercises
        SET media_urls = CASE
            WHEN source = 'free-exercise-db' AND media_url LIKE '%/0.jpg'
                THEN ARRAY[media_url, left(media_url, length(media_url) - 5) || '1.jpg']
            ELSE ARRAY[media_url]
        END
        WHERE media_url IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column('exercises', 'media_urls')
