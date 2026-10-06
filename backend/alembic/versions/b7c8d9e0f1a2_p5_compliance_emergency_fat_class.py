"""P5: persist compliance campaign and emergency log; FAT equipment class.

Drops protection_grading_result (protection coordination is computed by P2 on
request and was only cached here by a duplicate endpoint) and the never-used
switching_programme_record / commissioning_event tables (the programme is
persisted in switching_programme).

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
    op.drop_table("commissioning_event")
    op.drop_table("switching_programme_record")


def downgrade() -> None:
    op.create_table(
        "switching_programme_record",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("programme_name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(25), nullable=False, server_default="created"),
        sa.Column("total_steps", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("completed_steps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pic_name", sa.String(100), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "commissioning_event",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "programme_id",
            sa.Uuid(),
            sa.ForeignKey("switching_programme_record.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=True),
        sa.Column("performed_by", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
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
