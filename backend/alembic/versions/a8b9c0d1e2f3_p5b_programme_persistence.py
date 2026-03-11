"""P5b: Programme persistence — switching_programme, fat_campaign, protection_grading_result

Replaces in-memory dicts with PostgreSQL tables using JSONB columns
for nested domain state (steps, LOTO, audit trail, test results).

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-03-10 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a8b9c0d1e2f3"
down_revision: str | None = "f7a8b9c0d1e2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P5 persistence tables."""
    # ── switching_programme ───────────────────────────────────────
    op.create_table(
        "switching_programme",
        sa.Column(
            "programme_id",
            sa.String(100),
            primary_key=True,
            comment="Domain-generated ID",
        ),
        sa.Column(
            "title",
            sa.String(200),
            nullable=False,
            comment="Programme title",
        ),
        sa.Column(
            "pic_name",
            sa.String(100),
            nullable=False,
            comment="Person in Control (PiC)",
        ),
        sa.Column(
            "status",
            sa.String(25),
            nullable=False,
            comment="Lifecycle state",
        ),
        sa.Column(
            "current_step_index",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Next step to execute (0-based)",
        ),
        sa.Column(
            "fat_campaign_id",
            sa.String(100),
            nullable=True,
            comment="Linked FAT campaign ID",
        ),
        sa.Column(
            "steps",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Serialised SwitchingStep list",
        ),
        sa.Column(
            "system_state",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Equipment state map",
        ),
        sa.Column(
            "loto_set",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
            comment="Serialised LOTOSet",
        ),
        sa.Column(
            "audit_trail",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Serialised AuditRecord list",
        ),
        sa.Column(
            "sat_campaign",
            sa.dialects.postgresql.JSONB(),
            nullable=True,
            comment="Serialised SATCampaign",
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

    # ── fat_campaign ──────────────────────────────────────────────
    op.create_table(
        "fat_campaign",
        sa.Column(
            "campaign_id",
            sa.String(100),
            primary_key=True,
            comment="Domain-generated ID",
        ),
        sa.Column(
            "equipment_tag",
            sa.String(100),
            nullable=False,
            comment="Equipment under test",
        ),
        sa.Column(
            "status",
            sa.String(25),
            nullable=False,
            comment="Lifecycle state",
        ),
        sa.Column(
            "specs",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Serialised TestSpecification dict",
        ),
        sa.Column(
            "results",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Serialised TestResult dict",
        ),
        sa.Column(
            "approved_by",
            sa.String(100),
            nullable=False,
            server_default="",
            comment="Approver name",
        ),
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
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

    # ── protection_grading_result ─────────────────────────────────
    op.create_table(
        "protection_grading_result",
        sa.Column(
            "id",
            sa.Uuid(),
            primary_key=True,
        ),
        sa.Column(
            "results",
            sa.dialects.postgresql.JSONB(),
            nullable=False,
            comment="Serialised GradingResult list",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=False,
            server_default="",
            comment="Optional notes",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop P5 persistence tables."""
    op.drop_table("protection_grading_result")
    op.drop_table("fat_campaign")
    op.drop_table("switching_programme")
