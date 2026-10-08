"""
Pydantic schemas for the Condition Monitoring System API — M12.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Component health ──────────────────────────────────────────────


class ComponentHealthSchema(BaseModel):
    """Health status of one turbine component."""

    component: str = Field(description="MAIN_BEARING / REAR_BEARING / GENERATOR / PITCH / YAW")
    health_index: float = Field(description="0-100 (100=new, 0=end-of-life)")
    alert_level: str = Field(description="GREEN / YELLOW / AMBER / RED / CRITICAL")
    vib_rms_mm_s: float = Field(description="Vibration RMS velocity [mm/s] (ISO 10816-3 zones)")
    temp_celsius: float = Field(description="Component temperature [°C]")
    oil_iso_code: str = Field(
        description="ISO 4406 cleanliness code (meaningful for the hydraulic PITCH unit)"
    )
    rul_days: float = Field(description="Estimated Remaining Useful Life [days]")
    last_updated: datetime | None = None


class TurbineHealthResponse(BaseModel):
    """Full health status for one turbine — all 5 components."""

    turbine_id: str
    overall_health_index: float = Field(
        description="Minimum HI across all components (worst component dominates)"
    )
    overall_alert_level: str
    components: list[ComponentHealthSchema]
    active_alerts: int
    last_updated: datetime | None = None


class FleetHealthResponse(BaseModel):
    """Fleet-wide health overview for every turbine of the farm (SB-510: 34)."""

    turbines: list[TurbineHealthSummary]
    fleet_average_hi: float
    turbines_in_warning: int = Field(description="Turbines with any RED or CRITICAL component")
    turbines_in_alert: int = Field(description="Turbines with any AMBER component")
    active_alerts_total: int
    timestamp_utc: datetime


class TurbineHealthSummary(BaseModel):
    """Compact health summary for fleet overview map."""

    turbine_id: str
    overall_health_index: float
    overall_alert_level: str
    worst_component: str
    active_alerts: int
    component_health: dict[str, float] = Field(
        default_factory=dict, description="Health index per component (heatmap row)"
    )


# ── Vibration spectrum ────────────────────────────────────────────


class FFTPoint(BaseModel):
    """A single frequency-amplitude point in an FFT spectrum."""

    frequency_hz: float
    amplitude_mm_s: float


class VibrationSpectrumResponse(BaseModel):
    """Velocity spectrum of one drivetrain component with its kinematic fault frequencies.

    Main/rear bearing BPFO/BPFI, generator electrical lines (f_e, 2·f_e, slot pass),
    1×/2× running speed and bearing frequencies — see services/p3/cms.py.
    """

    turbine_id: str
    component: str
    timestamp_utc: datetime
    points: list[FFTPoint] = Field(
        description="400 lines: 0-12 Hz for the main bearings, 0-40 Hz for the generator"
    )
    dominant_frequency_hz: float = Field(description="Frequency of highest amplitude peak")
    dominant_amplitude_mm_s: float
    overall_rms_mm_s: float = Field(description="Overall velocity RMS √Σa² [mm/s]")
    resolution_hz: float = Field(description="Line spacing Δf [Hz]")
    fault_frequency_markers: list[dict[str, float | str]] = Field(
        default_factory=list,
        description="Known fault frequencies to overlay: [{freq_hz: float, label: str}]",
    )


# ── Oil analysis ──────────────────────────────────────────────────


class OilAnalysisPoint(BaseModel):
    """One historical oil analysis data point."""

    timestamp_utc: datetime
    iso_code: str = Field(description="ISO 4406 code, e.g. '18/16/13'")
    particle_count_4um: int
    particle_count_6um: int
    particle_count_14um: int
    viscosity_cst: float = Field(description="Kinematic viscosity at 40°C [cSt]")
    water_ppm: float = Field(description="Water content [ppm] — limit: < 200 ppm")


class OilAnalysisResponse(BaseModel):
    """Hydraulic (pitch/brake) oil analysis trend data — the turbine has no gearbox."""

    turbine_id: str
    component: str
    history: list[OilAnalysisPoint]
    current_iso_code: str
    target_iso_code: str = Field(
        default="16/14/11",
        description="Target ISO 4406 code for the hydraulic system",
    )
    water_ingress_alert: bool = Field(description="True if water content > 200 ppm")
    next_oil_change_recommendation: str


# ── Alerts ────────────────────────────────────────────────────────


class CMSAlertResponse(BaseModel):
    """A CMS degradation alert."""

    id: uuid.UUID
    turbine_id: str
    component: str
    alert_level: str
    health_index: float
    rul_days: float
    vib_rms_mm_s: float
    temp_celsius: float
    description: str
    recommended_action: str
    resolved: bool
    created_at: datetime
    resolved_at: datetime | None = None


# ── Fault injection ───────────────────────────────────────────────


class FaultInjectionRequest(BaseModel):
    """Request to inject a simulated degradation scenario.

    Used in training scenarios to demonstrate how CMS detects early
    degradation before catastrophic failure. The injected fault
    causes the health index to decrease according to a realistic
    degradation curve.
    """

    component: str = Field(
        description="Component to degrade: MAIN_BEARING / REAR_BEARING / GENERATOR / PITCH / YAW"
    )
    severity: str = Field(
        description="Degradation severity: MINOR / MODERATE / SEVERE",
        examples=["MODERATE"],
    )
    degradation_rate: float | None = Field(
        default=None,
        ge=0.1,
        le=10.0,
        description=(
            "Health index points lost per day. Auto-calculated from severity if not supplied. "
            "MINOR=0.5/day, MODERATE=2.0/day, SEVERE=5.0/day"
        ),
    )


class FaultInjectionResponse(BaseModel):
    """Result of a fault injection."""

    turbine_id: str
    component: str
    severity: str
    degradation_rate_per_day: float
    initial_health_index: float
    current_health_index: float
    estimated_days_to_amber: float
    estimated_days_to_red: float
    estimated_days_to_critical: float
    message: str
