"""
Cable DTS Thermal Monitoring API endpoints — M10.

Endpoints
---------
GET    /api/v1/grid/cable/dts/profile         — Full temperature profile (450 pts)
GET    /api/v1/grid/cable/dts/hotspots        — Active hotspot alerts
GET    /api/v1/grid/cable/dts/dynamic-rating  — Real-time dynamic rating
POST   /api/v1/grid/cable/dts/simulate        — Run DTS simulation with custom params

Standards
---------
IEC 60287  — Current carrying capacity (steady-state thermal model)
IEC 62067  — HV cables above 150 kV (our 220 kV export cable)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.cable_dts import (
    DTSProfileResponse,
    DTSSimulationRequest,
    DynamicRatingResponse,
    HotspotResponse,
)
from app.services.p2 import cable_dts as svc

router = APIRouter(prefix="/cable", tags=["M10 Cable DTS Thermal Monitoring"])


@router.get(
    "/dts/profile",
    response_model=DTSProfileResponse,
    summary="DTS temperature profile along 45 km export cable",
)
async def get_dts_profile(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> DTSProfileResponse:
    """
    Return full Distributed Temperature Sensing profile for the 220 kV export cable.

    **450 measurement points — 1 per 100 m over 45 km route.**

    **Three thermal zones:**

    **Zone A (0–5 km) — J-tube and landfall:**
    The cable leaves the offshore substation through a J-tube, then transitions
    from submarine to land cable at the shore crossing. The J-tube limits convective
    cooling — the conductor temperature can be 30-40% higher than in open sea burial.
    This is typically the hottest section of an export cable system.

    **Zone B (5–40 km) — Open sea burial:**
    The cable is buried 1-2 m below the seabed. Sea-floor temperature is ~12°C year-round
    (below thermocline). Good cooling, uniform burial — temperature follows current load.
    Small sinusoidal variation reflects seabed micro-topography (dune fields).

    **Zone C (40–45 km) — Near-shore shallow:**
    Water depth < 10 m — seasonal seawater warming. Summer temperatures 18-22°C
    reduce the available thermal headroom, lowering the effective dynamic rating.

    **IEC 60287 formula:**
    T_conductor = T_ambient + I² × R_AC × R_thermal × zone_factor
    where R_AC = 0.028 Ω/km, R_thermal = 0.87 K·m/W for this cable.
    """
    result = svc.simulate_dts(current_a, ambient_temp_c)
    return DTSProfileResponse(**result)


@router.get(
    "/dts/hotspots",
    response_model=HotspotResponse,
    summary="Active DTS hotspot alerts (T > 70°C)",
)
async def get_hotspots(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> HotspotResponse:
    """
    Return only cable segments exceeding the hotspot threshold.

    **Thresholds (IEC 60287 / IEC 62067):**
    - WARNING: T > 70°C — DTS alarm, inspect within 48 hours
    - CRITICAL: T > 90°C — rated limit exceeded; derate cable immediately

    **Why hotspots form:**
    1. J-tube (km 0–5): thermal bottleneck, always the primary risk area
    2. Cable joint positions: slight thermal resistance increase
    3. Burial anomalies: rock outcrop → insufficient soil coverage
    4. Sediment drying: very high load causes moisture migration outward,
       creating a dry zone with much higher thermal resistance (thermal runaway risk)

    **Thermal runaway:** Once soil dries around the cable, R_thermal increases
    dramatically, which raises temperature further, which dries more soil...
    This positive feedback loop can cause insulation failure. The DTS alarm at 70°C
    triggers operator investigation before the runaway threshold is reached.
    """
    result = svc.detect_hotspots(current_a, ambient_temp_c)
    return HotspotResponse(**result)


@router.get(
    "/dts/dynamic-rating",
    response_model=DynamicRatingResponse,
    summary="Real-time dynamic thermal rating vs 800 A static",
)
async def get_dynamic_rating(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> DynamicRatingResponse:
    """
    Calculate the real-time cable thermal rating based on actual ambient temperature.

    **Dynamic rating formula (IEC 60287 §5.2):**
    I_dynamic = I_static × sqrt((T_max - T_ambient) / (T_max - T_design_ambient))

    where T_max = 90°C, T_design_ambient = 15°C, I_static = 800 A.

    **Practical values for Baltic Wind:**
    - Winter (T_amb = 4°C):   I_dynamic = 800 × sqrt(86/75) = 856 A (+7%)
    - Design (T_amb = 15°C):  I_dynamic = 800 A (by definition)
    - Summer (T_amb = 22°C):  I_dynamic = 800 × sqrt(68/75) = 762 A (-5%)

    **Why this matters for operators:**
    The static rating of 800 A is the most conservative nameplate value, designed
    for worst-case summer conditions. In winter, you can safely export 7% more power
    (an extra ~35 MW at 220 kV). Dynamic line rating (DLR) is becoming standard
    practice for export cables to maximise revenue during high-wind periods.

    **Integration with PPC (M-08 BESS / Power Plant Controller):**
    The PPC can use the dynamic rating to calculate the maximum available export
    setpoint: P_export_max = I_dynamic × √3 × 220 kV × cos(φ)
    """
    result = svc.calculate_dynamic_rating(current_a, ambient_temp_c)
    return DynamicRatingResponse(**result)


@router.post(
    "/dts/simulate",
    response_model=DTSProfileResponse,
    summary="Run DTS simulation with custom current and ambient temperature",
)
async def simulate_dts(request: DTSSimulationRequest) -> DTSProfileResponse:
    """
    Run DTS simulation with user-specified operating conditions.

    Use this endpoint to explore:
    - Overload scenario: current_a = 880 A (110% rating) → hotspot in J-tube
    - Winter high-wind: current_a = 850 A, ambient = 4°C → may stay within limits
    - Summer max-load: current_a = 800 A, ambient = 22°C → critical in J-tube

    The simulation uses the IEC 60287 model with spatial zone factors derived
    from the actual cable route survey (J-tube, open sea, near-shore).
    """
    result = svc.simulate_dts(request.current_a, request.ambient_temp_c)
    return DTSProfileResponse(**result)
