"""Switching programme stores the farm it was created for

The programme's equipment, steps and load flow follow ``FarmSpec``; NULL is
the SB-510 reference farm.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-10-07 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d9e0f1a2b3c4"
down_revision: str | None = "c8d9e0f1a2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "switching_programme",
        sa.Column(
            "farm_spec",
            postgresql.JSONB(),
            nullable=True,
            comment="FarmSpec of the farm (p2.network_model); NULL = SB-510",
        ),
    )


def downgrade() -> None:
    op.drop_column("switching_programme", "farm_spec")
