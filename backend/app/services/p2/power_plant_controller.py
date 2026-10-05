"""
Power Plant Controller (PPC) for the 510 MW farm — time-domain simulation.

The PPC sits between the TSO (PSE) and the 34 WTG converters + STATCOM. It
turns TSO commands into per-turbine set-points and runs the plant-level
frequency and voltage control the grid code asks for.

::

    PSE (TSO) ↔ IEC 60870-5-104 ↔ PPC ↔ IEC 61400-25 ↔ 34 × WTG + STATCOM

What the simulation does (time step 0.1 s by default)
------------------------------------------------------
1. Available power: V236 power curve (same table as P1) × online turbines.
2. Dispatch target from the active-power mode (reference, delta reserve,
   absolute limit, ramp control). The TSO command arrives at ``setpoint_time_s``.
3. Ramp limiter on the dispatch target (plant setting agreed with the TSO).
4. Frequency response added *after* the limiter — LFSM-O/U and FSM must not be
   slowed by dispatch ramp limits:
     LFSM-O  ΔP = −P_max · (f − 50.2) / (50 · s)        f > 50.2 Hz, s = 5 %
     LFSM-U  ΔP = +P_max · (49.8 − f) / (50 · s)        only with headroom
     FSM     ΔP = −P_max · (f − 50 ∓ db) / (50 · s)     delta mode (reserve held)
5. WTG output follows the set-point with τ_P = 0.5 s; pro-rata dispatch.
6. Reactive power at the POC follows the selected mode with τ_Q = 1.5 s:
     voltage control  Q = Q_max · (V_ref − V) / s,  s = 2–7 % (NC RfG 21(3)(d))
     Q set-point, power factor, Q(V) droop with deadband.
7. POC voltage from the grid Thevenin source:
     V_POC = V_grid(t) + (R·P + X·Q) / 100     (p.u. on 100 MVA, Z = S_base/S_sc)
   A grid voltage step and a frequency step can be applied at ``event_time_s``.

Checks (PSE NC RfG requirements, 18-12-2018)
--------------------------------------------
- Art. 15(2)(a): new set-point reached within 15 min, accuracy 2 % of set-point.
- Art. 13(2)(a), 15(2)(c)–(d): LFSM-O 50.2 Hz / LFSM-U 49.8 Hz, droop 5 %;
  FSM deadband 0–500 mHz, full activation ≤ 30 s → ΔP within 2 % P_max of the
  droop value 30 s after the event.
- Art. 21(3)(d)(iv): 90 % of the Q change within 5 s after a voltage step.
- POC voltage within the 0.95–1.05 p.u. planning band.

Simplifications (ponytail: plant reduced to one P lag and one Q lag; replace by
the P2 load flow per step if internal voltages matter): the fast reactive range
is WTGs (±0.33 p.u. each, assumed) + STATCOM; reactor switching and OLTC moves
(minutes) are outside the simulated window; Q is regulated directly at the POC.
"""

from __future__ import annotations

import math

import numpy as np

from app.schemas.ppc import (
    ActivePowerMode,
    PPCConfig,
    PPCSimulationRequest,
    PPCSimulationResponse,
    PPCState,
    PPCStatusResponse,
    PPCTimePoint,
    ReactivePowerMode,
    TSOSetpoint,
    WTGDispatch,
)
from app.services.p1.wake_model import get_v236_power_curve_kw
from app.services.p2.network_model import (
    GRID_RX_RATIO,
    GRID_SSC_MVA,
    NUM_TURBINES,
    STATCOM_RATING_MVAR,
    TOTAL_CAPACITY_MW,
    TURBINE_RATED_MW,
)
from app.services.p2.statcom_sizing import PSE_Q_PRODUCE_PU, WTG_Q_CAPABILITY_PU

NOMINAL_FREQUENCY_HZ = 50.0
V_MIN_PU = 0.95
V_MAX_PU = 1.05
SETPOINT_DEADLINE_S = 15 * 60.0  # PSE Art. 15(2)(a)
FREQ_RESPONSE_WINDOW_S = 30.0  # FSM full activation t2 ≤ 30 s
FREQ_RESPONSE_TOLERANCE = 0.02  # ± 2 % P_max
Q_RESPONSE_LIMIT_S = 5.0  # PSE Art. 21(3)(d)(iv)
WTG_Q_LIMIT_MVAR = WTG_Q_CAPABILITY_PU * TURBINE_RATED_MW
S_BASE_MVA = 100.0


