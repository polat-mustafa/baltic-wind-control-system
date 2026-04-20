"""IEC 61400-1 turbine operating state machine.

Physics Layer
─────────────
A wind turbine transitions through well-defined operating states depending
on wind conditions, fault status, and operator commands.  Each state
corresponds to a group of Design Load Cases (DLCs) in IEC 61400-1:2019.

States and their DLC mappings:

  POWER_PRODUCTION        (DLC 1.x) — normal operation, Regions 1–3
  POWER_PRODUCTION_FAULT  (DLC 2.x) — operating with one active minor fault
  STARTUP                 (DLC 3.x) — cut-in sequence, generator synchronisation
  NORMAL_SHUTDOWN         (DLC 4.x) — controlled ramp-down (pitch to feather)
  EMERGENCY_SHUTDOWN      (DLC 5.x) — pitch to feather + main shaft brake, <5 s
  PARKED_STANDBY          (DLC 6.x) — idling, blades feathered, no fault
  PARKED_FAULT            (DLC 7.x) — parked with active fault (e.g. grid loss)
  MAINTENANCE             (DLC 8.x) — manual lockout for service personnel

Standards Layer
───────────────
- IEC 61400-1:2019 §7.4 (Design situations and load cases)
- IEC 61400-25-2 (SCADA data model — turbine state codes)
- IEC 61508 SIL 2 (safety PLC implements EMERGENCY_SHUTDOWN logic)

Maths Layer
───────────
Overspeed thresholds (IEC 61400-1 §7.4.2):
  Warning trip:   ω > 1.10 × ω_rated  →  EMERGENCY_SHUTDOWN (electrical trip)
  Hardware trip:  ω > 1.20 × ω_rated  →  EMERGENCY_SHUTDOWN (mechanical brake)

For V236-15.0 MW (rated 8.33 rpm):
  Warning:   8.33 × 1.10 = 9.16 rpm
  Hardware:  8.33 × 1.20 = 10.0 rpm

Code Layer
──────────
Pure functions and frozen dataclasses.  The state machine is deterministic:
given a current state and inputs, it returns the next state.  No side effects.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

# ── State enum ─────────────────────────────────────────────────────────────


class TurbineOperatingState(StrEnum):
    """IEC 61400-1 turbine operating states (§7.4).

    The string value is the IEC 61400-25-2 SCADA status code used in the
    simulator's ``status`` field.  Downstream dashboard code can compare
    directly against these string values.
    """

    POWER_PRODUCTION = "power_production"
    """Normal operation, Regions 1–3 (DLC 1.x)."""

    POWER_PRODUCTION_FAULT = "power_production_fault"
    """Operating with one active minor fault (DLC 2.x).

    Turbine continues to generate power but a fault has been latched.
    The TCS schedules a maintenance shutdown at the next convenient wind lull.
    Examples: gearbox oil temperature high, vibration level marginal.
    """

    STARTUP = "startup"
    """Cut-in sequence: rotor acceleration, generator synchronisation (DLC 3.x).

    Entered when wind exceeds cut-in speed from PARKED_STANDBY.
    Duration: ~60–120 s for the rotor to reach synchronous speed.
    """

    NORMAL_SHUTDOWN = "normal_shutdown"
    """Controlled pitch-to-feather and generator disconnect (DLC 4.x).

    Activated by: wind above cut-out, wind below cut-in, operator command,
    or fault promotion from POWER_PRODUCTION_FAULT.
    Ramp-down time: ~30 s.
    """

    EMERGENCY_SHUTDOWN = "emergency_shutdown"
    """Immediate pitch-to-feather + mechanical brake (DLC 5.x).

    Activated by: overspeed (>110 % rated), grid loss, critical fault,
    vibration Zone D, fire detection.
    Brake-to-rest time: <5 s (IEC 61400-1 DLC 5.1).
    """

    PARKED_STANDBY = "parked_standby"
    """Parked, blades feathered, no active fault (DLC 6.x).

    Wind is either below cut-in or turbine is waiting for maintenance window.
    Yaw system is active (tracking wind direction slowly).
    """

    PARKED_FAULT = "parked_fault"
    """Parked with active fault; requires manual reset (DLC 7.x).

    Entered after EMERGENCY_SHUTDOWN or when a critical fault is detected
    while parked.  Turbine stays locked until operator acknowledges fault.
    Examples: grid loss, fire detection, bearing overtemp > trip threshold.
    """

    MAINTENANCE = "maintenance"
    """Manual lockout for service personnel (corresponds to DLC 8.x).

    Entered only by explicit operator command from PARKED_STANDBY.
    All drives locked; blades clamped at 90°; rotor locked.
    Requires LOTO (Lockout/Tagout) procedure per IEC 62443-2-4.
    """


# ── Input dataclass ─────────────────────────────────────────────────────────


@dataclass(frozen=True)
class StateMachineInput:
    """All inputs required to determine the next turbine state.

    Attributes
    ----------
    wind_speed_ms : float
        Hub-height wind speed [m/s].
    rotor_speed_rpm : float
        Current rotor speed [rpm].
    rated_rotor_speed_rpm : float
        Rated rotor speed [rpm] (V236: 8.33 rpm).
    cut_in_speed_ms : float
        Cut-in wind speed [m/s] (V236: 3.0 m/s).
    cut_out_speed_ms : float
        Cut-out wind speed [m/s] (V236: 31.0 m/s).
    fault_active : bool
        Any minor (non-critical) fault is active.
    critical_fault : bool
        A critical fault requiring immediate stop (grid loss, fire, vibration D).
    operator_shutdown : bool
        Operator has commanded a normal shutdown.
    operator_maintenance : bool
        Operator has commanded a transition to MAINTENANCE (from PARKED_STANDBY).
    fault_cleared : bool
        Previously active fault has been acknowledged and cleared by operator.
    maintenance_complete : bool
        Maintenance work complete; operator releases LOTO.
    """

    wind_speed_ms: float
    rotor_speed_rpm: float
    rated_rotor_speed_rpm: float
    cut_in_speed_ms: float
    cut_out_speed_ms: float
    fault_active: bool = False
    critical_fault: bool = False
    operator_shutdown: bool = False
    operator_maintenance: bool = False
    fault_cleared: bool = False
    maintenance_complete: bool = False


# ── Pure transition function ────────────────────────────────────────────────

# Overspeed trip thresholds (IEC 61400-1 §7.4.2)
_OVERSPEED_WARNING_FACTOR: float = 1.10  # 110 % rated → electrical trip
_OVERSPEED_HARDWARE_FACTOR: float = 1.20  # 120 % rated → mechanical brake


def is_overspeed(rotor_speed_rpm: float, rated_rpm: float) -> bool:
    """Return True if rotor speed exceeds IEC 61400-1 overspeed warning limit.

    Warning trip at 110 % of rated speed.  Used to trigger EMERGENCY_SHUTDOWN
    before the mechanical centrifugal overspeed governor activates at 120 %.

    Args:
        rotor_speed_rpm: Current rotor speed [rpm].
        rated_rpm: Rated rotor speed [rpm].

    Returns:
        True if in overspeed condition.
    """
    return rotor_speed_rpm > rated_rpm * _OVERSPEED_WARNING_FACTOR


def next_state(
    current: TurbineOperatingState,
    inputs: StateMachineInput,
) -> TurbineOperatingState:
    """Compute the next IEC 61400-1 operating state.

    Implements the deterministic state transition table.  Called at every
    simulator timestep; the result replaces ``TurbineState.status``.

    Transition priority (highest to lowest within each state):
      1. Critical fault / overspeed → EMERGENCY_SHUTDOWN (overrides all)
      2. State-specific exit conditions
      3. Stay in current state

    Args:
        current: Current turbine operating state.
        inputs: Snapshot of all transition-relevant inputs.

    Returns:
        Next TurbineOperatingState.
    """
    S = TurbineOperatingState

    overspeed = is_overspeed(inputs.rotor_speed_rpm, inputs.rated_rotor_speed_rpm)
    below_cut_in = inputs.wind_speed_ms < inputs.cut_in_speed_ms
    above_cut_out = inputs.wind_speed_ms > inputs.cut_out_speed_ms
    in_operating_range = not below_cut_in and not above_cut_out

    # ── POWER_PRODUCTION ────────────────────────────────────────────────
    if current == S.POWER_PRODUCTION:
        if overspeed or inputs.critical_fault:
            return S.EMERGENCY_SHUTDOWN
        if inputs.fault_active:
            return S.POWER_PRODUCTION_FAULT
        if inputs.operator_shutdown or not in_operating_range:
            return S.NORMAL_SHUTDOWN
        return S.POWER_PRODUCTION

    # ── POWER_PRODUCTION_FAULT ─────────────────────────────────────────
    if current == S.POWER_PRODUCTION_FAULT:
        if overspeed or inputs.critical_fault:
            return S.EMERGENCY_SHUTDOWN
        if inputs.fault_cleared and in_operating_range:
            return S.POWER_PRODUCTION
        # Promote to normal shutdown at wind boundary or operator command
        if inputs.operator_shutdown or not in_operating_range:
            return S.NORMAL_SHUTDOWN
        return S.POWER_PRODUCTION_FAULT

    # ── STARTUP ─────────────────────────────────────────────────────────
    if current == S.STARTUP:
        if overspeed or inputs.critical_fault:
            return S.EMERGENCY_SHUTDOWN
        if inputs.operator_shutdown or not in_operating_range:
            return S.NORMAL_SHUTDOWN
        # Startup complete: rotor has reached ≥ 80 % of rated speed
        if inputs.rotor_speed_rpm >= 0.8 * inputs.rated_rotor_speed_rpm:
            return S.POWER_PRODUCTION
        return S.STARTUP

    # ── NORMAL_SHUTDOWN ─────────────────────────────────────────────────
    if current == S.NORMAL_SHUTDOWN:
        if overspeed or inputs.critical_fault:
            return S.EMERGENCY_SHUTDOWN
        # Shutdown complete: rotor has coasted to rest (< 0.5 rpm)
        if inputs.rotor_speed_rpm < 0.5:
            next_s = S.PARKED_FAULT if inputs.fault_active else S.PARKED_STANDBY
            return next_s
        return S.NORMAL_SHUTDOWN

    # ── EMERGENCY_SHUTDOWN ──────────────────────────────────────────────
    if current == S.EMERGENCY_SHUTDOWN:
        # Emergency complete: rotor at rest
        if inputs.rotor_speed_rpm < 0.5:
            return S.PARKED_FAULT  # Always go to PARKED_FAULT after emergency
        return S.EMERGENCY_SHUTDOWN

    # ── PARKED_STANDBY ──────────────────────────────────────────────────
    if current == S.PARKED_STANDBY:
        if inputs.critical_fault:
            return S.PARKED_FAULT
        if inputs.operator_maintenance:
            return S.MAINTENANCE
        if in_operating_range and not inputs.fault_active:
            return S.STARTUP
        return S.PARKED_STANDBY

    # ── PARKED_FAULT ────────────────────────────────────────────────────
    if current == S.PARKED_FAULT:
        if inputs.fault_cleared and not inputs.critical_fault:
            return S.PARKED_STANDBY
        return S.PARKED_FAULT

    # ── MAINTENANCE ─────────────────────────────────────────────────────
    if current == S.MAINTENANCE:
        if inputs.maintenance_complete:
            return S.PARKED_STANDBY
        return S.MAINTENANCE

    # Fallback — should never be reached with a valid enum value
    return current  # pragma: no cover


# ── Compatibility shim for simulator.py ────────────────────────────────────


def classify_wind_state(
    wind_speed_ms: float,
    cut_in_ms: float = 3.0,
    cut_out_ms: float = 31.0,
) -> TurbineOperatingState:
    """Simplified state classifier using wind speed only (no fault/command inputs).

    Used as a drop-in replacement for the legacy ``_determine_status()``
    function in simulator.py when full state machine inputs are not available.

    Maps:
        wind < cut_in    → PARKED_STANDBY
        wind > cut_out   → NORMAL_SHUTDOWN (approaching shutdown)
        otherwise        → POWER_PRODUCTION

    Args:
        wind_speed_ms: Hub-height wind speed [m/s].
        cut_in_ms: Cut-in wind speed [m/s].
        cut_out_ms: Cut-out wind speed [m/s].

    Returns:
        TurbineOperatingState based on wind speed alone.
    """
    if wind_speed_ms < cut_in_ms:
        return TurbineOperatingState.PARKED_STANDBY
    if wind_speed_ms > cut_out_ms:
        return TurbineOperatingState.NORMAL_SHUTDOWN
    return TurbineOperatingState.POWER_PRODUCTION
