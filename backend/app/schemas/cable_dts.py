"""
Pydantic schemas for Cable DTS Thermal Monitoring — M10.

Distributed Temperature Sensing (DTS) — Raman backscatter fibre optic thermometry:
  Spatial resolution: ~1 m along the cable route
  Temperature resolution: ±0.1 °C
  Measurement interval: 1-10 minutes for 45 km cable

IEC 60287 cable thermal model:
  Steady-state conductor temperature = ambient + W * R_thermal
  W = I² × R_AC  [W/m — conductor losses]
  R_thermal = thermal resistance of insulation + outer sheath + soil/sea [K·m/W]

IEC 62067 — 220 kV XLPE cable operating limits:
  Normal: 90 °C conductor
  Emergency: 105 °C (short duration)
  Static rating: 950 A per circuit (EXPORT_CABLE_1000: 1000 mm² Cu, 2 circuits)
  Dynamic rating: ~905 A (22 °C summer) to ~1017 A (4 °C winter) per circuit
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DTSProfilePoint(BaseModel):
    """Single temperature point at a given position along the cable."""

    distance_km: float = Field(description="Distance from OSS [km]")
    temperature_c: float = Field(description="Conductor temperature [degC]")
    loading_percent: float = Field(description="% of static thermal rating")
    is_hotspot: bool = Field(description="True if temp exceeds hotspot threshold")


class DTSProfileResponse(BaseModel):
    """Full DTS temperature profile along the export cable (450 points for 45 km)."""

    current_a: float = Field(description="Cable current [A] used in simulation")
    ambient_temp_c: float = Field(description="Ambient (sea/soil) temperature [degC]")
    cable_length_km: float
    n_points: int = Field(description="Number of measurement points")
    profile: list[DTSProfilePoint]
    max_temp_c: float = Field(description="Maximum temperature along cable [degC]")
    max_temp_location_km: float = Field(
        description="Distance from OSS where maximum temperature occurs [km]",
    )
    hotspot_count: int = Field(description="Number of hotspot segments (>70 degC)")
    static_rating_a: float = Field(description="IEC 60287 static thermal rating [A]")
    assessment: str


class HotspotAlert(BaseModel):
    """Active DTS hotspot along the cable route."""

    distance_km: float
    temperature_c: float
    loading_percent: float
    severity: str = Field(description="WARNING (>70 degC) or CRITICAL (>90 degC)")
    cause: str = Field(description="Likely cause: burial depth, soil drying, high current")


class HotspotResponse(BaseModel):
    """All active hotspot alerts along the cable."""

    current_a: float
    hotspots: list[HotspotAlert]
    hotspot_count: int
    max_severity: str = Field(description="NORMAL / WARNING / CRITICAL")
    assessment: str


class DynamicRatingResponse(BaseModel):
    """Real-time dynamic thermal rating vs static rating."""

    current_a: float = Field(description="Present cable current [A]")
    ambient_temp_c: float = Field(description="Ambient temperature [degC]")
    static_rating_a: float = Field(description="IEC 60287 static rating [A]")
    dynamic_rating_a: float = Field(
        description=(
            "Dynamic rating based on real-time thermal state [A]. "
            "Winter/cool soil: may exceed static. "
            "Summer/warm: may be below static."
        ),
    )
    headroom_a: float = Field(description="dynamic_rating - current_a [A available]")
    headroom_pct: float = Field(description="Headroom as % of dynamic rating")
    thermal_utilisation_pct: float = Field(
        description="current / dynamic_rating * 100",
    )
    assessment: str


class DTSSimulationRequest(BaseModel):
    """Parameters for DTS temperature profile simulation."""

    current_a: float = Field(
        default=650.0,
        ge=0.0,
        le=1500.0,
        description="Per-circuit current [A]. Static rating = 950 A (≈ 730 A at 510 MW).",
    )
    ambient_temp_c: float = Field(
        default=10.0,
        ge=-5.0,
        le=35.0,
        description="Ambient (sea/soil) temperature [degC]",
    )
