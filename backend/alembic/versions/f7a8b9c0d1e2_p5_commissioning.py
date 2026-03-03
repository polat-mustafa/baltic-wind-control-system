"""P5 Commissioning: switching_programme_record, commissioning_event

Creates the tables for Phase 5 — Commissioning & SAT:
- switching_programme_record: 30-step switching programme audit trail
- commissioning_event: Timestamped event log for FAT/SAT/compliance

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-03-03 10:02:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7a8b9c0d1e2"
down_revision: str | None = "e6f7a8b9c0d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P5 commissioning tables."""
    # ── switching_programme_record ────────────────────────────────
    op.create_table(
        "switching_programme_record",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
            comment="Wind farm this programme belongs to",
        ),
        sa.Column(
            "programme_name",
            sa.String(100),
            nullable=False,
            comment="Human-readable programme identifier",
        ),
        sa.Column(
            "status",
            sa.String(25),
            nullable=False,
            server_default="created",
            comment="Programme status: created, in_progress, completed, aborted",
        ),
        sa.Column(
            "total_steps",
            sa.Integer(),
            nullable=False,
            server_default="30",
            comment="Total number of steps in the programme",
        ),
        sa.Column(
            "completed_steps",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Number of steps completed so far",
        ),
        sa.Column(
            "pic_name",
            sa.String(100),
            nullable=False,
            comment="Person in Control (PiC) for this programme",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=False,
            server_default="",
            comment="Operational notes and observations",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # ── commissioning_event ──────────────────────────────────────
    op.create_table(
        "commissioning_event",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "programme_id",
            sa.Uuid(),
            sa.ForeignKey("switching_programme_record.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_type",
            sa.String(30),
            nullable=False,
            comment="Event category: step_executed, pic_decision, loto, fat, sat, emergency",
        ),
        sa.Column(
            "step_number",
            sa.Integer(),
            nullable=True,
            comment="Switching programme step number (if applicable)",
        ),
        sa.Column(
            "performed_by",
            sa.String(100),
            nullable=False,
            comment="User who performed the action",
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
            comment="Human-readable event description",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop P5 commissioning tables."""
    op.drop_table("commissioning_event")
    op.drop_table("switching_programme_record")
