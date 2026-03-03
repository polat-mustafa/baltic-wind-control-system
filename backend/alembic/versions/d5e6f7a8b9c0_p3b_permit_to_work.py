"""P3b Permit-to-Work: permit_to_work, ptw_transition_log

Creates the tables for Phase 3b — Permit-to-Work lifecycle:
- permit_to_work: 9-state PtW lifecycle records
- ptw_transition_log: Append-only audit trail (IEC 62443)

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-03 10:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5e6f7a8b9c0"
down_revision: str | None = "c4d5e6f7a8b9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P3b Permit-to-Work tables."""
    # ── permit_to_work ───────────────────────────────────────────
    op.create_table(
        "permit_to_work",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "ptw_number",
            sa.String(30),
            unique=True,
            nullable=False,
            comment="Human-readable permit number: BWA-PTW-{YEAR}-{SEQ:05d}",
        ),
        sa.Column(
            "status",
            sa.String(25),
            nullable=False,
            server_default="requested",
            comment="Current lifecycle state (see PermitStatus enum)",
        ),
        sa.Column(
            "work_description",
            sa.Text(),
            nullable=False,
            comment="Description of the work to be performed",
        ),
        sa.Column(
            "equipment_id",
            sa.String(50),
            nullable=False,
            comment="Equipment identifier (IED name, bay, cable section)",
        ),
        sa.Column(
            "risk_level",
            sa.String(10),
            nullable=True,
            comment="Risk severity: low, medium, high, critical",
        ),
        sa.Column(
            "risk_categories",
            sa.Text(),
            nullable=True,
            comment="Comma-separated risk categories",
        ),
        sa.Column(
            "control_measures",
            sa.Text(),
            nullable=True,
            comment="Hazard control measures description",
        ),
        sa.Column(
            "requested_by",
            sa.String(100),
            nullable=False,
            comment="User who created the permit request",
        ),
        sa.Column(
            "person_in_charge",
            sa.String(100),
            nullable=False,
            server_default="",
            comment="Person in Charge (PiC) responsible for work party",
        ),
        sa.Column(
            "approved_by",
            sa.String(100),
            nullable=True,
            comment="Senior operator who approved the permit",
        ),
        sa.Column(
            "valid_from",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="Start of 12-hour validity window (set at ACTIVE)",
        ),
        sa.Column(
            "valid_until",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="End of 12-hour validity window",
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
        sa.CheckConstraint(
            "status IN ('requested', 'risk_assessed', 'approved', "
            "'isolation_confirmed', 'loto_applied', 'active', "
            "'work_complete', 'loto_removed', 'closed', 'cancelled')",
            name="ck_ptw_valid_status",
        ),
    )

    # ── ptw_transition_log ───────────────────────────────────────
    op.create_table(
        "ptw_transition_log",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "permit_id",
            sa.Uuid(),
            sa.ForeignKey("permit_to_work.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_status",
            sa.String(25),
            nullable=False,
            comment="State before the transition",
        ),
        sa.Column(
            "to_status",
            sa.String(25),
            nullable=False,
            comment="State after the transition",
        ),
        sa.Column(
            "performed_by",
            sa.String(100),
            nullable=False,
            comment="User who performed the transition",
        ),
        sa.Column(
            "user_level",
            sa.Integer(),
            nullable=False,
            comment="RBAC level of the user (1-5)",
        ),
        sa.Column(
            "notes",
            sa.Text(),
            nullable=False,
            server_default="",
            comment="Optional notes or justification",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop P3b Permit-to-Work tables."""
    op.drop_table("ptw_transition_log")
    op.drop_table("permit_to_work")
