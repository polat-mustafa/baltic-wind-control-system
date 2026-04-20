"""Nacelle Subsystems API endpoints — A4 (Nacelle Overhaul).

REST endpoints exposing the V236-15.0 MW nacelle physics models:

  GET  /api/v1/turbine-sim/nacelle/subsystems  — all subsystems (aggregate)
  GET  /api/v1/turbine-sim/nacelle/hpu         — Hydraulic Power Unit only
  GET  /api/v1/turbine-sim/nacelle/cooling     — Cooling & lubrication only
  GET  /api/v1/turbine-sim/nacelle/safety      — Safety systems only

All endpoints accept identical query parameters (operating conditions) and
return pure deterministic physics — no database calls, no state.

Physics Layer
─────────────
HPU: adiabatic accumulator model, ISO 4406 fluid cleanliness
Cooling: thermal equilibrium T_oil = T_amb + Q_loss/UA, Walther viscosity eq.
Safety: IEC 61400-1 overspeed limits, ISO 10816-21 vibration zones

Standards
─────────
- IEC 61400-1 §7.4.2 — overspeed trip thresholds
- ISO 4406:2021 — hydraulic fluid cleanliness
- ISO 10816-21 — vibration monitoring zones for wind turbines
- IEC 62040-1 — UPS requirements (VFI class)
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.nacelle_subsystems import (
    CableTwistStateResponse,
    CoolingStateResponse,
    HPUStateResponse,
    NacelleSubsystemsRequest,
    NacelleSubsystemsResponse,
    SafetyStateResponse,
    UPSStateResponse,
)
from app.services.turbine_physics.nacelle_subsystems import (
    CableTwistState,
    UPSState,
    compute_cooling_state,
    compute_hpu_state,
    compute_nacelle_subsystems,
    compute_safety_state,
)

router = APIRouter(
    prefix="/api/v1/turbine-sim/nacelle",
    tags=["Nacelle Subsystems"],
)


def _build_request_from_query(
    power_mw: float,
    ambient_temp_c: float,
    rotor_speed_rpm: float,
    pitch_deg: float,
    accumulated_yaw_deg: float,
    is_operating: bool,
    grid_available: bool,
    battery_soc_pct: float,
    vibration_mm_s: float,
    ice_detection: bool,
    fire_alarm: bool,
    lightning_count: int,
) -> NacelleSubsystemsRequest:
    """Assemble query parameters into a validated request object."""
    return NacelleSubsystemsRequest(
        power_mw=power_mw,
        ambient_temp_c=ambient_temp_c,
        rotor_speed_rpm=rotor_speed_rpm,
        pitch_deg=pitch_deg,
        accumulated_yaw_deg=accumulated_yaw_deg,
        is_operating=is_operating,
        grid_available=grid_available,
        battery_soc_pct=battery_soc_pct,
        vibration_mm_s=vibration_mm_s,
        ice_detection=ice_detection,
        fire_alarm=fire_alarm,
        lightning_count=lightning_count,
    )


@router.get("/subsystems", response_model=NacelleSubsystemsResponse)
async def get_subsystems(
    power_mw: float = Query(default=10.0, ge=0.0, le=15.0, description="Electrical output [MW]"),
    ambient_temp_c: float = Query(
        default=15.0, ge=-30.0, le=50.0, description="Ambient temperature [°C]"
    ),
    rotor_speed_rpm: float = Query(default=7.5, ge=0.0, le=15.0, description="Rotor speed [rpm]"),
    pitch_deg: float = Query(default=5.0, ge=0.0, le=90.0, description="Blade pitch angle [°]"),
    accumulated_yaw_deg: float = Query(
        default=90.0, ge=-1260.0, le=1260.0, description="Accumulated yaw [°]"
    ),
    is_operating: bool = Query(default=True, description="Turbine in power production"),
    grid_available: bool = Query(default=True, description="Grid connection available"),
    battery_soc_pct: float = Query(
        default=98.0, ge=0.0, le=100.0, description="UPS battery SOC [%]"
    ),
    vibration_mm_s: float = Query(
        default=1.5, ge=0.0, le=20.0, description="Vibration velocity RMS [mm/s]"
    ),
    ice_detection: bool = Query(default=False, description="Ice detected on rotor"),
    fire_alarm: bool = Query(default=False, description="Fire/smoke alarm active"),
    lightning_count: int = Query(default=0, ge=0, description="Cumulative lightning strike count"),
) -> NacelleSubsystemsResponse:
    """Return complete nacelle subsystems state snapshot.

    Computes all subsystem states (HPU, cooling, safety, cable twist, UPS)
    given current turbine operating conditions.

    Educational use: dashboard panels can display each subsystem live,
    showing how oil temperature rises with load, how the accumulator
    discharge cycle works, and how ISO 10816-21 zones map to vibration levels.
    """
    state = compute_nacelle_subsystems(
        power_mw=power_mw,
        ambient_temp_c=ambient_temp_c,
        rotor_speed_rpm=rotor_speed_rpm,
        pitch_deg=pitch_deg,
        accumulated_yaw_deg=accumulated_yaw_deg,
        is_operating=is_operating,
        grid_available=grid_available,
        battery_soc_pct=battery_soc_pct,
        vibration_mm_s=vibration_mm_s,
        ice_detection=ice_detection,
        fire_alarm=fire_alarm,
        lightning_count=lightning_count,
    )

    any_alarm = (
        state.hpu.alarm
        or state.cooling.oil_temp_alarm
        or state.cooling.oil_temp_trip
        or state.safety.overspeed_warning
        or state.safety.vibration_alarm
        or state.safety.ice_detection_active
        or state.safety.fire_alarm
        or state.ups.alarm
        or state.cable_twist.hard_limit_reached
    )

    return NacelleSubsystemsResponse(
        hpu=HPUStateResponse(**state.hpu.__dict__),
        cooling=CoolingStateResponse(**state.cooling.__dict__),
        safety=SafetyStateResponse(**state.safety.__dict__),
        cable_twist=_cable_twist_to_response(state.cable_twist),
        ups=_ups_to_response(state.ups),
        any_alarm=any_alarm,
    )


@router.get("/hpu", response_model=HPUStateResponse)
async def get_hpu(
    power_mw: float = Query(default=10.0, ge=0.0, le=15.0, description="Electrical output [MW]"),
    is_operating: bool = Query(default=True, description="Turbine in power production"),
    pitch_deg: float = Query(default=5.0, ge=0.0, le=90.0, description="Blade pitch angle [°]"),
) -> HPUStateResponse:
    """Return Hydraulic Power Unit (HPU) state.

    Models the accumulator pressure cycle, pitch cylinder extension,
    main shaft brake pressure, and ISO 4406 oil cleanliness code.

    Physics:
    - Accumulator: adiabatic discharge (P × V^γ = const, γ=1.4 for N₂)
    - Pitch cylinder extension: 0% (feathered/90°) → 100% (fine/0°)
    - Brake: clamped at 250 bar when parked, released when operating
    - ISO 4406: cleanliness improves at low load (less particle generation)
    """
    state = compute_hpu_state(power_mw=power_mw, is_operating=is_operating, pitch_deg=pitch_deg)
    return HPUStateResponse(**state.__dict__)


@router.get("/cooling", response_model=CoolingStateResponse)
async def get_cooling(
    power_mw: float = Query(default=10.0, ge=0.0, le=15.0, description="Electrical output [MW]"),
    ambient_temp_c: float = Query(
        default=15.0, ge=-30.0, le=50.0, description="Ambient temperature [°C]"
    ),
) -> CoolingStateResponse:
    """Return gearbox cooling and lubrication system state.

    Thermal equilibrium model:
        T_oil = T_amb + Q_loss / (UA_cooler × fan_factor)

    where Q_loss = P_mech × (1 − η_gearbox) ≈ 450 kW at rated power.

    Fan speed is proportional-controlled to maintain a 65°C oil setpoint.
    Oil viscosity is computed from the Walther equation (ASTM D341) for
    ISO VG 320 synthetic gear oil (VI = 140, 320 cSt at 40°C).
    """
    state = compute_cooling_state(power_mw=power_mw, ambient_temp_c=ambient_temp_c)
    return CoolingStateResponse(**state.__dict__)


@router.get("/safety", response_model=SafetyStateResponse)
async def get_safety(
    rotor_speed_rpm: float = Query(default=7.5, ge=0.0, le=15.0, description="Rotor speed [rpm]"),
    power_mw: float = Query(default=10.0, ge=0.0, le=15.0, description="Electrical output [MW]"),
    vibration_mm_s: float = Query(
        default=1.5, ge=0.0, le=20.0, description="Vibration velocity RMS [mm/s]"
    ),
    ice_detection: bool = Query(default=False, description="Ice detected on rotor"),
    fire_alarm: bool = Query(default=False, description="Fire/smoke alarm active"),
    lightning_count: int = Query(default=0, ge=0, description="Cumulative lightning strike count"),
) -> SafetyStateResponse:
    """Return nacelle safety systems state.

    Checks:
    - Overspeed (IEC 61400-1 §7.4.2):
        Warning trip: ω > 110% rated (9.16 rpm) → EMERGENCY_SHUTDOWN
        Hardware trip: ω > 120% rated (10.0 rpm) → centrifugal governor
    - Vibration (ISO 10816-21):
        Zone A ≤ 2.3 mm/s (new equip.), B ≤ 4.5 (unrestricted),
        C ≤ 7.1 (restricted, plan maint.), D > 7.1 (emergency stop)
    - Ice, fire, lightning strike counter
    """
    state = compute_safety_state(
        rotor_speed_rpm=rotor_speed_rpm,
        power_mw=power_mw,
        vibration_mm_s=vibration_mm_s,
        ice_detection=ice_detection,
        fire_alarm=fire_alarm,
        lightning_count=lightning_count,
    )
    return SafetyStateResponse(**state.__dict__)


# ── Private helpers ───────────────────────────────────────────────────────────


def _cable_twist_to_response(state: CableTwistState) -> CableTwistStateResponse:
    return CableTwistStateResponse(**state.__dict__)


def _ups_to_response(state: UPSState) -> UPSStateResponse:
    return UPSStateResponse(**state.__dict__)
