"""P2B Dynamic Compliance: frt_simulation_result, frequency_response_result,
sso_screening_result, dynamic_compliance_result

Creates the tables for Phase 2B — Dynamic Grid Compliance:
- frt_simulation_result: LVRT/HVRT fault ride-through simulation results
- frequency_response_result: NC RfG frequency response results (LFSM-O/U, FSM, RoCoF)
- sso_screening_result: Sub-synchronous oscillation screening results
- dynamic_compliance_result: Overall NC RfG Type D dynamic compliance verdict

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-02-25 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b3c4d5e6f7a8"
down_revision: str | Sequence[str] | None = "a2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P2B Dynamic Compliance tables."""
    # ── frt_simulation_result ────────────────────────────────────
    op.create_table(
        "frt_simulation_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "frt_type",
            sa.String(10),
            nullable=False,
            comment="'lvrt' or 'hvrt'",
        ),
        sa.Column(
            "stayed_connected",
            sa.Boolean(),
            nullable=False,
            comment="True if WTGs remained connected throughout fault",
        ),
        sa.Column(
            "reactive_current_compliant",
            sa.Boolean(),
            nullable=False,
            comment="True if dIq >= 2% x dV per NC RfG",
        ),
        sa.Column(
            "reactive_current_gain",
            sa.Float(),
            nullable=False,
            comment="Achieved Kqv gain [%Iq / %ΔV]",
        ),
        sa.Column(
            "recovery_time_s",
            sa.Float(),
            nullable=False,
            comment="Time to recover ≥90% active power after fault clearance [s]",
        ),
        sa.Column(
            "statcom_peak_q_mvar",
            sa.Float(),
            nullable=False,
            comment="Peak STATCOM reactive power during fault [MVAR]",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_frt_simulation_result_network_type",
        "frt_simulation_result",
        ["grid_network_id", "frt_type"],
    )

    # ── frequency_response_result ────────────────────────────────
    op.create_table(
        "frequency_response_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "mode",
            sa.String(20),
            nullable=False,
            comment="Frequency response mode: lfsm_o, lfsm_u, fsm, rocof",
        ),
        sa.Column(
            "frequency_step_hz",
            sa.Float(),
            nullable=False,
            comment="Applied frequency deviation [Hz]",
        ),
        sa.Column(
            "droop_percent",
            sa.Float(),
            nullable=False,
            comment="Droop setting [%] (R = 5% default)",
        ),
        sa.Column(
            "power_change_mw",
            sa.Float(),
            nullable=False,
            comment="Measured active power change [MW]",
        ),
        sa.Column(
            "compliant",
            sa.Boolean(),
            nullable=False,
            comment="True if response meets NC RfG Type D requirements",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_frequency_response_result_network_mode",
        "frequency_response_result",
        ["grid_network_id", "mode"],
    )

    # ── sso_screening_result ─────────────────────────────────────
    op.create_table(
        "sso_screening_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "resonance_frequency_hz",
            sa.Float(),
            nullable=False,
            comment="Cable LC resonance frequency [Hz]",
        ),
        sa.Column(
            "phase_margin_deg",
            sa.Float(),
            nullable=False,
            comment="Impedance phase margin at resonance [deg]",
        ),
        sa.Column(
            "stable",
            sa.Boolean(),
            nullable=False,
            comment="True if Re{Z(jω)} > 0 for all sub-synchronous frequencies",
        ),
        sa.Column(
            "risk_level",
            sa.String(10),
            nullable=False,
            comment="SSO risk: 'low', 'medium', or 'high'",
        ),
        sa.Column(
            "minimum_damping_ratio",
            sa.Float(),
            nullable=False,
            comment="Minimum damping ratio of sub-synchronous eigenvalue modes",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── dynamic_compliance_result ────────────────────────────────
    op.create_table(
        "dynamic_compliance_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lvrt_compliant",
            sa.Boolean(),
            nullable=False,
            comment="LVRT stayed connected + reactive current + recovery",
        ),
        sa.Column(
            "hvrt_compliant",
            sa.Boolean(),
            nullable=False,
            comment="HVRT stayed connected at 1.25 pu for 100 ms",
        ),
        sa.Column(
            "lfsm_o_compliant",
            sa.Boolean(),
            nullable=False,
            comment="LFSM-O: power reduction above 50.2 Hz",
        ),
        sa.Column(
            "lfsm_u_compliant",
            sa.Boolean(),
            nullable=False,
            comment="LFSM-U: power increase below 49.8 Hz",
        ),
        sa.Column(
            "fsm_compliant",
            sa.Boolean(),
            nullable=False,
            comment="FSM: droop response within tolerance",
        ),
        sa.Column(
            "rocof_compliant",
            sa.Boolean(),
            nullable=False,
            comment="RoCoF: withstand 2 Hz/s for 500 ms",
        ),
        sa.Column(
            "sso_stable",
            sa.Boolean(),
            nullable=False,
            comment="SSO: no unstable sub-synchronous modes",
        ),
        sa.Column(
            "overall_compliant",
            sa.Boolean(),
            nullable=False,
            comment="True only if ALL individual checks pass",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop all P2B tables in reverse dependency order."""
    op.drop_table("dynamic_compliance_result")
    op.drop_table("sso_screening_result")
    op.drop_index(
        "ix_frequency_response_result_network_mode",
        table_name="frequency_response_result",
    )
    op.drop_table("frequency_response_result")
    op.drop_index(
        "ix_frt_simulation_result_network_type",
        table_name="frt_simulation_result",
    )
    op.drop_table("frt_simulation_result")