def _turbine_available_power(wind_speed_ms: float) -> float:
    """V236 available power [MW] at hub-height wind speed (Rule 1: 0 … 15 MW)."""
    return float(get_v236_power_curve_kw(np.array([wind_speed_ms]))[0]) / 1000.0


def _apply_ramp_limit(
    current_mw: float,
    target_mw: float,
    dt_s: float,
    ramp_up_mw_per_s: float,
    ramp_down_mw_per_s: float,
) -> float:
    """Move ``current`` towards ``target`` by at most the ramp × dt (rate limiter)."""
    delta = target_mw - current_mw
    return current_mw + max(-ramp_down_mw_per_s * dt_s, min(ramp_up_mw_per_s * dt_s, delta))


def _frequency_response_delta_p(
    frequency_hz: float,
    deadband_hz: float,
    droop_pct: float,
    rated_mw: float = TOTAL_CAPACITY_MW,
) -> float:
    """FSM droop ΔP [MW] outside the deadband: −P_max·(Δf − db)/(f_n·s)."""
    delta_f = frequency_hz - NOMINAL_FREQUENCY_HZ
    if abs(delta_f) <= deadband_hz:
        return 0.0
    effective = delta_f - math.copysign(deadband_hz, delta_f)
    return -rated_mw / (droop_pct / 100.0) * effective / NOMINAL_FREQUENCY_HZ


def _lfsm_delta_p(
    frequency_hz: float, cfg: PPCConfig, rated_mw: float = TOTAL_CAPACITY_MW
) -> float:
    """LFSM-O / LFSM-U ΔP [MW] on P_max (PSE: P_ref = P_max for PPMs)."""
    k = rated_mw / (cfg.lfsm_droop_pct / 100.0) / NOMINAL_FREQUENCY_HZ  # MW/Hz
    if frequency_hz > cfg.lfsm_o_threshold_hz:
        return -k * (frequency_hz - cfg.lfsm_o_threshold_hz)
    if frequency_hz < cfg.lfsm_u_threshold_hz:
        return k * (cfg.lfsm_u_threshold_hz - frequency_hz)
    return 0.0


def _q_from_power_factor(power_mw: float, power_factor: float) -> float:
    """Q [MVAR] for a power factor; negative PF = absorbing (Rule 4 sign)."""
    if abs(power_factor) >= 1.0 or power_mw <= 0.0:
        return 0.0
    q = power_mw * math.tan(math.acos(abs(power_factor)))
    return -q if power_factor < 0 else q


def _q_from_qv_droop(
    voltage_pu: float,
    v_ref_pu: float,
    slope_mvar_per_pu: float,
    deadband_pu: float,
) -> float:
    """Q(V) droop with deadband: Q = K·(|ΔV| − db)·sign(V_ref − V) [MVAR]."""
    error = v_ref_pu - voltage_pu
    if abs(error) <= deadband_pu:
        return 0.0
    return slope_mvar_per_pu * (abs(error) - deadband_pu) * math.copysign(1.0, error)


def _pro_rata_dispatch(
    farm_target_mw: float,
    available_powers_mw: list[float],
    online_mask: list[bool],
) -> list[float]:
    """P_i = P_target · P_avail,i / Σ P_avail (online WTGs only), target clamped to Σ."""
    total = sum(p for p, on in zip(available_powers_mw, online_mask, strict=True) if on)
    if total <= 0.0:
        return [0.0] * len(available_powers_mw)
    target = max(0.0, min(farm_target_mw, total))
    return [
        target * p / total if on and p > 0.0 else 0.0
        for p, on in zip(available_powers_mw, online_mask, strict=True)
    ]


def _split_q_statcom_wtg(q_total_mvar: float, num_online_wtgs: int) -> tuple[float, float]:
    """(STATCOM Q, Q per WTG): WTGs first up to their limit, STATCOM the rest."""
    wtg_cap = num_online_wtgs * WTG_Q_LIMIT_MVAR
    if abs(q_total_mvar) <= wtg_cap:
        return 0.0, q_total_mvar / max(num_online_wtgs, 1)
    per_wtg = math.copysign(WTG_Q_LIMIT_MVAR, q_total_mvar)
    statcom = q_total_mvar - math.copysign(wtg_cap, q_total_mvar)
    return max(-STATCOM_RATING_MVAR, min(STATCOM_RATING_MVAR, statcom)), per_wtg


