"""P5: persist compliance campaign and emergency log; FAT equipment class.

Drops protection_grading_result: protection coordination is computed by P2 on
request and was only cached here by a duplicate endpoint.

Revision ID: b7c8d9e0f1a2
Revises: 9bf504953129
Create Date: 2026-10-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b7c8d9e0f1a2"
down_revision: str | Sequence[str] | None = "9bf504953129"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "switching_programme",
        sa.Column("compliance_campaign", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "switching_programme",
        sa.Column("emergency_log", postgresql.JSONB(), nullable=True),
    )
    op.add_column("fat_campaign", sa.Column("equipment_class", sa.String(40), nullable=True))
    op.drop_table("protection_grading_result")


def downgrade() -> None:
    op.create_table(
        "protection_grading_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("results", postgresql.JSONB(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.drop_column("fat_campaign", "equipment_class")
    op.drop_column("switching_programme", "emergency_log")
    op.drop_column("switching_programme", "compliance_campaign")
