"""add ai provider and model tables

Revision ID: 8c7f2e4a1d90
Revises: e49efc5043ed
Create Date: 2026-10-09 01:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c7f2e4a1d90"
down_revision: Union[str, Sequence[str], None] = "e49efc5043ed"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_providers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=100), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("auth_type", sa.String(length=50), nullable=False),
        sa.Column("encrypted_credentials", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "connection_status",
            sa.String(length=30),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_providers_owner_id", "ai_providers", ["owner_id"], unique=False
    )

    op.create_table(
        "ai_models",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider_id", sa.Uuid(), nullable=False),
        sa.Column("model_id", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("max_output_tokens", sa.Integer(), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=True),
        sa.Column("limits", sa.JSON(), nullable=True),
        sa.Column("availability", sa.String(length=30), nullable=False, server_default="unknown"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["provider_id"], ["ai_providers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_models_provider_id", "ai_models", ["provider_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_ai_models_provider_id", table_name="ai_models")
    op.drop_table("ai_models")
    op.drop_index("ix_ai_providers_owner_id", table_name="ai_providers")
    op.drop_table("ai_providers")
