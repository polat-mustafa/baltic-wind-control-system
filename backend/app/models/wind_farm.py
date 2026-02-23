"""
Wind farm configuration and AEP result models.

Tables
------
wind_farm : Farm-level configuration (34 × V236-15.0 MW = 510 MW)
turbine_position : Per-turbine coordinates in local meters
aep_result : Annual Energy Production with P50/P75/P90 uncertainty
per_turbine_aep : Per-turbine AEP breakdown and wake deficit
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

if TYPE_CHECKING:
    from app.models.wind_resource import WindResource


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
