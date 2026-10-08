"""
Wind farm configuration and AEP result models.

Tables
------
wind_farm : One row per project. ``data`` holds the whole project (ProjectData,
    schemas/project.py); the scalar columns summarise it for listing and the
    12-month retention purge. The SB-510 row (seed.py) is the read-only reference.
    The row id (uuid4, 122 random bits) is the access key of the anonymous link.
turbine_position : Per-turbine coordinates in local meters (written on every save)
aep_result : Annual Energy Production with P50/P75/P90 uncertainty (one per PyWake run)
per_turbine_aep : Per-turbine AEP breakdown and wake deficit
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.wind_resource import WindResource


def _now() -> datetime:
    return datetime.now(UTC)


class WindFarm(Base):
    """Wind farm specification — one row per farm configuration."""

    __tablename__ = "wind_farm"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(100))
    latitude: Mapped[float] = mapped_column(Float, comment="Farm centre latitude [deg]")
    longitude: Mapped[float] = mapped_column(Float, comment="Farm centre longitude [deg]")
    capacity_mw: Mapped[float] = mapped_column(Float, comment="Total installed capacity [MW]")
    num_turbines: Mapped[int] = mapped_column(Integer)
    turbine_model: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
    data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=True,
        comment="Whole project (ProjectData); NULL for the reference farm",
    )
    schema_version: Mapped[int] = mapped_column(Integer, default=2, server_default="2")
    revision: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1", comment="Optimistic-lock counter"
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        index=True,
        comment="Projects idle for 12 months are deleted",
    )
    is_reference: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", comment="Read-only reference farm"
    )

    # Relationships
    turbine_positions: Mapped[list[TurbinePosition]] = relationship(
        back_populates="wind_farm",
        cascade="all, delete-orphan",
    )
    wind_resources: Mapped[list[WindResource]] = relationship(
        back_populates="wind_farm",
        cascade="all, delete-orphan",
    )
    aep_results: Mapped[list[AEPResult]] = relationship(
        back_populates="wind_farm",
        cascade="all, delete-orphan",
    )


class TurbinePosition(Base):
    """Individual turbine position within a wind farm layout.

    Coordinates are in a local Cartesian system (metres from farm origin).
    """

    __tablename__ = "turbine_position"
    __table_args__ = (UniqueConstraint("wind_farm_id", "turbine_id", name="uq_farm_turbine"),)

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    wind_farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wind_farm.id", ondelete="CASCADE"),
    )
    turbine_id: Mapped[str] = mapped_column(
        String(20),
        comment="Turbine identifier, e.g. WTG_01",
    )
    x_m: Mapped[float] = mapped_column(Float, comment="Easting from farm origin [m]")
    y_m: Mapped[float] = mapped_column(Float, comment="Northing from farm origin [m]")
    hub_height_m: Mapped[float] = mapped_column(
        Float,
        default=150.0,
        comment="Hub height above sea level [m]",
    )

    # Relationships
    wind_farm: Mapped[WindFarm] = relationship(back_populates="turbine_positions")
    per_turbine_aeps: Mapped[list[PerTurbineAEP]] = relationship(
        back_populates="turbine_position",
        cascade="all, delete-orphan",
    )


class AEPResult(Base):
    """Annual Energy Production calculation result with uncertainty bands.

    Every AEP result includes P50/P75/P90 exceedance probabilities —
    this is non-negotiable per Engineering Rule 10.
    """

    __tablename__ = "aep_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    wind_farm_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("wind_farm.id", ondelete="CASCADE"),
    )
    aep_p50_gwh: Mapped[float] = mapped_column(
        Float,
        comment="P50 (median) annual energy production [GWh]",
    )
    aep_p75_gwh: Mapped[float] = mapped_column(
        Float,
        comment="P75 exceedance annual energy production [GWh]",
    )
    aep_p90_gwh: Mapped[float] = mapped_column(
        Float,
        comment="P90 exceedance annual energy production [GWh]",
    )
    uncertainty_percent: Mapped[float] = mapped_column(
        Float,
        comment="Combined RSS uncertainty [%]",
    )
    wake_loss_percent: Mapped[float] = mapped_column(
        Float,
        comment="Wake-induced energy loss [%]",
    )
    blockage_loss_percent: Mapped[float] = mapped_column(
        Float,
        comment="Blockage effect loss [%]",
    )
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
    revision: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="Project revision the run was computed for"
    )
    gross_aep_gwh: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Gross AEP, no losses [GWh]"
    )
    net_aep_gwh: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="AEP after wake loss only [GWh]"
    )
    capacity_factor: Mapped[float | None] = mapped_column(
        Float, nullable=True, comment="Net (wake-only) capacity factor [-]"
    )

    # Relationships
    wind_farm: Mapped[WindFarm] = relationship(back_populates="aep_results")
    per_turbine_aeps: Mapped[list[PerTurbineAEP]] = relationship(
        back_populates="aep_result",
        cascade="all, delete-orphan",
    )


class PerTurbineAEP(Base):
    """Per-turbine AEP breakdown showing individual wake deficit impact."""

    __tablename__ = "per_turbine_aep"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    aep_result_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("aep_result.id", ondelete="CASCADE"),
    )
    turbine_position_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("turbine_position.id", ondelete="CASCADE"),
    )
    aep_gwh: Mapped[float] = mapped_column(
        Float,
        comment="Individual turbine AEP [GWh]",
    )
    wake_deficit_percent: Mapped[float] = mapped_column(
        Float,
        comment="Wake deficit at this turbine [%]",
    )

    # Relationships
    aep_result: Mapped[AEPResult] = relationship(back_populates="per_turbine_aeps")
    turbine_position: Mapped[TurbinePosition] = relationship(
        back_populates="per_turbine_aeps",
    )
