"""Projects: wind_farm becomes the project table

aep_result gets the project revision, gross / wake-net AEP and CF of each run.
Adds the whole project as JSONB plus revision (optimistic lock), timestamps for
the 12-month retention purge and the read-only reference flag (SB-510 seed row).

Revision ID: c8d9e0f1a2b3
Revises: b7c8d9e0f1a2
Create Date: 2026-10-07 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8d9e0f1a2b3"
down_revision: str | None = "b7c8d9e0f1a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AEP_COLUMNS = (
    ("gross_aep_gwh", "Gross AEP, no losses [GWh]"),
    ("net_aep_gwh", "AEP after wake loss only [GWh]"),
    ("capacity_factor", "Net (wake-only) capacity factor [-]"),
)
REFERENCE_ID = "00000000-0000-4000-a000-000000000001"  # app/seed.py FARM_UUID


def upgrade() -> None:
    op.add_column(
        "wind_farm",
        sa.Column(
            "data",
            postgresql.JSONB(),
            nullable=True,
            comment="Whole project (ProjectData); NULL for the reference farm",
        ),
    )
    op.add_column(
        "wind_farm", sa.Column("schema_version", sa.Integer(), nullable=False, server_default="2")
    )
    op.add_column(
        "wind_farm",
        sa.Column(
            "revision",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Optimistic-lock counter",
        ),
    )
    op.add_column(
        "wind_farm",
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.add_column(
        "wind_farm",
        sa.Column(
            "last_opened_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            comment="Projects idle for 12 months are deleted",
        ),
    )
    op.add_column(
        "wind_farm",
        sa.Column(
            "is_reference",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
            comment="Read-only reference farm",
        ),
    )
    op.add_column(
        "aep_result",
        sa.Column(
            "revision",
            sa.Integer(),
            nullable=True,
            comment="Project revision the run was computed for",
        ),
    )
    for col, comment in AEP_COLUMNS:
        op.add_column("aep_result", sa.Column(col, sa.Float(), nullable=True, comment=comment))
    op.create_index("ix_wind_farm_last_opened_at", "wind_farm", ["last_opened_at"])
    op.execute(
        f"UPDATE wind_farm SET is_reference = true, turbine_model = 'IEA-15-240-RWT' "
        f"WHERE id = '{REFERENCE_ID}'"
    )


def downgrade() -> None:
    for col, _ in AEP_COLUMNS:
        op.drop_column("aep_result", col)
    op.drop_column("aep_result", "revision")
    op.drop_index("ix_wind_farm_last_opened_at", table_name="wind_farm")
    for col in (
        "is_reference",
        "last_opened_at",
        "updated_at",
        "revision",
        "schema_version",
        "data",
    ):
        op.drop_column("wind_farm", col)
