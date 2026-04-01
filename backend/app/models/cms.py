"""
Condition Monitoring System (CMS) database models — M12.

Tables
------
cms_measurement : TimescaleDB hypertable — per-component vibration, temp, oil
cms_alert       : Degradation alerts with health index and RUL estimate
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# IEC 61400-4 / ISO 10816-21 health index components
CMS_COMPONENTS: tuple[str, ...] = (
    "MAIN_BEARING",  # Main shaft bearing — most common failure mode
    "GEARBOX",  # Gearbox (not applicable for direct-drive, but V236 uses a gearbox)
    "GENERATOR",  # Generator windings + bearings
    "PITCH",  # Pitch system actuator + bearing
    "YAW",  # Yaw system motor + bearing
)

# Alert levels (loosely follows ISO 13373 vibration severity zones)
ALERT_LEVELS: tuple[str, ...] = (
    "GREEN",  # Normal operation — HI 80–100
    "YELLOW",  # Watch — HI 60–79, schedule inspection at next service
    "AMBER",  # Alert — HI 40–59, inspect within 30 days
    "RED",  # Warning — HI 20–39, inspect within 7 days
    "CRITICAL",  # Danger — HI < 20, immediate shutdown recommended
)


class CMSMeasurement(Base):
    """Per-component CMS measurement snapshot.

    Captured every 10 minutes per turbine × component (34 × 5 = 170 rows
    per 10-minute cycle = ~24,480 rows/day). In production this table
    is a TimescaleDB hypertable partitioned by timestamp_utc.

    Alembic migration must include:
        SELECT create_hypertable('cms_measurement', 'timestamp_utc');
        CREATE INDEX ON cms_measurement (turbine_id, component, timestamp_utc DESC);

    Health Index Definition (IEC 61400-26-2 influenced)
    ------------------------------------------------------
    HI = 100 represents a new component; HI = 0 represents end-of-life.
    The HI is calculated from a weighted combination of:
      - Vibration RMS velocity [mm/s] — ISO 10816-21 severity zones
      - Bearing temperature vs baseline [°C delta]
      - Oil ISO cleanliness code (gearbox only) — ISO 4406
      - Alarm event frequency — rapid degradation indicator

    ISO 10816-21 vibration severity (wind turbines, Class I):
      Zone A (new): v_rms < 2.3 mm/s
      Zone B (acceptable): 2.3–4.5 mm/s
      Zone C (alert): 4.5–7.1 mm/s
      Zone D (danger): > 7.1 mm/s
    """

    __tablename__ = "cms_measurement"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="Sequential measurement ID",
    )
    timestamp_utc: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="UTC measurement timestamp (TimescaleDB partition key)",
    )
    turbine_id: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
        comment="Turbine identifier, e.g. 'WTG-01'",
    )
    component: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
        comment="Component: MAIN_BEARING / GEARBOX / GENERATOR / PITCH / YAW",
    )
    vib_rms_mm_s: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment=(
            "Vibration RMS velocity [mm/s] — ISO 10816-21 severity reference. "
            "Zone A < 2.3, Zone B < 4.5, Zone C < 7.1, Zone D >= 7.1"
        ),
    )
    temp_celsius: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="Component temperature [°C]",
    )
    oil_iso_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="18/16/13",
        comment=(
            "ISO 4406 oil cleanliness code (gearbox only). "
            "Target: <= 16/14/11 for wind turbine gearboxes"
        ),
    )
    health_index: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=100.0,
        comment="Component Health Index 0-100 (100=new, 0=end-of-life)",
    )
    wind_speed_ms: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Wind speed at time of measurement [m/s] — for load-normalisation",
    )


class CMSAlert(Base):
    """CMS degradation alert for one turbine component.

    Created when a component's health index falls below a threshold.
    Resolved when the component is repaired/replaced and HI recovers.

    Remaining Useful Life (RUL) Estimation
    ----------------------------------------
    RUL is estimated by fitting a linear degradation model to the last
    30 days of health index data:
      HI(t) = HI_0 - rate * t
      RUL = HI_current / rate   [days]

    In production, physics-informed machine learning models (LSTM or
    Gaussian Process) replace the linear model for better accuracy at
    the tails of the distribution.
    """

    __tablename__ = "cms_alert"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    turbine_id: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        index=True,
    )
    component: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    alert_level: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="GREEN / YELLOW / AMBER / RED / CRITICAL",
    )
    health_index: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        comment="HI value that triggered the alert",
    )
    rul_days: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=365.0,
        comment="Estimated Remaining Useful Life [days]",
    )
    vib_rms_mm_s: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
        comment="Vibration at time of alert",
    )
    temp_celsius: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Human-readable alert description",
    )
    recommended_action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        comment="Maintenance action recommended",
    )
    resolved: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.now,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