def _grid_impedance_pu(grid_ssc_mva: float = GRID_SSC_MVA) -> tuple[float, float]:
    """Grid Thevenin (R, X) at the POC on 100 MVA."""
    z = S_BASE_MVA / grid_ssc_mva
    x = z / math.sqrt(1.0 + GRID_RX_RATIO**2)
    return GRID_RX_RATIO * x, x


def _poc_voltage(v_grid: float, p_mw: float, q_mvar: float) -> float:
    """V_POC = V_grid + (R·P + X·Q)/S_base — export and generated Q raise it."""
    r, x = _grid_impedance_pu()
    return v_grid + (r * p_mw + x * q_mvar) / S_BASE_MVA


def _p_target(
    mode: ActivePowerMode, tso: TSOSetpoint, available_mw: float
) -> tuple[float, float | None]:
    """Dispatch target [MW] for the mode, and a TSO ramp override [MW/s] if any."""
    if mode == ActivePowerMode.DELTA_CONTROL:
        return max(0.0, available_mw - (tso.delta_reserve_mw or 0.0)), None
    if mode == ActivePowerMode.ABSOLUTE_LIMITATION:
        limit = tso.absolute_limit_mw if tso.absolute_limit_mw is not None else TOTAL_CAPACITY_MW
        return min(available_mw, limit), None
    target = tso.active_power_mw if tso.active_power_mw is not None else available_mw
    override = (
        tso.ramp_rate_mw_per_min / 60.0
        if mode == ActivePowerMode.RAMP_RATE_CONTROL and tso.ramp_rate_mw_per_min is not None
        else None
    )
    return min(target, available_mw), override


