"""
Power Quality & Harmonics service — M06 (IEC 61000).

Physics layers
--------------
1. Harmonic distortion (IEC 61000-3-6)
   THD_V = sqrt(sum(U_h^2, h=2..50)) / U_1 * 100 %
   Planning levels vary by voltage tier: LV/MV <= 8%, HV >= 35 kV <= 3%

2. Cable resonance (LC distributed model)
   Parallel resonance: f_r = 1 / (2*pi*sqrt(L'*C'*l^2))
   where L' [H/km] and C' [F/km] are distributed cable parameters.
   For 220 kV XLPE: L' ≈ 0.35 mH/km, C' ≈ 0.22 uF/km
   Resonance interacts with harmonic current sources (VSC converters at h=5,7,11,13).

3. Flicker (IEC 61000-3-7 / IEC 61400-21)
   Pst = c_f * S_wf / S_k   where c_f = flicker coefficient (turbine type)
   Plt = Pst / sqrt(N_operations) for switching operations
   IEC planning levels: Pst <= 1.0, Plt <= 0.65

4. Passive harmonic filter (single-tuned LC)
   Tuned frequency f_t = h_t * 50 * (1 - 1/detuning_factor)   [slightly below harmonic]
   C = Q_filter / (2*pi*f_1*V^2)   [per phase]
   L = 1 / (2*pi*f_t)^2 / C        [per phase]
   Quality factor Q = 2*pi*f_t*L / R   [target 30-80]
   Insertion loss = 20*log10(|Z_sys / (Z_sys || Z_filter)|) at f_t

Standards references
--------------------
- IEC 61000-3-6:2008+AMD1:2018 — harmonic planning levels
- IEC 61000-3-7:2008 — flicker emission limits
- IEC 61400-21:2008 — wind turbine electrical characteristics (c_f table)
- PSE IRiESP (2023) — 220 kV POC: THD_V <= 3%, individual harmonics per HV column
"""

from __future__ import annotations

import math
from typing import Any

# ── IEC 61000-3-6:2008 planning levels (Table 1) ──────────────────────────────
# Format: order -> (lv_pct, mv_pct, hv_pct)
# HV applies for Un >= 35 kV in IEC; PSE uses HV limits at 220 kV POC
_IEC61000_3_6: dict[int, tuple[float, float, float]] = {
    2: (2.0, 1.8, 1.4),
    3: (5.0, 4.0, 2.0),
    4: (1.0, 0.9, 0.8),
    5: (6.0, 5.0, 2.0),
    6: (0.5, 0.4, 0.4),
    7: (5.0, 4.0, 2.0),
    8: (0.4, 0.3, 0.3),
    9: (1.5, 1.2, 1.0),
    10: (0.35, 0.25, 0.25),
    11: (3.5, 3.0, 1.5),
    12: (0.3, 0.2, 0.2),
    13: (3.0, 2.5, 1.5),
    14: (0.25, 0.18, 0.18),
    15: (0.4, 0.3, 0.3),
    16: (0.2, 0.15, 0.15),
    17: (2.0, 1.6, 1.0),
    18: (0.18, 0.13, 0.13),
    19: (1.8, 1.4, 1.0),
    20: (0.16, 0.12, 0.12),
    21: (0.2, 0.15, 0.15),
    22: (0.14, 0.10, 0.10),
    23: (1.4, 1.2, 0.7),
    24: (0.13, 0.09, 0.09),
    25: (1.4, 1.2, 0.7),
}
# Orders 26-50: generic planning levels (simplified — not all tabulated in IEC)
_GENERIC_ODD_HV = 0.7  # IEC 61000-3-6 Table 1 "others" row (HV)
_GENERIC_ODD_LV = 1.4
_GENERIC_EVEN_HV = 0.08
_GENERIC_EVEN_LV = 0.16


def _get_limit(order: int, tier: str) -> float:
    """Return IEC 61000-3-6 planning level for a given harmonic order and voltage tier."""
    col = {"LV": 0, "MV": 1, "HV": 2}[tier]
    if order in _IEC61000_3_6:
        return _IEC61000_3_6[order][col]
    # Generic for higher orders
    if order % 2 == 0:
        return _GENERIC_EVEN_LV if col == 0 else _GENERIC_EVEN_HV
    return _GENERIC_ODD_LV if col == 0 else _GENERIC_ODD_HV


