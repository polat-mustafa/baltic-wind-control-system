"""
Power Plant Controller (PPC) for 510 MW Baltic Sea offshore wind farm.

The PPC is the central control intelligence of the wind farm. It sits between
the TSO (PSE) and the 34 individual WTG converters, translating high-level
dispatch commands into per-turbine active and reactive power setpoints.

Control Hierarchy (real-world architecture)
--------------------------------------------
::

    PSE (Polish TSO)
       ↕  IEC 60870-5-104 (telecontrol, 1-2 s cycle)
    PPC (this module)
       ↕  IEC 61400-25 (wind power plant communication, 100 ms cycle)
    34 × V236-15.0 MW WTG converters  +  STATCOM ±120 MVAR
       ↕
    66 kV array → 220 kV export (45 km) → 400 kV PSE grid

Real-world PPC vendors: Vestas VPPC, Siemens Gamesa DEIF AGC-4, ABB WindSTAR,
GE Wind Farm Management System, Ørsted proprietary PPC.

Physics — Active Power Control
-------------------------------
The PPC active power control loop manages the total farm output P_farm:

  1. TSO sends P_ref (active power setpoint) to PPC
  2. PPC applies ramp rate limiter:
     dP/dt ≤ ramp_up_rate   (PSE: 10% Pn/min = 51 MW/min = 0.85 MW/s)
     dP/dt ≤ ramp_down_rate (PSE: 20% Pn/min = 102 MW/min = 1.70 MW/s)
  3. PPC calculates P_farm_target (after ramp limiting)
  4. PPC distributes to WTGs via pro-rata dispatch:
     P_i = P_farm_target × (P_avail_i / Σ P_avail_j)
  5. Each WTG converter tracks its setpoint within 20 ms (REGCA1 Tg)

The ramp rate limiter is a first-order rate limiter (not a filter):

  P_target(t) = P_target(t-1) + clamp(P_ref - P_target(t-1),
                                       -ramp_down × dt, ramp_up × dt)

Physics — Reactive Power / Voltage Control
--------------------------------------------
The PPC voltage control loop maintains V_pcc within ±5% of nominal:

  Mode 1: Voltage PI controller (primary mode)
    Q_ref(t) = Q_ref(t-1) + Kp × (e(t) - e(t-1)) + Ki × e(t) × dt
    where e(t) = V_ref - V_pcc(t)  [p.u.]

    The PI output Q_ref is split between STATCOM (fast, < 1 cycle)
    and WTG converters (slower, ~100 ms).

  Mode 2: Direct Q setpoint
    Q_farm = Q_ref (from TSO)
    Distributed pro-rata across WTGs by available Q capacity.

  Mode 3: Power factor control
    Q_ref = P_actual × tan(arccos(PF_ref))
    Updated every cycle as P_actual changes.

  Mode 4: Q(V) droop
    Q = K_qv × max(0, |V_pcc - V_ref| - deadband) × sign(V_ref - V_pcc)
    Provides proportional Q support without integral action.

Physics — Frequency Response Integration
-----------------------------------------
When system frequency deviates beyond the deadband (±200 mHz per ENTSO-E),
the PPC overrides the active power setpoint:

  ΔP_freq = -(P_rated / R) × (Δf / f_nom)     [MW]

  where R = droop (5%), f_nom = 50 Hz, P_rated = 510 MW

This frequency contribution is added to (or subtracted from) the TSO
setpoint, then the combined setpoint goes through the ramp rate limiter
and pro-rata dispatch as normal.

Maths — Pro-Rata Dispatch Algorithm
-------------------------------------
For N online turbines with available powers P_avail_1, ..., P_avail_N:

  Total available:  P_avail_total = Σ P_avail_i
  Farm target:      P_target (from ramp limiter, clamped to P_avail_total)
  Per-WTG setpoint: P_i = P_target × (P_avail_i / P_avail_total)
  Curtailment:      C_i = P_avail_i - P_i

This ensures fair load sharing — each turbine is curtailed by the same
percentage of its available power, distributing fatigue loads evenly.

Standards
---------
- ENTSO-E NC RfG (EU 2016/631): Type D — Articles 15, 21
- PSE IRiESP: §4.2 (active power), §4.3 (reactive power), §4.4 (ramp rates)
- IEC 61400-25: Wind power plant communication (WPPC logical node)
- IEC 60870-5-104: Telecontrol (ASDU Type 50/51 setpoint commands)

References
----------
- Vestas VPPC Technical Documentation (general architecture)
- DEIF AGC-4 Wind Power Plant Controller User Manual
- CIGRE TB 328: "WG C4.601 — Modelling and dynamic behaviour of wind generation"
- Ackermann, T. (2012). Wind Power in Power Systems, 2nd ed. Chapter 25.
- Hansen, A.D. et al. (2006). "Centralised power control of wind farm with
  doubly fed induction generators." Renewable Energy, 31(7), 935-951.

Constants (Baltic Wind Alpha)
-----------------------------
- 34 × V236-15.0 MW = 510 MW total
- PSE ramp up: 10% Pn/min = 51 MW/min = 0.85 MW/s
- PSE ramp down: 20% Pn/min = 102 MW/min = 1.70 MW/s
- PSE emergency ramp: 2% Pn/s = 10.2 MW/s
- PSE setpoint accuracy: ±5% Pn = ±25.5 MW
- STATCOM: ±120 MVAR
- PCC voltage: 0.95–1.05 p.u.
- Frequency deadband: ±200 mHz
- Droop: 5% (R = 0.05)
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.schemas.ppc import (
    ActivePowerMode,
    PPCSimulationRequest,
    PPCSimulationResponse,
    PPCState,
    PPCStatusResponse,
    PPCTimePoint,
    ReactivePowerMode,
    TSOSetpoint,
    WTGDispatch,
)
from app.services.p2.network_model import (
    NUM_TURBINES,
    STATCOM_RATING_MVAR,
    TOTAL_CAPACITY_MW,
    TURBINE_RATED_MW,
)

# ── Wind Turbine Power Curve (V236-15.0 MW) ─────────────────────

CUT_IN_MS = 3.0   # Cut-in wind speed [m/s]
RATED_MS = 11.1   # Rated wind speed [m/s]  — official Vestas V236 spec (wind-turbine-models.com)
CUT_OUT_MS = 31.0  # Cut-out wind speed [m/s]
NOMINAL_FREQUENCY_HZ = 50.0  # System nominal frequency [Hz]

# Voltage compliance limits (PSE IRiESP)
V_MIN_PU = 0.95
V_MAX_PU = 1.05


def _turbine_available_power(wind_speed_ms: float) -> float:
    """Calculate single turbine available power from wind speed.

    Uses simplified cubic power curve below rated, constant at rated.

    Parameters
    ----------
    wind_speed_ms : float
        Hub-height wind speed [m/s].

    Returns
    -------
    float
        Available active power [MW]. Rule 1: 0 ≤ P ≤ P_rated.
    """
    if wind_speed_ms < CUT_IN_MS or wind_speed_ms > CUT_OUT_MS:
        return 0.0
    if wind_speed_ms >= RATED_MS:
        return TURBINE_RATED_MW

    # Cubic region: P ∝ v³ (normalised to rated)
    fraction = ((wind_speed_ms - CUT_IN_MS) / (RATED_MS - CUT_IN_MS)) ** 3
    return TURBINE_RATED_MW * min(fraction, 1.0)


# ── Ramp Rate Limiter ────────────────────────────────────────────


def _apply_ramp_limit(
    current_mw: float,
    target_mw: float,
    dt_s: float,
    ramp_up_mw_per_s: float,
    ramp_down_mw_per_s: float,
) -> float:
    """Apply ramp rate limiting to power setpoint transition.

    Implements a first-order rate limiter (not a low-pass filter).
    The output moves toward the target at a maximum rate of ramp_up/down.

    Parameters
    ----------
    current_mw : float
        Current power output [MW].
    target_mw : float
        Desired power target [MW].
    dt_s : float
        Time step [s].
    ramp_up_mw_per_s : float
        Maximum upward ramp rate [MW/s].
    ramp_down_mw_per_s : float
        Maximum downward ramp rate [MW/s]. Must be positive.

    Returns
    -------
    float
        Rate-limited power setpoint [MW].
    """
    delta = target_mw - current_mw
    max_up = ramp_up_mw_per_s * dt_s
    max_down = ramp_down_mw_per_s * dt_s

    clamped_delta = max(-max_down, min(max_up, delta))
    return current_mw + clamped_delta


# ── Frequency Response ───────────────────────────────────────────


def _frequency_response_delta_p(
    frequency_hz: float,
    deadband_hz: float,
    droop_pct: float,
    rated_mw: float = TOTAL_CAPACITY_MW,
) -> float:
    """Calculate active power adjustment from frequency deviation.

    Implements combined LFSM-O / LFSM-U / FSM response.
    ΔP = -(P_rated / R) × (Δf / f_nom)

    Parameters
    ----------
    frequency_hz : float
        Current system frequency [Hz].
    deadband_hz : float
        Frequency deadband [Hz]. No response within ±deadband.
    droop_pct : float
        Droop setting R [%]. ENTSO-E NC RfG: 2-12%, default 5%.
    rated_mw : float
        Rated farm capacity [MW]. Default: 510.

    Returns
    -------
    float
        Active power adjustment ΔP [MW]. Negative = reduce, positive = increase.
    """
    delta_f = frequency_hz - NOMINAL_FREQUENCY_HZ

    # Apply deadband
    if abs(delta_f) <= deadband_hz:
        return 0.0

    # Remove deadband from deviation
    effective_delta_f = delta_f - math.copysign(deadband_hz, delta_f)

    # Droop formula: ΔP = -(P_rated / R) × (Δf / f_nom)
    droop_fraction = droop_pct / 100.0
    delta_p_mw = -(rated_mw / droop_fraction) * (effective_delta_f / NOMINAL_FREQUENCY_HZ)

    return delta_p_mw


# ── Voltage / Reactive Power Control ─────────────────────────────


@dataclass
class VoltagePI:
    """Discrete-time PI controller for PCC voltage regulation.

    Implements velocity-form PI to avoid integral windup:
      ΔQ(k) = Kp × (e(k) - e(k-1)) + Ki × e(k) × dt

    Output is clamped to STATCOM + WTG reactive power limits.

    Parameters
    ----------
    kp : float
        Proportional gain [MVAR/pu].
    ki : float
        Integral gain [MVAR/(pu·s)].
    q_min_mvar : float
        Minimum reactive power (absorbing) [MVAR].
    q_max_mvar : float
        Maximum reactive power (generating) [MVAR].
    """

    kp: float
    ki: float
    q_min_mvar: float = -STATCOM_RATING_MVAR - 5.0 * NUM_TURBINES  # STATCOM + WTG Q
    q_max_mvar: float = STATCOM_RATING_MVAR + 5.0 * NUM_TURBINES
    _prev_error: float = field(default=0.0, init=False, repr=False)
    _integral: float = field(default=0.0, init=False, repr=False)
    _output: float = field(default=0.0, init=False, repr=False)

    def step(self, error_pu: float, dt_s: float) -> float:
        """Execute one PI control step.

        Parameters
        ----------
        error_pu : float
            Voltage error = V_ref - V_pcc [p.u.].
        dt_s : float
            Time step [s].

        Returns
        -------
        float
            Reactive power setpoint Q_ref [MVAR].
        """
        # Proportional term (velocity form)
        p_term = self.kp * (error_pu - self._prev_error)
        # Integral term
        i_term = self.ki * error_pu * dt_s

        # Update output
        self._output += p_term + i_term

        # Anti-windup: clamp output and freeze integral if saturated
        self._output = max(self.q_min_mvar, min(self.q_max_mvar, self._output))

        self._prev_error = error_pu
        return self._output

    def reset(self) -> None:
        """Reset PI controller state."""
        self._prev_error = 0.0
        self._integral = 0.0
        self._output = 0.0


def _q_from_power_factor(power_mw: float, power_factor: float) -> float:
    """Calculate reactive power from active power and power factor.

    Parameters
    ----------
    power_mw : float
        Active power [MW].
    power_factor : float
        Power factor. Negative = leading (absorbing Q).

    Returns
    -------
    float
        Reactive power [MVAR]. Positive = generating (Rule 4).
    """
    if abs(power_factor) >= 1.0 or power_mw <= 0.0:
        return 0.0

    pf_abs = abs(power_factor)
    q_mvar = power_mw * math.tan(math.acos(pf_abs))

    # Negative PF = leading = absorbing = negative Q (Rule 4)
    if power_factor < 0:
        q_mvar = -q_mvar

    return q_mvar


def _q_from_qv_droop(
    voltage_pu: float,
    v_ref_pu: float,
    slope_mvar_per_pu: float,
    deadband_pu: float,
) -> float:
    """Calculate reactive power from Q(V) droop characteristic.

    Q = K_qv × max(0, |V_pcc - V_ref| - deadband) × sign(V_ref - V_pcc)

    Parameters
    ----------
    voltage_pu : float
        Current PCC voltage [p.u.].
    v_ref_pu : float
        Reference voltage [p.u.].
    slope_mvar_per_pu : float
        Droop slope K_qv [MVAR/pu].
    deadband_pu : float
        Voltage deadband [p.u.].

    Returns
    -------
    float
        Reactive power setpoint [MVAR].
    """
    error = v_ref_pu - voltage_pu
    abs_error = abs(error)

    if abs_error <= deadband_pu:
        return 0.0

    effective_error = abs_error - deadband_pu
    q_mvar = slope_mvar_per_pu * effective_error * math.copysign(1.0, error)
    return q_mvar


# ── Pro-Rata Dispatch ────────────────────────────────────────────


def _pro_rata_dispatch(
    farm_target_mw: float,
    available_powers_mw: list[float],
    online_mask: list[bool],
) -> list[float]:
    """Distribute farm power target across WTGs proportional to available power.

    Formula: P_i = P_target × (P_avail_i / Σ P_avail_j)  for online WTGs
             P_i = 0  for offline WTGs

    Parameters
    ----------
    farm_target_mw : float
        Total farm active power target [MW].
    available_powers_mw : list[float]
        Available power for each WTG [MW].
    online_mask : list[bool]
        True if WTG is online and communicating.

    Returns
    -------
    list[float]
        Dispatched power for each WTG [MW].
    """
    n = len(available_powers_mw)
    dispatched = [0.0] * n

    total_available = sum(
        p for p, online in zip(available_powers_mw, online_mask, strict=True) if online
    )

    if total_available <= 0.0:
        return dispatched

    # Clamp farm target to available power
    target = min(farm_target_mw, total_available)
    target = max(0.0, target)

    for i in range(n):
        if not online_mask[i] or available_powers_mw[i] <= 0.0:
            dispatched[i] = 0.0
        else:
            dispatched[i] = target * (available_powers_mw[i] / total_available)

    return dispatched


# ── Simplified PCC Voltage Model ─────────────────────────────────


def _estimate_pcc_voltage(
    power_mw: float,
    q_mvar: float,
    grid_ssc_mva: float = 10_000.0,
    base_voltage_pu: float = 1.0,
) -> float:
    """Estimate PCC voltage from active/reactive power injection.

    Uses simplified voltage sensitivity model (valid for strong grids):
      ΔV ≈ (R×P + X×Q) / (V × S_sc)

    For our system: R/X ≈ 0.1, so voltage is dominated by reactive power.

    Parameters
    ----------
    power_mw : float
        Active power injection at PCC [MW].
    q_mvar : float
        Reactive power injection at PCC [MVAR]. Positive = generating.
    grid_ssc_mva : float
        Grid short-circuit power [MVA].
    base_voltage_pu : float
        Nominal voltage at PCC [p.u.].

    Returns
    -------
    float
        Estimated PCC voltage [p.u.].
    """
    # Grid impedance: Z_grid = V² / S_sc, with R/X = 0.1
    # X_grid ≈ V² / S_sc, R_grid ≈ 0.1 × X_grid
    x_pu = 1.0 / (grid_ssc_mva / 100.0)  # on 100 MVA base
    r_pu = 0.1 * x_pu

    # Voltage deviation: ΔV ≈ (R×P + X×Q) / V [in p.u. on 100 MVA base]
    p_pu = power_mw / 100.0
    q_pu = q_mvar / 100.0
    delta_v = (r_pu * p_pu + x_pu * q_pu) / base_voltage_pu

    # Export cable capacitive Q raises voltage (Ferranti effect)
    # Simplified: ~0.01 pu per 20 MVAR cable Q at no-load
    cable_q_mvar = 85.0 * (1.0 - power_mw / TOTAL_CAPACITY_MW * 0.3)
    ferranti_rise = cable_q_mvar * x_pu / 100.0

    return base_voltage_pu + delta_v + ferranti_rise


# ── STATCOM / WTG Q Coordination ────────────────────────────────


def _split_q_statcom_wtg(
    q_total_mvar: float,
    num_online_wtgs: int,
) -> tuple[float, float]:
    """Split total Q setpoint between STATCOM (fast) and WTGs (slow).

    STATCOM handles the bulk of reactive power due to faster response.
    WTGs contribute up to ±5 MVAR each (typical converter Q limit).

    Parameters
    ----------
    q_total_mvar : float
        Total reactive power setpoint [MVAR].
    num_online_wtgs : int
        Number of online WTGs.

    Returns
    -------
    tuple[float, float]
        (STATCOM Q [MVAR], per-WTG Q [MVAR]).
    """
    wtg_q_limit = 5.0  # ±5 MVAR per WTG converter
    max_wtg_q = num_online_wtgs * wtg_q_limit

    # STATCOM takes what WTGs can't provide
    if abs(q_total_mvar) <= max_wtg_q:
        # WTGs can handle it — split evenly, STATCOM at minimum
        per_wtg_q = q_total_mvar / max(num_online_wtgs, 1)
        statcom_q = 0.0
    else:
        # STATCOM handles overflow
        if q_total_mvar > 0:
            per_wtg_q = wtg_q_limit
            statcom_q = q_total_mvar - max_wtg_q
        else:
            per_wtg_q = -wtg_q_limit
            statcom_q = q_total_mvar + max_wtg_q

    # Clamp STATCOM to rating
    statcom_q = max(-STATCOM_RATING_MVAR, min(STATCOM_RATING_MVAR, statcom_q))

    return statcom_q, per_wtg_q


# ── Main PPC Simulation ─────────────────────────────────────────


def run_ppc_simulation(request: PPCSimulationRequest) -> PPCSimulationResponse:
    """Run a PPC control simulation over the requested time window.

    Simulates the complete PPC control loop:
    1. Calculate available wind power per WTG from wind speed
    2. Determine active power target (TSO setpoint + frequency response)
    3. Apply ramp rate limiter
    4. Calculate reactive power target (voltage PI, direct Q, PF, or Q(V) droop)
    5. Distribute P and Q to WTGs via pro-rata dispatch
    6. Estimate PCC voltage from simplified network model
    7. Check compliance (setpoint accuracy, ramp rate, voltage)

    Parameters
    ----------
    request : PPCSimulationRequest
        Simulation parameters including TSO setpoint, control modes,
        wind conditions, and PPC configuration.

    Returns
    -------
    PPCSimulationResponse
        Complete simulation result with time-series, dispatch table,
        and compliance verdicts.
    """
    cfg = request.config
    tso = request.tso_setpoint
    dt = request.time_step_s

    # ── Convert ramp rates from %/min to MW/s ────────────────
    ramp_up_mw_per_s = (cfg.ramp_up_pct_per_min / 100.0) * TOTAL_CAPACITY_MW / 60.0
    ramp_down_mw_per_s = (cfg.ramp_down_pct_per_min / 100.0) * TOTAL_CAPACITY_MW / 60.0

    # ── Emergency stop overrides everything ───────────────────
    if tso.emergency_stop:
        return _emergency_stop_response(request)

    # ── Available power per WTG ──────────────────────────────
    p_avail_per_wtg = _turbine_available_power(request.wind_speed_ms)
    online_mask = [i < request.available_turbines for i in range(NUM_TURBINES)]
    available_powers = [p_avail_per_wtg if online else 0.0 for online in online_mask]
    total_available = sum(available_powers)

    # ── Determine active power target ────────────────────────
    if request.active_power_mode == ActivePowerMode.POWER_REFERENCE:
        p_target = tso.active_power_mw if tso.active_power_mw is not None else total_available
    elif request.active_power_mode == ActivePowerMode.DELTA_CONTROL:
        delta = tso.delta_reserve_mw if tso.delta_reserve_mw is not None else 0.0
        p_target = max(0.0, total_available - delta)
    elif request.active_power_mode == ActivePowerMode.ABSOLUTE_LIMITATION:
        limit = tso.absolute_limit_mw if tso.absolute_limit_mw is not None else TOTAL_CAPACITY_MW
        p_target = min(total_available, limit)
    else:  # RAMP_RATE_CONTROL — use TSO setpoint with custom ramp
        p_target = tso.active_power_mw if tso.active_power_mw is not None else total_available
        if tso.ramp_rate_mw_per_min is not None:
            ramp_up_mw_per_s = tso.ramp_rate_mw_per_min / 60.0
            ramp_down_mw_per_s = tso.ramp_rate_mw_per_min / 60.0

    # Clamp to available
    p_target = min(p_target, total_available)
    p_target = max(0.0, p_target)

    # ── Voltage reference ────────────────────────────────────
    v_ref = tso.voltage_setpoint_pu if tso.voltage_setpoint_pu is not None else 1.0

    # ── Initialise PI controller ─────────────────────────────
    v_pi = VoltagePI(kp=cfg.voltage_kp, ki=cfg.voltage_ki)

    # ── Simulation loop ──────────────────────────────────────
    num_steps = int(request.simulation_duration_s / dt) + 1
    time_series: list[PPCTimePoint] = []

    current_power = request.initial_power_mw
    current_q = 0.0
    max_ramp_observed = 0.0
    ramp_violated = False
    voltage_violated = False

    # Default frequency (no frequency event unless modelled)
    frequency_hz = NOMINAL_FREQUENCY_HZ

    for step in range(num_steps):
        t = step * dt

        # ── Frequency response override ──────────────────────
        delta_p_freq = _frequency_response_delta_p(
            frequency_hz=frequency_hz,
            deadband_hz=cfg.frequency_deadband_hz,
            droop_pct=cfg.droop_pct,
        )
        effective_target = min(p_target + delta_p_freq, total_available)
        effective_target = max(0.0, effective_target)

        # ── Apply ramp rate limiter ──────────────────────────
        prev_power = current_power
        current_power = _apply_ramp_limit(
            current_mw=current_power,
            target_mw=effective_target,
            dt_s=dt,
            ramp_up_mw_per_s=ramp_up_mw_per_s,
            ramp_down_mw_per_s=ramp_down_mw_per_s,
        )

        # Track ramp rate [MW/min]
        if dt > 0:
            instant_ramp = abs(current_power - prev_power) / dt * 60.0
            max_ramp_observed = max(max_ramp_observed, instant_ramp)
            max_allowed_ramp = (
                max(cfg.ramp_up_pct_per_min, cfg.ramp_down_pct_per_min) / 100.0 * TOTAL_CAPACITY_MW
            )
            if instant_ramp > max_allowed_ramp * 1.01:  # 1% tolerance
                ramp_violated = True

        # ── Estimate PCC voltage ─────────────────────────────
        voltage_pu = _estimate_pcc_voltage(
            power_mw=current_power,
            q_mvar=current_q,
        )

        # ── Reactive power control ───────────────────────────
        if request.reactive_power_mode == ReactivePowerMode.VOLTAGE_CONTROL:
            v_error = v_ref - voltage_pu
            if abs(v_error) > cfg.voltage_deadband_pu:
                current_q = v_pi.step(v_error, dt)
            # Re-estimate voltage with new Q
            voltage_pu = _estimate_pcc_voltage(
                power_mw=current_power,
                q_mvar=current_q,
            )

        elif request.reactive_power_mode == ReactivePowerMode.REACTIVE_POWER:
            current_q = tso.reactive_power_mvar if tso.reactive_power_mvar is not None else 0.0

        elif request.reactive_power_mode == ReactivePowerMode.POWER_FACTOR:
            pf = tso.power_factor if tso.power_factor is not None else 1.0
            current_q = _q_from_power_factor(current_power, pf)

        elif request.reactive_power_mode == ReactivePowerMode.Q_V_DROOP:
            current_q = _q_from_qv_droop(
                voltage_pu=voltage_pu,
                v_ref_pu=v_ref,
                slope_mvar_per_pu=cfg.q_v_droop_slope_mvar_per_pu,
                deadband_pu=cfg.q_v_droop_deadband_pu,
            )

        # Check voltage compliance
        if voltage_pu < V_MIN_PU or voltage_pu > V_MAX_PU:
            voltage_violated = True

        # Determine PPC state
        if current_power <= 0.0 and total_available <= 0.0:
            ppc_state = PPCState.STOPPED
        elif current_power < total_available * 0.95:
            ppc_state = PPCState.DERATED
        else:
            ppc_state = PPCState.RUNNING

        # Record time point
        time_series.append(
            PPCTimePoint(
                time_s=round(t, 2),
                power_setpoint_mw=round(effective_target, 2),
                power_actual_mw=round(current_power, 2),
                available_power_mw=round(total_available, 2),
                curtailment_mw=round(max(0.0, total_available - current_power), 2),
                ramp_rate_mw_per_min=round(instant_ramp if step > 0 else 0.0, 2),
                q_setpoint_mvar=round(current_q, 2),
                q_actual_mvar=round(current_q, 2),
                voltage_pcc_pu=round(voltage_pu, 4),
                frequency_hz=round(frequency_hz, 3),
                ppc_state=ppc_state,
            )
        )

    # ── Final WTG dispatch (at simulation end) ───────────────
    dispatched_powers = _pro_rata_dispatch(current_power, available_powers, online_mask)
    _statcom_q, per_wtg_q = _split_q_statcom_wtg(current_q, request.available_turbines)

    wtg_dispatch = []
    for i in range(NUM_TURBINES):
        wtg_dispatch.append(
            WTGDispatch(
                wtg_id=f"WTG_{i + 1:02d}",
                available_power_mw=round(available_powers[i], 2),
                dispatched_power_mw=round(dispatched_powers[i], 2),
                dispatched_q_mvar=round(per_wtg_q if online_mask[i] else 0.0, 2),
                curtailment_mw=round(max(0.0, available_powers[i] - dispatched_powers[i]), 2),
                is_online=online_mask[i],
            )
        )

    # ── Compliance checks ────────────────────────────────────
    accuracy_band = (cfg.setpoint_accuracy_pct / 100.0) * TOTAL_CAPACITY_MW
    setpoint_error = abs(current_power - p_target)
    setpoint_compliant = setpoint_error <= accuracy_band or current_power >= total_available

    # Ramp time: first time step where power is within accuracy band of target
    ramp_time_s = request.simulation_duration_s
    for tp in time_series:
        error = abs(tp.power_actual_mw - p_target)
        if error <= accuracy_band or tp.power_actual_mw >= total_available - 0.1:
            ramp_time_s = tp.time_s
            break

    # Determine TSO Q/V setpoint for response
    if request.reactive_power_mode == ReactivePowerMode.VOLTAGE_CONTROL:
        tso_q_or_v = v_ref
    elif request.reactive_power_mode == ReactivePowerMode.REACTIVE_POWER:
        tso_q_or_v = tso.reactive_power_mvar if tso.reactive_power_mvar is not None else 0.0
    elif request.reactive_power_mode == ReactivePowerMode.POWER_FACTOR:
        tso_q_or_v = tso.power_factor if tso.power_factor is not None else 1.0
    else:
        tso_q_or_v = v_ref

    return PPCSimulationResponse(
        active_power_mode=request.active_power_mode,
        reactive_power_mode=request.reactive_power_mode,
        ppc_state=time_series[-1].ppc_state if time_series else PPCState.STOPPED,
        tso_power_setpoint_mw=round(p_target, 2),
        tso_q_or_v_setpoint=round(tso_q_or_v, 4),
        final_power_mw=round(current_power, 2),
        final_q_mvar=round(current_q, 2),
        final_voltage_pu=round(voltage_pu, 4),
        total_available_mw=round(total_available, 2),
        total_curtailment_mw=round(max(0.0, total_available - current_power), 2),
        ramp_time_s=round(ramp_time_s, 2),
        setpoint_accuracy_compliant=setpoint_compliant,
        ramp_rate_compliant=not ramp_violated,
        voltage_compliant=not voltage_violated,
        overall_compliant=setpoint_compliant and not ramp_violated and not voltage_violated,
        wtg_dispatch=wtg_dispatch,
        time_series=time_series,
    )


def _emergency_stop_response(request: PPCSimulationRequest) -> PPCSimulationResponse:
    """Generate response for emergency stop command.

    Emergency ramp: ≥2% Pn/s = 10.2 MW/s per PSE IRiESP.
    All turbines ramp to zero at maximum emergency rate.

    Parameters
    ----------
    request : PPCSimulationRequest
        Original simulation request (with emergency_stop=True).

    Returns
    -------
    PPCSimulationResponse
        Simulation showing rapid power reduction to zero.
    """
    cfg = request.config
    dt = request.time_step_s
    emergency_ramp_mw_per_s = (cfg.emergency_ramp_pct_per_s / 100.0) * TOTAL_CAPACITY_MW

    num_steps = int(request.simulation_duration_s / dt) + 1
    time_series: list[PPCTimePoint] = []
    current_power = request.initial_power_mw

    p_avail_per_wtg = _turbine_available_power(request.wind_speed_ms)
    total_available = p_avail_per_wtg * request.available_turbines

    for step in range(num_steps):
        t = step * dt

        # Ramp down at emergency rate
        prev_power = current_power
        current_power = max(0.0, current_power - emergency_ramp_mw_per_s * dt)

        instant_ramp = abs(current_power - prev_power) / dt * 60.0 if dt > 0 and step > 0 else 0.0

        time_series.append(
            PPCTimePoint(
                time_s=round(t, 2),
                power_setpoint_mw=0.0,
                power_actual_mw=round(current_power, 2),
                available_power_mw=round(total_available, 2),
                curtailment_mw=round(total_available, 2),
                ramp_rate_mw_per_min=round(instant_ramp, 2),
                q_setpoint_mvar=0.0,
                q_actual_mvar=0.0,
                voltage_pcc_pu=1.0,
                frequency_hz=NOMINAL_FREQUENCY_HZ,
                ppc_state=PPCState.EMERGENCY_STOP,
            )
        )

    # Ramp time to zero
    ramp_time_s = (
        request.initial_power_mw / emergency_ramp_mw_per_s if emergency_ramp_mw_per_s > 0 else 0.0
    )

    return PPCSimulationResponse(
        active_power_mode=request.active_power_mode,
        reactive_power_mode=request.reactive_power_mode,
        ppc_state=PPCState.EMERGENCY_STOP,
        tso_power_setpoint_mw=0.0,
        tso_q_or_v_setpoint=0.0,
        final_power_mw=0.0,
        final_q_mvar=0.0,
        final_voltage_pu=1.0,
        total_available_mw=round(total_available, 2),
        total_curtailment_mw=round(total_available, 2),
        ramp_time_s=round(ramp_time_s, 2),
        setpoint_accuracy_compliant=True,
        ramp_rate_compliant=True,
        voltage_compliant=True,
        overall_compliant=True,
        wtg_dispatch=[
            WTGDispatch(
                wtg_id=f"WTG_{i + 1:02d}",
                available_power_mw=round(
                    p_avail_per_wtg if i < request.available_turbines else 0.0, 2
                ),
                dispatched_power_mw=0.0,
                dispatched_q_mvar=0.0,
                curtailment_mw=round(p_avail_per_wtg if i < request.available_turbines else 0.0, 2),
                is_online=i < request.available_turbines,
            )
            for i in range(NUM_TURBINES)
        ],
        time_series=time_series,
    )


# ── PPC Status Snapshot ──────────────────────────────────────────


def get_ppc_status(
    wind_speed_ms: float = 12.5,
    available_turbines: int = NUM_TURBINES,
    tso_setpoint: TSOSetpoint | None = None,
    active_power_mode: ActivePowerMode = ActivePowerMode.POWER_REFERENCE,
    reactive_power_mode: ReactivePowerMode = ReactivePowerMode.VOLTAGE_CONTROL,
    frequency_hz: float = NOMINAL_FREQUENCY_HZ,
) -> PPCStatusResponse:
    """Generate a real-time PPC status snapshot.

    Calculates the instantaneous state of the PPC given current
    wind conditions, turbine availability, and TSO setpoint.

    Parameters
    ----------
    wind_speed_ms : float
        Hub-height wind speed [m/s].
    available_turbines : int
        Number of online turbines.
    tso_setpoint : TSOSetpoint | None
        Current TSO dispatch command. None = no active command.
    active_power_mode : ActivePowerMode
        Active power control mode.
    reactive_power_mode : ReactivePowerMode
        Reactive power control mode.
    frequency_hz : float
        Current system frequency [Hz].

    Returns
    -------
    PPCStatusResponse
        Current PPC state snapshot.
    """
    if tso_setpoint is None:
        tso_setpoint = TSOSetpoint()

    # Available power
    p_avail_per_wtg = _turbine_available_power(wind_speed_ms)
    total_available = p_avail_per_wtg * available_turbines

    # Active power — resolve TSO setpoint per control mode
    tso_p = tso_setpoint.active_power_mw
    if active_power_mode == ActivePowerMode.POWER_REFERENCE:
        p_setpoint = tso_p if tso_p is not None else total_available
    elif active_power_mode == ActivePowerMode.DELTA_CONTROL:
        delta = tso_setpoint.delta_reserve_mw or 0.0
        p_setpoint = max(0.0, total_available - delta)
    elif active_power_mode == ActivePowerMode.ABSOLUTE_LIMITATION:
        limit = tso_setpoint.absolute_limit_mw or TOTAL_CAPACITY_MW
        p_setpoint = min(total_available, limit)
    else:
        p_setpoint = tso_p if tso_p is not None else total_available

    p_actual = min(p_setpoint, total_available)

    # Frequency response
    delta_p_freq = _frequency_response_delta_p(
        frequency_hz=frequency_hz,
        deadband_hz=0.2,
        droop_pct=5.0,
    )
    freq_response_active = abs(delta_p_freq) > 0.1

    # Voltage and Q
    v_ref = tso_setpoint.voltage_setpoint_pu or 1.0
    q_setpoint = 0.0
    if reactive_power_mode == ReactivePowerMode.REACTIVE_POWER:
        q_setpoint = tso_setpoint.reactive_power_mvar or 0.0
    elif reactive_power_mode == ReactivePowerMode.POWER_FACTOR:
        pf = tso_setpoint.power_factor if tso_setpoint.power_factor is not None else 1.0
        q_setpoint = _q_from_power_factor(p_actual, pf)

    voltage_pu = _estimate_pcc_voltage(p_actual, q_setpoint)
    statcom_q, _ = _split_q_statcom_wtg(q_setpoint, available_turbines)

    # PPC state
    if tso_setpoint.emergency_stop:
        ppc_state = PPCState.EMERGENCY_STOP
    elif total_available <= 0.0:
        ppc_state = PPCState.STOPPED
    elif available_turbines < NUM_TURBINES:
        ppc_state = PPCState.DERATED
    else:
        ppc_state = PPCState.RUNNING

    curtailment = max(0.0, total_available - p_actual)

    return PPCStatusResponse(
        ppc_state=ppc_state,
        active_power_mode=active_power_mode,
        reactive_power_mode=reactive_power_mode,
        power_setpoint_mw=round(p_setpoint, 2),
        power_actual_mw=round(p_actual, 2),
        available_power_mw=round(total_available, 2),
        curtailment_mw=round(curtailment, 2),
        ramp_rate_mw_per_min=0.0,
        q_setpoint_mvar=round(q_setpoint, 2),
        q_actual_mvar=round(q_setpoint, 2),
        voltage_setpoint_pu=round(v_ref, 4),
        voltage_actual_pu=round(voltage_pu, 4),
        frequency_hz=round(frequency_hz, 3),
        frequency_response_active=freq_response_active,
        frequency_delta_p_mw=round(delta_p_freq, 2),
        turbines_online=available_turbines,
        turbines_total=NUM_TURBINES,
        statcom_q_mvar=round(statcom_q, 2),
        tso_comm_ok=True,
        wtg_comm_ok=available_turbines > 0,
        last_tso_command_age_s=0.0,
    )
