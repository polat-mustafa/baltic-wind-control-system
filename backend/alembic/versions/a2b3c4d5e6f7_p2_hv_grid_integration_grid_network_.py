"""P2 HV Grid Integration: grid_network, load_flow_result, short_circuit_result

Creates the core tables for Phase 2 — HV Grid Integration (steady-state):
- grid_network: Network configuration (base MVA, strings, export length, grid Ssc)
- load_flow_result: Persisted load flow scenario results (v_min, v_max, loss, compliance)
- short_circuit_result: Persisted IEC 60909 short-circuit results (Ik'', breaker adequacy)

Revision ID: a2b3c4d5e6f7
Revises: 1acc76f82174
Create Date: 2026-02-24 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "1acc76f82174"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create P2 HV Grid Integration tables."""
    # ── grid_network ────────────────────────────────────────────────
    op.create_table(
        "grid_network",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "name", sa.String(100), nullable=False, comment="Network configuration name"
        ),
        sa.Column(
            "base_mva",
            sa.Float(),
            server_default="100.0",
            nullable=False,
            comment="System base power [MVA] — Rule 2: per-unit consistent",
        ),
        sa.Column(
            "num_strings",
            sa.Integer(),
            server_default="6",
            nullable=False,
            comment="Number of array cable strings",
        ),
        sa.Column(
            "export_length_km",
            sa.Float(),
            server_default="45.0",
            nullable=False,
            comment="Export cable length [km]",
        ),
        sa.Column(
            "grid_ssc_mva",
            sa.Float(),
            server_default="10000.0",
            nullable=False,
            comment="Grid short-circuit power at PCC [MVA]",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── load_flow_result ────────────────────────────────────────────
    op.create_table(
        "load_flow_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "scenario",
            sa.String(20),
            nullable=False,
            comment="Load flow scenario: full_load, partial_load, no_load, n_minus_1",
        ),
        sa.Column(
            "converged",
            sa.Boolean(),
            nullable=False,
            comment="Newton-Raphson convergence status",
        ),
        sa.Column(
            "v_min_pu",
            sa.Float(),
            nullable=False,
            comment="Minimum bus voltage [p.u.]",
        ),
        sa.Column(
            "v_max_pu",
            sa.Float(),
            nullable=False,
            comment="Maximum bus voltage [p.u.]",
        ),
        sa.Column(
            "total_loss_mw",
            sa.Float(),
            nullable=False,
            comment="Total network active power losses [MW]",
        ),
        sa.Column(
            "voltage_compliant",
            sa.Boolean(),
            nullable=False,
            comment="True if all buses within 0.95–1.05 pu",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_load_flow_result_network_scenario",
        "load_flow_result",
        ["grid_network_id", "scenario"],
    )

    # ── short_circuit_result ────────────────────────────────────────
    op.create_table(
        "short_circuit_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "grid_network_id",
            sa.Uuid(),
            sa.ForeignKey("grid_network.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "case",
            sa.String(10),
            nullable=False,
            comment="'max' (c=1.1) or 'min' (c=0.95)",
        ),
        sa.Column(
            "voltage_factor_c",
            sa.Float(),
            nullable=False,
            comment="IEC 60909 voltage factor c",
        ),
        sa.Column(
            "max_ikss_ka",
            sa.Float(),
            nullable=False,
            comment="Highest Ik'' across all buses [kA]",
        ),
        sa.Column(
            "max_ikss_bus",
            sa.String(50),
            nullable=False,
            comment="Bus name with highest Ik''",
        ),
        sa.Column(
            "breaker_adequate",
            sa.Boolean(),
            nullable=False,
            comment="True if Ik'' within breaker rated breaking capacity",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop all P2 tables in reverse dependency order."""
    op.drop_table("short_circuit_result")
    op.drop_index("ix_load_flow_result_network_scenario", table_name="load_flow_result")
    op.drop_table("load_flow_result")
    op.drop_table("grid_network")