def _voltage_tier(voltage_kv: float) -> str:
    """Map voltage to IEC 61000-3-6 tier."""
    if voltage_kv < 1.0:
        return "LV"
    if voltage_kv < 35.0:
        return "MV"
    return "HV"


def _harmonic_family(order: int) -> str:
    """IEC 61000-3-6 harmonic family classification."""
    if order % 2 == 0:
        return "EVEN"
    if order % 3 == 0:
        return "ODD_TRIPLE"
    return "ODD_NON_TRIPLE"


# ── Public API ─────────────────────────────────────────────────────────────────


def compute_harmonics(
    harmonic_magnitudes: dict[int, float],
    voltage_kv: float,
    rated_mw: float,
) -> dict[str, Any]:
    """
    Compute harmonic distortion analysis (IEC 61000-3-6).

    Parameters
    ----------
    harmonic_magnitudes : {order: magnitude_pct}
        Harmonic spectrum as percentage of fundamental.
    voltage_kv : float
        System voltage — selects applicable planning level tier.
    rated_mw : float
        Rated installation power (informational, for context).

    Returns
    -------
    dict matching HarmonicAnalysisResponse schema
    """
    tier = _voltage_tier(voltage_kv)

    harmonics = []
    sum_sq = 0.0
    dominant_order = 2
    dominant_pct = 0.0

    for order in range(2, 51):
        mag_pct = harmonic_magnitudes.get(order, 0.0)
        if mag_pct <= 0.0:
            continue
        limit = _get_limit(order, tier)
        exceeds = mag_pct > limit
        sum_sq += mag_pct**2
        if mag_pct > dominant_pct:
            dominant_pct = mag_pct
            dominant_order = order

        harmonics.append(
            {
                "order": order,
                "magnitude_pct": round(mag_pct, 3),
                "frequency_hz": round(order * 50.0, 1),
                "exceeds_limit": exceeds,
                "limit_pct": limit,
            }
        )

    thd_v = round(math.sqrt(sum_sq), 3)  # THD voltage = same as THD of input magnitudes

    # THD current — approximate: for VSC converters dominant harmonics are 5th, 7th
    # Weight by harmonic order (current harmonics fall off faster: I_h ~ 1/h)
    thd_i_sq = sum((harmonic_magnitudes.get(h, 0.0) / h) ** 2 for h in range(2, 51))
    # Normalise to approximate: THD_I = THD_V / X_h ratio — simplified educational model
    thd_i = round(math.sqrt(thd_i_sq) * 5.0, 3)  # 5.0 = approximate V/I harmonic ratio

    # IEC 61000-3-6 THD limits
    thd_limits = {"LV": 8.0, "MV": 8.0, "HV": 3.0}
    thd_limit = thd_limits[tier]

    violations = [
        f"H{h['order']} ({h['magnitude_pct']:.1f}% > {h['limit_pct']:.1f}%)"
        for h in harmonics
        if h["exceeds_limit"]
    ]
    compliant = len(violations) == 0 and thd_v <= thd_limit

    if thd_v > thd_limit:
        violations.insert(0, f"THD_V {thd_v:.1f}% exceeds {thd_limit:.0f}% limit")

    assessment = _assess(thd_v, thd_limit, violations)

    return {
        "thd_voltage_pct": thd_v,
        "thd_current_pct": thd_i,
        "dominant_harmonic_order": dominant_order,
        "dominant_harmonic_pct": round(dominant_pct, 3),
        "harmonics": harmonics,
        "compliant": compliant,
        "voltage_level": tier,
        "violations": violations,
        "assessment": assessment,
    }


