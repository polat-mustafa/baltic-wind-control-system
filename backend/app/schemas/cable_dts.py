"""
Pydantic schemas for cable DTS thermal monitoring — M10.

One circuit of the 220 kV export cable (1000 mm² Cu XLPE, 950 A static
rating, 2 circuits). DTS reads the fibre; the conductor temperature is an
estimate from the fibre reading, the current and the thermal model.
Continuous conductor limit 90 °C (XLPE, IEC 62067).
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DTSProfilePoint(BaseModel):
    distance_km: float = Field(description="Distance from the OSS [km]")
    zone: str
    fibre_temp_c: float = Field(description="DTS fibre reading [°C]")
    conductor_temp_c: float = Field(description="Conductor estimate from the fibre [°C]")


class DTSZone(BaseModel):
    name: str
    start_km: float
    end_km: float
    r_ext_k_m_per_w: float = Field(description="Fibre → ambient, per conductor [K·m/W]")
    max_conductor_c: float
    max_fibre_c: float
    rating_a: float = Field(description="Current for 90 °C in this zone at this ambient [A]")


class ZoneRating(BaseModel):
    name: str
    rating_a: list[float]


class RatingCurve(BaseModel):
    ambient_c: list[float]
    zones: list[ZoneRating]


class DTSProfileResponse(BaseModel):
    current_a: float = Field(description="Per-circuit current [A]")
    ambient_temp_c: float
    cable_length_km: float
    profile: list[DTSProfilePoint] = Field(description="One reading per 100 m")
    zones: list[DTSZone]
    max_conductor_c: float
    max_location_km: float
    alarm_length_km: float = Field(description="Route length above the 70 °C alarm [km]")
    joule_loss_w_per_m: float = Field(description="I²R_AC per conductor at the hottest spot")
    dielectric_loss_w_per_m: float = Field(description="ωCU0² tan δ per conductor")
    static_rating_a: float = Field(description="Rating at the 15 °C design ambient [A]")
    rating_at_ambient_a: float = Field(description="Route rating at this ambient [A]")
    limiting_zone: str
    export_capability_mva: float = Field(description="Both circuits at the route rating")
    rating_curve: RatingCurve
    assessment: str


class DTSTransientRequest(BaseModel):
    prefault_current_a: float = Field(default=730.0, ge=0.0, le=1600.0)
    emergency_current_a: float = Field(
        default=1360.0,
        ge=0.0,
        le=1600.0,
        description="Current after the step, e.g. the survivor after an N-1 trip [A]",
    )
    ambient_temp_c: float = Field(default=15.0, ge=-5.0, le=35.0)
    duration_h: float = Field(default=24.0, gt=0.0, le=72.0)


class TransientZone(BaseModel):
    name: str
    tau_ext_h: float
    conductor_temp_c: list[float]
    minutes_to_limit: float | None = Field(description="Time to 90 °C; None if not reached")
    steady_state_c: float | None = Field(description="Final temperature; None on runaway")


class DTSTransientResponse(BaseModel):
    prefault_current_a: float
    emergency_current_a: float
    ambient_temp_c: float
    time_h: list[float]
    zones: list[TransientZone]
    allowed_minutes: float | None
    limiting_zone: str | None
    assessment: str
