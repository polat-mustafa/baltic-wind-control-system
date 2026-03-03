"""
Forecast result database model (P4).

Tables
------
forecast_result : Persisted ML model training results and metrics
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ForecastResult(Base):
    """Persisted forecast model training result.

    One row per model training run. Stores evaluation metrics
    (RMSE, MAE, skill score) and model parameters as JSON text
    for reproducibility and comparison across experiments.

    Foreign key to wind_farm allows per-farm model tracking.
    """

    __tablename__ = "forecast_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    wind_farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wind_farm.id", ondelete="CASCADE"),
        comment="Wind farm this forecast was generated for",
    )
    model_name: Mapped[str] = mapped_column(
        String(30),
        comment="Model type: xgboost, lstm, tft, ensemble",
    )
    horizon_hours: Mapped[int] = mapped_column(
        Integer,
        comment="Forecast horizon in hours",
    )
    rmse_mw: Mapped[float] = mapped_column(
        Float,
        comment="Root mean square error [MW]",
    )
    mae_mw: Mapped[float] = mapped_column(
        Float,
        comment="Mean absolute error [MW]",
    )
    skill_score: Mapped[float] = mapped_column(
        Float,
        comment="Skill score vs persistence baseline",
    )
    parameters_json: Mapped[str] = mapped_column(
        Text,
        default="{}",
        comment="Model hyperparameters as JSON string",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