def compute_resonance_scan(
    cable_length_km: float,
    voltage_kv: float,
    grid_fault_level_mva: float,
    scan_max_hz: float,
) -> dict[str, Any]:
    """
    Frequency scan of network impedance — identifies parallel resonance peaks.

    Model: export cable as lumped pi-section (L-C ladder).
    Grid is represented as a stiff voltage source with impedance Z_grid = V^2 / S_cc.

    Cable parameters (220 kV XLPE, per km):
      L' = 0.35 mH/km  (series inductance)
      C' = 0.22 uF/km  (shunt capacitance to ground)
      R' = 0.028 Ohm/km (conductor resistance — XLPE 1200 mm2)

    Parallel resonance occurs when X_C = X_L:
      f_r = 1 / (2*pi*sqrt(L_total*C_total))

    Parameters
    ----------
    cable_length_km : float
    voltage_kv : float
        Cable rated voltage (selects cable parameters).
    grid_fault_level_mva : float
        Grid short-circuit level at POC — determines grid impedance.
    scan_max_hz : float
        Maximum frequency for scan.

    Returns
    -------
    dict matching ResonanceScanResponse schema
    """
    # Cable distributed parameters (voltage-dependent)
    if voltage_kv >= 100.0:
        l_prime_mh_per_km = 0.35  # 220 kV XLPE
        c_prime_uf_per_km = 0.22
        r_prime_ohm_per_km = 0.028
    elif voltage_kv >= 60.0:
        l_prime_mh_per_km = 0.40  # 66 kV XLPE
        c_prime_uf_per_km = 0.18
        r_prime_ohm_per_km = 0.045
    else:
        l_prime_mh_per_km = 0.45  # 33 kV XLPE
        c_prime_uf_per_km = 0.15
        r_prime_ohm_per_km = 0.065

    l_total_h = l_prime_mh_per_km * cable_length_km * 1e-3
    c_total_f = c_prime_uf_per_km * cable_length_km * 1e-6
    r_total_ohm = r_prime_ohm_per_km * cable_length_km

    # Cable natural resonant frequency (no grid)
    f_cable_resonance = 1.0 / (2.0 * math.pi * math.sqrt(l_total_h * c_total_f))

    # Grid impedance at 50 Hz (base impedance from fault level)
    v_base_v = voltage_kv * 1e3
    z_base_ohm = v_base_v**2 / (grid_fault_level_mva * 1e6)
    # Grid X/R ≈ 10 for transmission system
    r_grid = z_base_ohm / math.sqrt(101.0)
    x_grid_50 = z_base_ohm * 10.0 / math.sqrt(101.0)
    l_grid_h = x_grid_50 / (2.0 * math.pi * 50.0)

    # Frequency scan: 50 Hz steps up to scan_max_hz
    step_hz = max(5.0, scan_max_hz / 500.0)
    frequencies = [10.0 + i * step_hz for i in range(int((scan_max_hz - 10.0) / step_hz) + 1)]

    impedances: list[float] = []
    resonance_points: list[dict[str, Any]] = []

    for f in frequencies:
        omega = 2.0 * math.pi * f

        # Cable impedance (series RL + shunt C pi-section)
        z_cable_r = r_total_ohm
        z_cable_x = omega * l_total_h - 1.0 / (omega * c_total_f / 2.0)
        z_cable_mag = math.sqrt(z_cable_r**2 + z_cable_x**2)

        # Grid impedance at frequency f
        r_g = r_grid
        x_g = omega * l_grid_h
        z_grid_mag = math.sqrt(r_g**2 + x_g**2)

        # Parallel combination (simplified magnitude)
        if z_cable_mag > 0 and z_grid_mag > 0:
            # Parallel impedance magnitude approximation
            z_parallel = (z_cable_mag * z_grid_mag) / math.sqrt(
                (z_cable_r + r_g) ** 2 + (z_cable_x + x_g) ** 2
            )
        else:
            z_parallel = 0.0

        # Resonance peak detection: impedance >> background
        # At resonance, parallel reactances cancel: X_L = X_C
        # Simplified: compute network impedance seen from harmonic source
        x_cap = 1.0 / (omega * c_total_f) if omega > 0 else 1e9
        x_ind = omega * (l_total_h + l_grid_h)
        if abs(x_cap - x_ind) < 0.1 * x_cap:
            # Near resonance — peak impedance ≈ R_total (damping determines height)
            z_peak = (r_total_ohm + r_grid) * max(1.0, x_cap / (r_total_ohm + r_grid + 0.01))
            impedances.append(round(min(z_peak, 10.0 * z_base_ohm), 2))
        else:
            impedances.append(round(z_parallel, 2))

    # Find resonance peaks (local maxima above 5 ohm threshold)
    for i in range(1, len(impedances) - 1):
        is_local_max = impedances[i] > impedances[i - 1] and impedances[i] > impedances[i + 1]
        if is_local_max and impedances[i] > 5.0:
            h_order = frequencies[i] / 50.0
            risk = _resonance_risk(impedances[i], z_base_ohm)
            resonance_points.append(
                {
                    "frequency_hz": round(frequencies[i], 1),
                    "impedance_ohm": round(impedances[i], 2),
                    "harmonic_order": round(h_order, 2),
                    "risk_level": risk,
                }
            )

    # Critical harmonics: VSC converter generates 5th, 7th, 11th, 13th predominantly
    characteristic_harmonics = [5, 7, 11, 13, 17, 19, 23, 25]
    critical = [
        h
        for h in characteristic_harmonics
        if any(abs(rp["harmonic_order"] - h) < 0.5 for rp in resonance_points)
    ]

    high_risk = any(rp["risk_level"] == "HIGH" for rp in resonance_points)
    medium_risk = any(rp["risk_level"] == "MEDIUM" for rp in resonance_points)
    assessment = (
        "HIGH RISK — harmonic amplification likely, install passive filters"
        if high_risk
        else "MEDIUM RISK — monitor and consider detuning"
        if medium_risk
        else "LOW RISK — no significant resonance peaks in characteristic harmonic range"
    )

    return {
        "frequencies_hz": [round(f, 1) for f in frequencies],
        "impedances_ohm": impedances,
        "resonance_points": resonance_points,
        "cable_resonant_freq_hz": round(f_cable_resonance, 1),
        "critical_harmonics": critical,
        "assessment": assessment,
    }


