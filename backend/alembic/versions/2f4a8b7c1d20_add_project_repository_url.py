"""add repository url to projects

Revision ID: 2f4a8b7c1d20
Revises: 8c7f2e4a1d90
"""

from alembic import op
import sqlalchemy as sa

revision = "2f4a8b7c1d20"
down_revision = "8c7f2e4a1d90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("repository_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "repository_url")