def run_ppc_simulation(request: PPCSimulationRequest) -> PPCSimulationResponse:
    """Simulate the PPC response to a TSO command and optional grid events."""
    cfg = request.config
    tso = request.tso_setpoint
    dt = request.time_step_s
    if tso.emergency_stop:
        return _emergency_stop_response(request)

    p_avail_wtg = _turbine_available_power(request.wind_speed_ms)
    online = [i < request.available_turbines for i in range(NUM_TURBINES)]
    available = [p_avail_wtg if on else 0.0 for on in online]
    total_available = sum(available)
    q_cap = request.available_turbines * WTG_Q_LIMIT_MVAR + STATCOM_RATING_MVAR
    q_max_slope = PSE_Q_PRODUCE_PU * TOTAL_CAPACITY_MW  # Q_max that defines the slope

    target, ramp_override = _p_target(request.active_power_mode, tso, total_available)
    ramp_up = ramp_override or cfg.ramp_up_pct_per_min / 100.0 * TOTAL_CAPACITY_MW / 60.0
    ramp_down = ramp_override or cfg.ramp_down_pct_per_min / 100.0 * TOTAL_CAPACITY_MW / 60.0
    v_ref = tso.voltage_setpoint_pu if tso.voltage_setpoint_pu is not None else 1.0

    p0 = min(request.initial_power_mw, total_available)
    v_grid0 = 1.0 - _poc_voltage(0.0, p0, 0.0)  # POC starts at 1.0 pu
    dispatch = p_actual = p0
    q_actual = 0.0
    f_event = request.frequency_event_hz
    dv_event = request.voltage_step_pu or 0.0

    n = round(request.simulation_duration_s / dt) + 1
    series: list[PPCTimePoint] = []
    dispatch_trace: list[float] = []  # ramp-limited dispatch, to isolate the frequency response
    ramp_violated = voltage_violated = False
    dispatch_limit = max(ramp_up, ramp_down) * 60.0 * 1.01

    for k in range(n):
        t = k * dt
        after_event = t >= request.event_time_s
        f = f_event if (f_event is not None and after_event) else NOMINAL_FREQUENCY_HZ
        v_grid = v_grid0 + (dv_event if after_event else 0.0)

        # Dispatch (ramp-limited) — the TSO command arrives at setpoint_time_s
        goal = target if t >= request.setpoint_time_s else p0
        prev_dispatch = dispatch
        dispatch = _apply_ramp_limit(dispatch, goal, dt, ramp_up, ramp_down)
        ramp_mw_min = abs(dispatch - prev_dispatch) / dt * 60.0 if k else 0.0
        ramp_violated |= ramp_mw_min > dispatch_limit

        # Frequency response on top (not ramp-limited); FSM only with reserve held
        d_freq = _lfsm_delta_p(f, cfg)
        if request.active_power_mode == ActivePowerMode.DELTA_CONTROL:
            d_freq += _frequency_response_delta_p(f, cfg.frequency_deadband_hz, cfg.droop_pct)
        setpoint = max(0.0, min(dispatch + d_freq, total_available))
        dispatch_trace.append(dispatch)
        p_actual += (setpoint - p_actual) * (1.0 - math.exp(-dt / cfg.p_response_tau_s))

        # Reactive power at the POC
        v = _poc_voltage(v_grid, p_actual, q_actual)
        mode = request.reactive_power_mode
        if mode == ReactivePowerMode.VOLTAGE_CONTROL:
            q_ref = q_max_slope * (v_ref - v) / (cfg.voltage_slope_pct / 100.0)
        elif mode == ReactivePowerMode.Q_V_DROOP:
            q_ref = _q_from_qv_droop(
                v, v_ref, q_max_slope / (cfg.voltage_slope_pct / 100.0), cfg.q_v_droop_deadband_pu
            )
        elif mode == ReactivePowerMode.POWER_FACTOR:
            q_ref = _q_from_power_factor(p_actual, tso.power_factor or 1.0)
        else:
            q_ref = tso.reactive_power_mvar or 0.0
        q_ref = max(-q_cap, min(q_cap, q_ref))
        q_actual += (q_ref - q_actual) * (1.0 - math.exp(-dt / cfg.q_response_tau_s))
        v = _poc_voltage(v_grid, p_actual, q_actual)
        voltage_violated |= not V_MIN_PU <= v <= V_MAX_PU

        state = (
            PPCState.STOPPED
            if total_available <= 0.0
            else PPCState.DERATED
            if p_actual < 0.95 * total_available
            else PPCState.RUNNING
        )
        series.append(
            PPCTimePoint(
                time_s=round(t, 3),
                power_setpoint_mw=round(setpoint, 2),
                power_actual_mw=round(p_actual, 2),
                available_power_mw=round(total_available, 2),
                curtailment_mw=round(max(0.0, total_available - p_actual), 2),
                ramp_rate_mw_per_min=round(ramp_mw_min, 2),
                q_setpoint_mvar=round(q_ref, 2),
                q_actual_mvar=round(q_actual, 2),
                voltage_pcc_pu=round(v, 4),
                frequency_hz=round(f, 3),
                ppc_state=state,
            )
        )

    # ── Checks ────────────────────────────────────────────────
    band = cfg.setpoint_accuracy_pct / 100.0 * max(target, 1.0)
    reached = next(
        (
            p.time_s - request.setpoint_time_s
            for p in series
            if p.time_s >= request.setpoint_time_s and abs(p.power_actual_mw - target) <= band
        ),
        None,
    )
    if reached is None:  # beyond the window: ramp time + 3 τ settling, from the settings
        rate = ramp_up if target > p0 else ramp_down
        reached = abs(target - p0) / rate + 3.0 * cfg.p_response_tau_s if rate > 0 else math.inf
    pre_event = [p for p in series if p.time_s < request.event_time_s]
    setpoint_ok = reached <= SETPOINT_DEADLINE_S
    if f_event is not None and pre_event:
        expected = _lfsm_delta_p(f_event, cfg)
        if request.active_power_mode == ActivePowerMode.DELTA_CONTROL:
            expected += _frequency_response_delta_p(
                f_event, cfg.frequency_deadband_hz, cfg.droop_pct
            )
        t_check = request.event_time_s + FREQ_RESPONSE_WINDOW_S
        k_check = min(range(len(series)), key=lambda i: abs(series[i].time_s - t_check))
        base = dispatch_trace[k_check]  # the ramp-limited dispatch the response rides on
        expected = max(-base, min(expected, total_available - base))  # what the wind allows
        actual = series[k_check].power_actual_mw - base
        freq_ok = abs(actual - expected) <= FREQ_RESPONSE_TOLERANCE * TOTAL_CAPACITY_MW
    else:
        expected = actual = 0.0
        freq_ok = True

    q90 = 0.0
    q_ok = True
    if dv_event and pre_event:
        q_before = pre_event[-1].q_actual_mvar
        q_after = series[-1].q_actual_mvar
        change = q_after - q_before
        if abs(change) > 1.0:
            hit = next(
                (
                    p.time_s - request.event_time_s
                    for p in series
                    if p.time_s >= request.event_time_s
                    and (p.q_actual_mvar - q_before) / change >= 0.9
                ),
                math.inf,
            )
            q90 = round(hit, 2) if math.isfinite(hit) else request.simulation_duration_s
            q_ok = hit <= Q_RESPONSE_LIMIT_S

    final = series[-1]
    dispatched = _pro_rata_dispatch(final.power_actual_mw, available, online)
    _, per_wtg_q = _split_q_statcom_wtg(final.q_actual_mvar, request.available_turbines)
    if request.reactive_power_mode == ReactivePowerMode.REACTIVE_POWER:
        q_or_v = tso.reactive_power_mvar or 0.0
    elif request.reactive_power_mode == ReactivePowerMode.POWER_FACTOR:
        q_or_v = tso.power_factor or 1.0
    else:
        q_or_v = v_ref

    return PPCSimulationResponse(
        active_power_mode=request.active_power_mode,
        reactive_power_mode=request.reactive_power_mode,
        ppc_state=final.ppc_state,
        tso_power_setpoint_mw=round(target, 2),
        tso_q_or_v_setpoint=round(q_or_v, 4),
        final_power_mw=final.power_actual_mw,
        final_q_mvar=final.q_actual_mvar,
        final_voltage_pu=final.voltage_pcc_pu,
        total_available_mw=round(total_available, 2),
        total_curtailment_mw=final.curtailment_mw,
        ramp_time_s=round(reached, 2) if math.isfinite(reached) else request.simulation_duration_s,
        setpoint_accuracy_compliant=setpoint_ok,
        ramp_rate_compliant=not ramp_violated,
        voltage_compliant=not voltage_violated,
        frequency_response_compliant=freq_ok,
        frequency_response_expected_mw=round(expected, 2),
        frequency_response_actual_mw=round(actual, 2),
        q_response_90_s=q90,
        q_response_compliant=q_ok,
        q_range_mvar=[round(-q_cap, 1), round(q_cap, 1)],
        overall_compliant=setpoint_ok and not voltage_violated and freq_ok and q_ok,
        wtg_dispatch=[
            WTGDispatch(
                wtg_id=f"WTG_{i + 1:02d}",
                available_power_mw=round(available[i], 2),
                dispatched_power_mw=round(dispatched[i], 2),
                dispatched_q_mvar=round(per_wtg_q if online[i] else 0.0, 2),
                curtailment_mw=round(max(0.0, available[i] - dispatched[i]), 2),
                is_online=online[i],
            )
            for i in range(NUM_TURBINES)
        ],
        time_series=series,
    )