def compute_flicker(
    rated_mw: float,
    grid_fault_level_mva: float,
    grid_impedance_angle_deg: float,
    annual_switching_operations: int,
) -> dict[str, Any]:
    """
    Flicker emission assessment (IEC 61000-3-7 / IEC 61400-21).

    Continuous operation flicker:
      Pst = c_f(psi_k) * sqrt(n * S_n / S_k)
    where:
      c_f  = flicker coefficient from IEC 61400-21 Table 4 (function of grid angle)
      n    = number of turbines
      S_n  = rated apparent power per turbine [MVA]
      S_k  = grid short-circuit power [MVA]

    Switching operation flicker:
      Pst_sw = k_f(psi_k) * S_n / S_k * (N_10_min)^0.31
    where:
      k_f  = switching flicker coefficient (function of grid angle)
      N_10 = switching operations per 10 minutes

    Parameters
    ----------
    rated_mw : float
        Total wind farm rated power.
    grid_fault_level_mva : float
        Grid short-circuit level at POC.
    grid_impedance_angle_deg : float
        Grid impedance angle [degrees] — affects flicker coefficient.
    annual_switching_operations : int
        Estimated annual turbine start/stop switching events.

    Returns
    -------
    dict matching FlickerResponse schema
    """
    # IEC 61400-21 Table 4: c_f (continuous flicker coefficient) vs grid angle
    # Values for V236-15MW equivalent (MMC-VSC, Type IV full converter — low flicker)
    # Grid angle 30° -> 85°: c_f interpolated from table
    _cf_table = [
        (30.0, 0.38),
        (50.0, 0.27),
        (70.0, 0.21),
        (85.0, 0.18),
    ]
    c_f = _interpolate_table(_cf_table, grid_impedance_angle_deg)

    # IEC 61400-21 switching flicker coefficient k_f (per operation)
    _kf_table = [
        (30.0, 0.65),
        (50.0, 0.52),
        (70.0, 0.42),
        (85.0, 0.37),
    ]
    k_f = _interpolate_table(_kf_table, grid_impedance_angle_deg)

    # Farm parameters (V236-15.0 MW, power factor 0.95)
    turbine_count = max(1, round(rated_mw / 15.0))
    s_turbine_mva = 15.0 / 0.95  # rated apparent power per turbine

    # Continuous flicker (tower shadow + turbulence)
    # Pst_continuous = c_f * sqrt(n) * S_n / S_k
    pst_continuous = c_f * math.sqrt(turbine_count) * s_turbine_mva / grid_fault_level_mva

    # Switching flicker contribution
    # Operations per 10 minutes
    n_10min = annual_switching_operations / (525960.0 / 10.0)  # 525960 min/year
    pst_switch = k_f * s_turbine_mva / grid_fault_level_mva * (n_10min**0.31)

    # Combined (RSS method per IEC 61000-3-7 Section 5.4.3)
    pst = math.sqrt(pst_continuous**2 + pst_switch**2)

    # Long-term flicker severity (2-hour aggregation)
    # Plt = (sum(Pst_i^3) / N)^(1/3) — for variable source, approx = 0.85 * Pst
    plt = 0.85 * pst

    # IEC 61000-3-7 planning levels
    pst_limit = 1.0
    plt_limit = 0.65

    # Dominant source
    if pst_switch > pst_continuous:
        dominant_source = "SWITCHING"
    elif grid_impedance_angle_deg > 70.0:
        dominant_source = "TOWER_SHADOW"
    else:
        dominant_source = "WIND_TURBULENCE"

    pst_r = round(pst, 4)
    plt_r = round(plt, 4)
    pst_compliant = pst_r <= pst_limit
    plt_compliant = plt_r <= plt_limit

    # Borderline: within 10% of limit
    margin_pst = abs(pst_r - pst_limit) / pst_limit
    margin_plt = abs(plt_r - plt_limit) / plt_limit

    if pst_compliant and plt_compliant:
        assessment = "BORDERLINE" if margin_pst < 0.1 or margin_plt < 0.1 else "PASS"
    else:
        assessment = "FAIL"

    return {
        "pst": pst_r,
        "plt": plt_r,
        "pst_limit": pst_limit,
        "plt_limit": plt_limit,
        "pst_compliant": pst_compliant,
        "plt_compliant": plt_compliant,
        "dominant_source": dominant_source,
        "assessment": assessment,
    }


