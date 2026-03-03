"""P4 Forecast Result: forecast_result

Creates the table for Phase 4 — AI Forecasting:
- forecast_result: Persisted ML model training metrics

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-03 10:01:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: str | None = "d5e6f7a8b9c0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create P4 forecast result table."""
    op.create_table(
        "forecast_result",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "wind_farm_id",
            sa.Uuid(),
            sa.ForeignKey("wind_farm.id", ondelete="CASCADE"),
            nullable=False,
            comment="Wind farm this forecast was generated for",
        ),
        sa.Column(
            "model_name",
            sa.String(30),
            nullable=False,
            comment="Model type: xgboost, lstm, tft, ensemble",
        ),
        sa.Column(
            "horizon_hours",
            sa.Integer(),
            nullable=False,
            comment="Forecast horizon in hours",
        ),
        sa.Column(
            "rmse_mw",
            sa.Float(),
            nullable=False,
            comment="Root mean square error [MW]",
        ),
        sa.Column(
            "mae_mw",
            sa.Float(),
            nullable=False,
            comment="Mean absolute error [MW]",
        ),
        sa.Column(
            "skill_score",
            sa.Float(),
            nullable=False,
            comment="Skill score vs persistence baseline",
        ),
        sa.Column(
            "parameters_json",
            sa.Text(),
            nullable=False,
            server_default="{}",
            comment="Model hyperparameters as JSON string",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Drop P4 forecast result table."""
    op.drop_table("forecast_result")