def _emergency_stop_response(request: PPCSimulationRequest) -> PPCSimulationResponse:
    """All WTGs ramp to zero at the configured emergency rate."""
    cfg = request.config
    dt = request.time_step_s
    rate = cfg.emergency_ramp_pct_per_s / 100.0 * TOTAL_CAPACITY_MW  # MW/s
    p_avail_wtg = _turbine_available_power(request.wind_speed_ms)
    total_available = p_avail_wtg * request.available_turbines
    power = min(request.initial_power_mw, total_available)
    v_grid0 = 1.0 - _poc_voltage(0.0, power, 0.0)
    series: list[PPCTimePoint] = []
    for k in range(round(request.simulation_duration_s / dt) + 1):
        prev = power
        power = max(0.0, power - rate * dt) if k else power
        series.append(
            PPCTimePoint(
                time_s=round(k * dt, 3),
                power_setpoint_mw=0.0,
                power_actual_mw=round(power, 2),
                available_power_mw=round(total_available, 2),
                curtailment_mw=round(total_available - power, 2),
                ramp_rate_mw_per_min=round(abs(power - prev) / dt * 60.0, 2),
                q_setpoint_mvar=0.0,
                q_actual_mvar=0.0,
                voltage_pcc_pu=round(_poc_voltage(v_grid0, power, 0.0), 4),
                frequency_hz=NOMINAL_FREQUENCY_HZ,
                ppc_state=PPCState.EMERGENCY_STOP,
            )
        )
    online = [i < request.available_turbines for i in range(NUM_TURBINES)]
    return PPCSimulationResponse(
        active_power_mode=request.active_power_mode,
        reactive_power_mode=request.reactive_power_mode,
        ppc_state=PPCState.EMERGENCY_STOP,
        tso_power_setpoint_mw=0.0,
        tso_q_or_v_setpoint=0.0,
        final_power_mw=series[-1].power_actual_mw,
        final_q_mvar=0.0,
        final_voltage_pu=series[-1].voltage_pcc_pu,
        total_available_mw=round(total_available, 2),
        total_curtailment_mw=round(total_available - series[-1].power_actual_mw, 2),
        ramp_time_s=round(series[0].power_actual_mw / rate, 2) if rate > 0 else 0.0,
        setpoint_accuracy_compliant=True,
        ramp_rate_compliant=True,
        voltage_compliant=True,
        overall_compliant=True,
        wtg_dispatch=[
            WTGDispatch(
                wtg_id=f"WTG_{i + 1:02d}",
                available_power_mw=round(p_avail_wtg if online[i] else 0.0, 2),
                dispatched_power_mw=0.0,
                dispatched_q_mvar=0.0,
                curtailment_mw=round(p_avail_wtg if online[i] else 0.0, 2),
                is_online=online[i],
            )
            for i in range(NUM_TURBINES)
        ],
        time_series=series,
    )