def design_passive_filter(
    dominant_harmonic_order: int,
    harmonic_current_a: float,
    system_voltage_kv: float,
    rated_mvar: float,
) -> dict[str, Any]:
    """
    Size a single-tuned passive LC harmonic filter.

    Design procedure:
    1. Choose tuning frequency slightly below harmonic:
       f_t = h * f_1 * (1 - detuning)  where detuning = 0.03..0.05
    2. Capacitor rating:
       Q_C = rated_mvar [MVAR] (specified)
       C = Q_C / (omega_1 * V^2)  [per phase]
    3. Reactor inductance:
       L = 1 / (omega_t^2 * C)  [per phase]
    4. Reactor resistance (quality factor Q = omega_t * L / R):
       R = omega_t * L / Q_target  where Q_target = 50
    5. Insertion loss at tuned frequency:
       IL = 20*log10(Z_sys / |Z_sys || Z_filter|)  [dB]
       Simplified: Z_sys = V^2/S_sc; Z_filter ~ R (at resonance)

    Parameters
    ----------
    dominant_harmonic_order : int
        Harmonic order to filter (typically 5 or 7 for VSC output).
    harmonic_current_a : float
        Peak harmonic current at dominant order [A rms].
    system_voltage_kv : float
        System voltage for filter sizing.
    rated_mvar : float
        Desired capacitor reactive power contribution at 50 Hz [MVAR].

    Returns
    -------
    dict matching FilterDesignResponse schema
    """
    omega_1 = 2.0 * math.pi * 50.0
    v_line_v = system_voltage_kv * 1e3
    v_phase_v = v_line_v / math.sqrt(3.0)

    # 1. Tuning frequency (3% below harmonic to allow for detuning due to ageing)
    detuning = 0.03
    h_tune = dominant_harmonic_order * (1.0 - detuning)
    f_tuned_hz = h_tune * 50.0
    omega_t = 2.0 * math.pi * f_tuned_hz

    # 2. Capacitor bank (3-phase total MVAR at fundamental)
    q_mvar = rated_mvar
    q_var = q_mvar * 1e6
    # C = Q / (omega_1 * V_line^2)  [3-phase total]
    # Per phase: C_phase = Q / (3 * omega_1 * V_phase^2) = Q / (omega_1 * V_line^2)
    c_phase_f = q_var / (omega_1 * v_line_v**2)
    c_phase_uf = c_phase_f * 1e6

    # 3. Reactor inductance per phase
    l_phase_h = 1.0 / (omega_t**2 * c_phase_f)
    l_phase_mh = l_phase_h * 1e3

    # 4. Reactor resistance (Q = omega_t * L / R, target Q = 50)
    q_target = 50.0
    r_reactor_ohm = (omega_t * l_phase_h) / q_target

    # Actual quality factor
    q_actual = (omega_t * l_phase_h) / r_reactor_ohm

    # 5. Insertion loss at f_t
    # Z_filter at resonance = R (purely resistive at f_t)
    z_filter_at_ft = r_reactor_ohm
    # System impedance at f_t (approx from fault level, not specified — use typical)
    # Typical: Z_sys = V^2/S_sc, assume S_sc = 2500 MVA (default scenario)
    z_sys = (v_line_v**2) / (2500.0 * 1e6) * (h_tune)  # scales with order
    # Parallel: Z_parallel = (Z_sys * Z_filter) / (Z_sys + Z_filter)
    z_parallel = (z_sys * z_filter_at_ft) / (z_sys + z_filter_at_ft + 1e-9)
    il_db = 20.0 * math.log10(z_sys / (z_parallel + 1e-9)) if z_sys > 0 else 0.0

    # 6. Reactive contribution at fundamental frequency
    # X_C at 50 Hz
    x_c_50 = 1.0 / (omega_1 * c_phase_f)
    # X_L at 50 Hz
    x_l_50 = omega_1 * l_phase_h
    # Net reactance per phase: X_net = X_C - X_L (capacitive)
    x_net = x_c_50 - x_l_50
    # Reactive power per phase: Q = V^2 / X_net
    q_reactive_var = (v_phase_v**2 / x_net) * 3.0  # 3-phase
    q_reactive_mvar = q_reactive_var / 1e6

    # 7. Estimated filter losses
    # Loss in reactor resistance: P = I_h^2 * R * 3 (3 phases)
    # I_h at tuned frequency flows through filter
    i_h_phase = harmonic_current_a / math.sqrt(3.0)
    p_loss_w = 3.0 * i_h_phase**2 * r_reactor_ohm
    p_loss_kw = p_loss_w / 1e3

    assessment = _filter_assessment(il_db, q_actual)

    return {
        "harmonic_order": dominant_harmonic_order,
        "tuned_frequency_hz": round(f_tuned_hz, 2),
        "capacitor_mvar": round(q_reactive_mvar, 3),
        "capacitor_uf": round(c_phase_uf, 4),
        "reactor_mh": round(l_phase_mh, 4),
        "reactor_resistance_ohm": round(r_reactor_ohm, 5),
        "quality_factor": round(q_actual, 1),
        "insertion_loss_db": round(il_db, 1),
        "reactive_contribution_mvar": round(q_reactive_mvar, 3),
        "estimated_loss_kw": round(p_loss_kw, 2),
        "assessment": assessment,
    }


