"""P1 initial schema: wind_farm, turbine_position, wind_resource, aep_result

Creates the core tables for Phase 1 — Wind Resource & AEP:
- wind_farm: Farm-level configuration (34 × V236-15.0 MW = 510 MW)
- turbine_position: Per-turbine coordinates in local Cartesian metres
- wind_resource: ERA5 preprocessed time-series at hub height (TimescaleDB-ready)
- aep_result: Annual Energy Production with P50/P75/P90 uncertainty
- per_turbine_aep: Per-turbine AEP breakdown and wake deficit

Revision ID: 1acc76f82174
Revises:
Create Date: 2026-02-23 13:13:00.208938

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1acc76f82174"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create P1 initial schema."""
    # ── wind_farm ──────────────────────────────────────────────────
    op.create_table(
        "wind_farm",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False, comment="Farm centre latitude [deg]"),
        sa.Column("longitude", sa.Float(), nullable=False, comment="Farm centre longitude [deg]"),
        sa.Column(
            "capacity_mw", sa.Float(), nullable=False, comment="Total installed capacity [MW]"
        ),
        sa.Column("num_turbines", sa.Integer(), nullable=False),
        sa.Column("turbine_model", sa.String(100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── turbine_position ───────────────────────────────────────────
    op.create_table(
        "turbine_position",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "turbine_id",
            sa.String(20),
            nullable=False,
            comment="Turbine identifier, e.g. WTG_01",
        ),
        sa.Column("x_m", sa.Float(), nullable=False, comment="Easting from farm origin [m]"),
        sa.Column("y_m", sa.Float(), nullable=False, comment="Northing from farm origin [m]"),
        sa.Column(
            "hub_height_m",
            sa.Float(),
            server_default="150.0",
            nullable=False,
            comment="Hub height above sea level [m]",
        ),
        sa.UniqueConstraint("wind_farm_id", "turbine_id", name="uq_farm_turbine"),
    )

    # ── wind_resource (ERA5 preprocessed time-series) ──────────────
    op.create_table(
        "wind_resource",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "time",
            sa.DateTime(timezone=True),
            nullable=False,
            comment="UTC timestamp of ERA5 record",
        ),
        sa.Column(
            "wind_speed_ms",
            sa.Float(),
            nullable=False,
            comment="Wind speed at hub height [m/s]",
        ),
        sa.Column(
            "wind_direction_deg",
            sa.Float(),
            nullable=False,
            comment="Wind direction (meteorological convention) [deg]",
        ),
        sa.Column(
            "hub_height_m",
            sa.Float(),
            server_default="150.0",
            nullable=False,
            comment="Height of extrapolation [m]",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_wind_resource_farm_time",
        "wind_resource",
        ["wind_farm_id", "time"],
    )

    # ── aep_result ─────────────────────────────────────────────────
    op.create_table(
        "aep_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "aep_p50_gwh",
            sa.Float(),
            nullable=False,
            comment="P50 (median) annual energy production [GWh]",
        ),
        sa.Column(
            "aep_p75_gwh",
            sa.Float(),
            nullable=False,
            comment="P75 exceedance annual energy production [GWh]",
        ),
        sa.Column(
            "aep_p90_gwh",
            sa.Float(),
            nullable=False,
            comment="P90 exceedance annual energy production [GWh]",
        ),
        sa.Column(
            "uncertainty_percent",
            sa.Float(),
            nullable=False,
            comment="Combined RSS uncertainty [%]",
        ),
        sa.Column(
            "wake_loss_percent",
            sa.Float(),
            nullable=False,
            comment="Wake-induced energy loss [%]",
        ),
        sa.Column(
            "blockage_loss_percent",
            sa.Float(),
            nullable=False,
            comment="Blockage effect loss [%]",
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── per_turbine_aep ────────────────────────────────────────────
    op.create_table(
        "per_turbine_aep",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "aep_result_id",
            sa.Uuid(),
            sa.ForeignKey("aep_result.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "turbine_position_id",
            sa.Uuid(),
            sa.ForeignKey("turbine_position.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "aep_gwh",
            sa.Float(),
            nullable=False,
            comment="Individual turbine AEP [GWh]",
        ),
        sa.Column(
            "wake_deficit_percent",
            sa.Float(),
            nullable=False,
            comment="Wake deficit at this turbine [%]",
        ),
    )


def downgrade() -> None:
    """Drop all P1 tables in reverse dependency order."""
    op.drop_table("per_turbine_aep")
    op.drop_table("aep_result")
    op.drop_index("ix_wind_resource_farm_time", table_name="wind_resource")
    op.drop_table("wind_resource")
    op.drop_table("turbine_position")
    op.drop_table("wind_farm")