def get_ppc_status(
    wind_speed_ms: float = 12.0,
    available_turbines: int = NUM_TURBINES,
    tso_setpoint: TSOSetpoint | None = None,
    active_power_mode: ActivePowerMode = ActivePowerMode.POWER_REFERENCE,
    reactive_power_mode: ReactivePowerMode = ReactivePowerMode.VOLTAGE_CONTROL,
    frequency_hz: float = NOMINAL_FREQUENCY_HZ,
) -> PPCStatusResponse:
    """Steady-state snapshot of the PPC for the given conditions."""
    tso = tso_setpoint or TSOSetpoint()
    cfg = PPCConfig()
    total_available = _turbine_available_power(wind_speed_ms) * available_turbines
    p_setpoint, _ = _p_target(active_power_mode, tso, total_available)
    d_freq = _lfsm_delta_p(frequency_hz, cfg)
    if active_power_mode == ActivePowerMode.DELTA_CONTROL:
        d_freq += _frequency_response_delta_p(
            frequency_hz, cfg.frequency_deadband_hz, cfg.droop_pct
        )
    p_actual = max(0.0, min(p_setpoint + d_freq, total_available))

    v_ref = tso.voltage_setpoint_pu or 1.0
    q = 0.0
    if reactive_power_mode == ReactivePowerMode.REACTIVE_POWER:
        q = tso.reactive_power_mvar or 0.0
    elif reactive_power_mode == ReactivePowerMode.POWER_FACTOR:
        q = _q_from_power_factor(
            p_actual, tso.power_factor if tso.power_factor is not None else 1.0
        )
    statcom_q, _ = _split_q_statcom_wtg(q, available_turbines)

    if tso.emergency_stop:
        state = PPCState.EMERGENCY_STOP
    elif total_available <= 0.0:
        state = PPCState.STOPPED
    elif available_turbines < NUM_TURBINES or p_actual < 0.95 * total_available:
        state = PPCState.DERATED
    else:
        state = PPCState.RUNNING

    return PPCStatusResponse(
        ppc_state=state,
        active_power_mode=active_power_mode,
        reactive_power_mode=reactive_power_mode,
        power_setpoint_mw=round(p_setpoint, 2),
        power_actual_mw=round(p_actual, 2),
        available_power_mw=round(total_available, 2),
        curtailment_mw=round(max(0.0, total_available - p_actual), 2),
        ramp_rate_mw_per_min=0.0,
        q_setpoint_mvar=round(q, 2),
        q_actual_mvar=round(q, 2),
        voltage_setpoint_pu=round(v_ref, 4),
        voltage_actual_pu=round(_poc_voltage(1.0, 0.0, q), 4),
        frequency_hz=round(frequency_hz, 3),
        frequency_response_active=abs(d_freq) > 0.1,
        frequency_delta_p_mw=round(d_freq, 2),
        turbines_online=available_turbines,
        turbines_total=NUM_TURBINES,
        statcom_q_mvar=round(statcom_q, 2),
        tso_comm_ok=True,
        wtg_comm_ok=available_turbines > 0,
        last_tso_command_age_s=0.0,
    )