def get_harmonic_limits() -> dict[str, Any]:
    """
    Return IEC 61000-3-6 harmonic planning levels for all voltage tiers.

    Includes PSE (Polish TSO) additional note for 220 kV POC.
    """
    entries = []
    for order in sorted(_IEC61000_3_6.keys()):
        lv, mv, hv = _IEC61000_3_6[order]
        entries.append(
            {
                "order": order,
                "limit_lv_pct": lv,
                "limit_mv_pct": mv,
                "limit_hv_pct": hv,
                "characteristic": _harmonic_family(order),
            }
        )

    return {
        "standard": "IEC 61000-3-6:2008 + Amendment 1:2018",
        "thd_limit_lv_pct": 8.0,
        "thd_limit_mv_pct": 8.0,
        "thd_limit_hv_pct": 3.0,
        "entries": entries,
        "pse_additional_note": (
            "PSE (Polish TSO) applies IEC 61000-3-6 HV limits at the 220 kV POC. "
            "THD_V <= 3%, individual harmonics as per HV column."
        ),
    }


# ── Internal helpers ───────────────────────────────────────────────────────────


def _interpolate_table(table: list[tuple[float, float]], x: float) -> float:
    """Linear interpolation on a sorted (x, y) table. Clamps at bounds."""
    if x <= table[0][0]:
        return table[0][1]
    if x >= table[-1][0]:
        return table[-1][1]
    for i in range(len(table) - 1):
        x0, y0 = table[i]
        x1, y1 = table[i + 1]
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return table[-1][1]


def _assess(thd: float, limit: float, violations: list[str]) -> str:
    """PASS / FAIL / BORDERLINE based on THD and individual violations."""
    if violations:
        return "FAIL"
    margin = (limit - thd) / limit if limit > 0 else 1.0
    if margin < 0.1:
        return "BORDERLINE"
    return "PASS"


def _resonance_risk(impedance_ohm: float, z_base_ohm: float) -> str:
    """Classify resonance peak risk relative to base impedance."""
    ratio = impedance_ohm / (z_base_ohm + 1e-9)
    if ratio > 10.0:
        return "HIGH"
    if ratio > 3.0:
        return "MEDIUM"
    return "LOW"


def _filter_assessment(insertion_loss_db: float, quality_factor: float) -> str:
    """Assess filter design quality."""
    if insertion_loss_db >= 20.0 and 30.0 <= quality_factor <= 80.0:
        return "GOOD — target IL > 20 dB and Q in 30-80 range achieved"
    if insertion_loss_db >= 15.0:
        return "ACCEPTABLE — marginal IL; consider increasing capacitor MVAR"
    return "REVIEW — IL below 15 dB target; increase capacitor bank or check system impedance"
