"""
SQLAlchemy models for BESS (Battery Energy Storage System) — M08.

TimescaleDB hypertable: bess_state_log (time-series SOC/power).
"""

from __future__ import annotations

import uuid as _uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BESSStateLog(Base):
    """
    Time-series BESS operating state — TimescaleDB hypertable.

    Alembic migration must call:
        SELECT create_hypertable('bess_state_log', 'timestamp_utc');

    Columns
    -------
    id              BIGSERIAL — unique row identifier
    timestamp_utc   TIMESTAMPTZ — hypertable partition key
    soc_percent     State of Charge [0–100 %]
    power_mw        Active power (+charging, -discharging) [MW]
    reactive_mvar   Reactive power injection [MVAR]
    mode            Operating mode (see BESSMode enum)
    temperature_c   Rack average temperature [°C]
    voltage_v       DC bus voltage [V]
    current_a       DC bus current [A]
    soh_percent     State of Health (capacity relative to nameplate) [%]
    cycle_count     Cumulative equivalent full cycles (EFC)
    capacity_fade_pct Capacity reduction from beginning-of-life [%]
    alarms_active   True if any alarm is active
    """

    __tablename__ = "bess_state_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp_utc: Mapped[datetime] = mapped_column(nullable=False, index=True)
    soc_percent: Mapped[float] = mapped_column(Float, nullable=False)
    power_mw: Mapped[float] = mapped_column(Float, nullable=False)
    reactive_mvar: Mapped[float] = mapped_column(Float, default=0.0)
    mode: Mapped[str] = mapped_column(String(30), nullable=False)
    temperature_c: Mapped[float] = mapped_column(Float, default=25.0)
    voltage_v: Mapped[float] = mapped_column(Float, default=1500.0)
    current_a: Mapped[float] = mapped_column(Float, default=0.0)
    soh_percent: Mapped[float] = mapped_column(Float, default=100.0)
    cycle_count: Mapped[int] = mapped_column(Integer, default=0)
    capacity_fade_pct: Mapped[float] = mapped_column(Float, default=0.0)
    alarms_active: Mapped[bool] = mapped_column(Boolean, default=False)


class BESSConfiguration(Base):
    """
    BESS nameplate and configuration parameters.

    One row per physical BESS installation (only one for Baltic Wind).
    """

    __tablename__ = "bess_configuration"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, default="Baltic Wind BESS")
    rated_power_mw: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    rated_energy_mwh: Mapped[float] = mapped_column(Float, nullable=False, default=200.0)
    # C-rate = rated_power_mw / rated_energy_mwh = 0.25 for 50MW/200MWh
    chemistry: Mapped[str] = mapped_column(
        String(30), nullable=False, default="LFP"
    )  # LFP = LiFePO4 (safe, long-cycle)
    manufacturer: Mapped[str] = mapped_column(String(100), default="CATL/BYD/Saft")
    commissioning_year: Mapped[int] = mapped_column(Integer, default=2026)
    design_lifetime_years: Mapped[int] = mapped_column(Integer, default=20)
    # LFP cycle life: ~3000 cycles to 80% SOH at 80% DoD
    design_cycle_count: Mapped[int] = mapped_column(Integer, default=3000)
    roundtrip_efficiency_pct: Mapped[float] = mapped_column(Float, default=92.0)
    # Operating window (avoid < 10% and > 90% to reduce degradation)
    soc_min_pct: Mapped[float] = mapped_column(Float, default=10.0)
    soc_max_pct: Mapped[float] = mapped_column(Float, default=90.0)
    # FFR/FCR response time
    response_time_ms: Mapped[float] = mapped_column(Float, default=200.0)
