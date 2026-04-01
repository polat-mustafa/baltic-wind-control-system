"""
Multi-farm configuration and comparison database models — M04.

Tables
------
farm_configuration : User-defined farm design parameter set
comparison_result  : Cached results of a multi-farm comparison study
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class FarmConfiguration(Base):
    """A parameterised wind farm design configuration.

    Users can create multiple configurations with different turbine models,
    array voltages, export cable lengths, STATCOM capacities, or BESS sizes
    and then compare their AEP, LCOE, and grid performance side-by-side.

    The Baltic Wind Alpha reference design is hardcoded in the application
    (V236-15.0 MW × 34, 66 kV array, 220 kV export, 45 km). Any parameter
    can be varied in a comparison configuration.

    LCOE Model
    ----------
    LCOE = (CAPEX + NPV(OPEX)) / NPV(AEP)

    Simplified fixed-charge-rate model:
      FCR = discount_rate / (1 - (1+discount_rate)^(-lifetime_years))
      LCOE = (CAPEX × FCR + annual_OPEX) / annual_AEP

    Reference values (2025, European offshore):
      CAPEX: €1.8–2.4M/MW (foundation, turbine, array cable, OSS, export)
      OPEX: €50–80k/MW/year
      LCOE: €60–100/MWh (15 MW class, Baltic Sea)
    """

    __tablename__ = "farm_configuration"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="User-defined configuration name, e.g. 'Baltic Alpha v2 — BESS added'",
    )
    turbine_model: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="V236-15.0",
        comment="Turbine model designation, e.g. 'V236-15.0', 'SG-14-236', 'Haliade-X-15'",
    )
    turbine_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=34,
        comment="Number of wind turbines",
    )
    turbine_rated_mw: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=15.0,
        comment="Single turbine rated power [MW]",
    )
    array_voltage_kv: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=66.0,
        comment="Array cable voltage [kV]: 33, 66, or 132 kV",
    )
    export_voltage_kv: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=220.0,
        comment="Export cable voltage [kV]: 220 or 400 kV HVAC, or 320 kV HVDC",
    )
    export_length_km: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=45.0,
        comment="Export cable length [km]",
    )
    statcom_mvar: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=120.0,
        comment="STATCOM rated capacity [MVAR] (0 = no STATCOM)",
    )
    bess_mw: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="BESS power rating [MW] (0 = no BESS)",
    )
    bess_mwh: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="BESS energy capacity [MWh] (0 = no BESS)",
    )
    mean_wind_speed_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=9.5,
        comment="Site mean wind speed at hub height [m/s]",
    )
    weibull_k: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=2.2,
        comment="Weibull shape parameter k (dimensionless)",
    )
    availability_pct: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=95.0,
        comment="Target technical availability [%]",
    )
    capex_m_eur_per_mw: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=2.1,
        comment="CAPEX [M€/MW installed]",
    )
    opex_k_eur_per_mw_year: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=65.0,
        comment="Annual OPEX [k€/MW/year]",
    )
    discount_rate_pct: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=6.0,
        comment="Weighted average cost of capital (WACC) [%]",
    )
    lifetime_years: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=25,
        comment="Project economic lifetime [years]",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Free-text description of this configuration",
    )
    created_by: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="user",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )


class ComparisonResult(Base):
    """Cached multi-farm comparison study result.

    Stores the computed AEP, LCOE, and grid metric results for a set
    of farm configurations so they can be retrieved without re-running
    the full calculation.
    """

    __tablename__ = "comparison_result"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    farm_ids: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="JSON array of FarmConfiguration UUIDs included in this comparison",
    )
    aep_results: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
        comment="JSON: {farm_id: {gross_gwh, net_gwh, p50_gwh, p90_gwh}}",
    )
    lcoe_results: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
        comment="JSON: {farm_id: {lcoe_eur_per_mwh, capex_meur, opex_meur_year, irr_pct}}",
    )
    grid_results: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
        comment="JSON: {farm_id: {cable_losses_pct, reactive_available_mvar, utilization_pct}}",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
