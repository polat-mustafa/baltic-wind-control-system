"""
Wind resource time-series model for ERA5 preprocessed data.

This table stores hourly wind speed and direction at hub height,
after u/v decomposition and shear extrapolation from ERA5 100m data.

Designed for TimescaleDB hypertable conversion on the `time` column
for efficient time-range queries over 20+ years of data.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.wind_farm import WindFarm


class WindResource(Base):
    """Preprocessed ERA5 wind resource time-series at hub height.

    One row per hour per farm — 20 years × 8760 hours ≈ 175,200 rows per farm.
    """

    __tablename__ = "wind_resource"
    __table_args__ = (Index("ix_wind_resource_farm_time", "wind_farm_id", "time"),)

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    wind_farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wind_farm.id", ondelete="CASCADE"),
    )
    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        comment="UTC timestamp of ERA5 record",
    )
    wind_speed_ms: Mapped[float] = mapped_column(
        Float,
        comment="Wind speed at hub height [m/s]",
    )
    wind_direction_deg: Mapped[float] = mapped_column(
        Float,
        comment="Wind direction (meteorological convention) [deg]",
    )
    hub_height_m: Mapped[float] = mapped_column(
        Float,
        default=150.0,
        comment="Height of extrapolation [m]",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )

    # Relationships
    wind_farm: Mapped[WindFarm] = relationship(back_populates="wind_resources")
