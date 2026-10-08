"""
Power quality of the 510 MW connection — harmonics, resonance, flicker.

Harmonic network model (positive sequence, per harmonic order h)
----------------------------------------------------------------
Nodes PSE 400 kV — onshore 220 kV — OSS 220 kV — OSS 66 kV, 100 MVA base,
built from the same data as the load flow (``network_model``):

  grid           Thevenin R_g + j h X_g (S_sc, R/X 0.1), shorted source
  transformers   R·√h + j h X   (√h: skin / stray-loss growth of R)
  export cable   2 circuits, exact distributed π (γ, Z_c) — the long-cable
                 capacitance that makes HVAC connections resonate
  shunt reactors 2 × 120 MVAR at each export end, onshore and OSS 220 kV (SB-510)
  array cables   ≈ 15 MVAR of charging lumped at OSS 66 kV

The 34 converters are harmonic current sources at OSS 66 kV. Their emission
(IEC 61400-21 test-report style, % of rated current) is summed with the
IEC 61000-3-6 exponent α (1 for h < 5, 1.4 for 5 ≤ h ≤ 10, 2 above):
I_h,Σ = N^(1/α) · I_h. The harmonic voltage at a node is |Z_node,66(h)|·I_h,Σ.
Not modelled: converter output impedance/filters, loads and background
distortion of the grid — so resonance peaks are upper bounds (least damping).

Planning levels — IEC TR 61000-3-6:2008, Table 2 (MV; HV-EHV ≥ 35 kV)
-----------------------------------------------------------------------
  odd non-triplen: h5 5 / 2, h7 4 / 2, h11 3 / 1.5, h13 2.5 / 1.5,
                   17 ≤ h ≤ 49: 1.9·17/h − 0.2  /  1.2·17/h
  odd triplen:     h3 4 / 2, h9 1.2 / 1, h15 0.3 / 0.3, h ≥ 21: 0.2 / 0.2
  even:            h2 1.8 / 1.4, h4 1 / 0.8, h6 0.5 / 0.4, h8 0.5 / 0.4,
                   h ≥ 10: 0.25·10/h + 0.22  /  0.19·10/h + 0.16
  THD: 6.5 % (MV), 3 % (HV-EHV)
Planning levels bound the *total* distortion; the emission limit PSE would
allocate to this plant is a share of them, so a result close to the planning
level already means trouble. Below 1 kV the IEC 61000-2-2 compatibility
levels are shown instead (there are no LV planning levels).

Flicker — IEC 61400-21 / IEC 61000-3-7
---------------------------------------
  continuous:  P_st = P_lt = c(ψ_k) · √N · S_n / S_k
  switching:   P_st = 18 · N10^0.31 · k_f · S_n / S_k,
               P_lt =  8 · N120^0.31 · k_f · S_n / S_k   (per turbine, cubic sum)
  combined by the cubic law (IEC 61000-3-7). Planning levels HV-EHV:
  P_st 0.8, P_lt 0.6. c and k_f are illustrative full-converter values — the
  V236 IEC 61400-21 report is not public.
"""

from __future__ import annotations

import math
from functools import lru_cache
from typing import Any

import numpy as np

from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    GRID_RX_RATIO,
    GRID_SSC_MVA,
    NUM_ONSHORE_TRANSFORMERS,
    NUM_OSS_TRANSFORMERS,
    SB510,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_66_220_VKR_PERCENT,
    TRAFO_220_400_VK_PERCENT,
    TRAFO_220_400_VKR_PERCENT,
    TURBINE_RATED_MW,
    FarmSpec,
)

S_BASE = 100.0
F0 = 50.0
OMEGA0 = 2.0 * math.pi * F0
NODES = {400.0: 0, 220.0: 2, 66.0: 3}  # viewpoints for the scan (220 → OSS side)
NODE_NAMES = ("PSE 400 kV (POC)", "Onshore 220 kV", "OSS 220 kV", "OSS 66 kV")
ARRAY_CHARGING_MVAR_PER_KM = 15.0 / 51.0  # 500–800 mm² array cable at 66 kV (SB-510: 51 km)
REACTOR_Q_FACTOR = 300.0
CHARACTERISTIC = (5, 7, 11, 13, 17, 19, 23, 25)

# Illustrative full-converter WTG emission [% of rated current] (no public V236 report)
DEFAULT_WTG_EMISSION_PCT: dict[int, float] = {
    2: 0.2, 3: 0.3, 5: 1.0, 7: 0.8, 11: 0.5, 13: 0.4, 17: 0.25, 19: 0.2, 23: 0.15, 25: 0.12,
}  # fmt: skip

# IEC 61000-2-2 compatibility levels (LV) — used only below 1 kV
_LV_COMPAT: dict[int, float] = {
    2: 2.0, 3: 5.0, 4: 1.0, 5: 6.0, 6: 0.5, 7: 5.0, 8: 0.5, 9: 1.5, 11: 3.5, 13: 3.0, 15: 0.4,
    17: 2.0, 19: 1.5, 21: 0.3, 23: 1.5, 25: 1.5,
}  # fmt: skip
THD_LIMIT = {"LV": 8.0, "MV": 6.5, "HV": 3.0}


# ── Planning levels ──────────────────────────────────────────────


def _voltage_tier(voltage_kv: float) -> str:
    if voltage_kv < 1.0:
        return "LV"
    return "MV" if voltage_kv < 35.0 else "HV"


def _harmonic_family(order: int) -> str:
    if order % 2 == 0:
        return "EVEN"
    return "ODD_TRIPLE" if order % 3 == 0 else "ODD_NON_TRIPLE"


def planning_level_pct(order: int, tier: str) -> float:
    """IEC TR 61000-3-6 Table 2 planning level [% of U1] (LV: 61000-2-2 compatibility)."""
    if tier == "LV":
        return _LV_COMPAT.get(order, 0.2 if order % 2 else 0.25 * 10 / order + 0.25)
    mv = tier == "MV"
    fixed = {
        2: (1.8, 1.4), 3: (4.0, 2.0), 4: (1.0, 0.8), 5: (5.0, 2.0), 6: (0.5, 0.4),
        7: (4.0, 2.0), 8: (0.5, 0.4), 9: (1.2, 1.0), 11: (3.0, 1.5), 13: (2.5, 1.5), 15: (0.3, 0.3),
    }  # fmt: skip
    if order in fixed:
        return fixed[order][0 if mv else 1]
    if order % 2 == 0:
        return round(0.25 * 10 / order + 0.22 if mv else 0.19 * 10 / order + 0.16, 3)
    if order % 3 == 0:
        return 0.2
    return round(1.9 * 17 / order - 0.2 if mv else 1.2 * 17 / order, 3)


# ── Harmonic network ─────────────────────────────────────────────


def _admittance(
    h: float, grid_ssc_mva: float, export_length_km: float, spec: FarmSpec = SB510
) -> np.ndarray:
    """4 × 4 nodal admittance [pu, 100 MVA] at harmonic order h (may be non-integer)."""
    y = np.zeros((4, 4), dtype=complex)

    def branch(a: int, b: int, z: complex) -> None:
        y[a, a] += 1 / z
        y[b, b] += 1 / z
        y[a, b] -= 1 / z
        y[b, a] -= 1 / z

    def trafo(vk: float, vkr: float, s_mva: float) -> complex:
        z, r = vk / 100 * S_BASE / s_mva, vkr / 100 * S_BASE / s_mva
        return complex(r * math.sqrt(h), h * math.sqrt(z * z - r * r))

    xg = S_BASE / grid_ssc_mva / math.sqrt(1 + GRID_RX_RATIO**2)
    y[0, 0] += 1 / complex(GRID_RX_RATIO * xg * math.sqrt(h), h * xg)
    s_onshore = NUM_ONSHORE_TRANSFORMERS * spec.onshore_trafo_mva
    branch(0, 1, trafo(TRAFO_220_400_VK_PERCENT, TRAFO_220_400_VKR_PERCENT, s_onshore))

    c = EXPORT_CABLE_1000
    z_km = complex(c.r_ac_ohm_per_km * math.sqrt(h), h * c.x_ohm_per_km)
    y_km = complex(0.0, h * OMEGA0 * c.c_nf_per_km * 1e-9)
    gamma, zc = np.sqrt(z_km * y_km), np.sqrt(z_km / y_km)
    z_base = 220.0**2 / S_BASE
    gl = gamma * export_length_km
    n_export = spec.num_export_cables
    branch(1, 2, complex(zc * np.sinh(gl) / n_export / z_base))
    y_end = complex(n_export * np.tanh(gl / 2) / zc * z_base)
    y[1, 1] += y_end
    y[2, 2] += y_end

    if spec.reactor_mvar_per_end > 0:  # one bank at each cable end (onshore 1, OSS 2)
        x_r = S_BASE / spec.reactor_mvar_per_end
        for node in (1, 2):
            y[node, node] += 1 / complex(h * x_r / REACTOR_Q_FACTOR, h * x_r)
    s_oss = NUM_OSS_TRANSFORMERS * spec.oss_trafo_mva
    branch(2, 3, trafo(TRAFO_66_220_VK_PERCENT, TRAFO_66_220_VKR_PERCENT, s_oss))
    array_km = spec.num_turbines * spec.array_cable_length_km
    y[3, 3] += complex(0.0, h * ARRAY_CHARGING_MVAR_PER_KM * array_km / S_BASE)
    return y


@lru_cache(maxsize=4096)
def _impedance_column(
    h: float, grid_ssc_mva: float, export_length_km: float, spec: FarmSpec = SB510
) -> tuple[complex, complex, complex, complex]:
    """Z(node, OSS 66 kV) [pu] for all nodes — voltage per unit current injected at 66 kV."""
    z = np.linalg.inv(_admittance(h, grid_ssc_mva, export_length_km, spec))
    return tuple(complex(v) for v in z[:, 3])  # type: ignore[return-value]


def summation_exponent(order: int) -> float:
    """IEC 61000-3-6 summation exponent α for harmonic currents of many sources."""
    return 1.0 if order < 5 else 1.4 if order <= 10 else 2.0


# ── Harmonics ────────────────────────────────────────────────────


def compute_harmonics(
    harmonic_magnitudes: dict[int, float],
    voltage_kv: float = 400.0,
    rated_mw: float = 510.0,
    grid_ssc_mva: float = GRID_SSC_MVA,
    export_length_km: float | None = None,
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """Harmonic voltages caused by the farm's emission, judged at one bus.

    ``harmonic_magnitudes``: WTG current emission {order: % of rated current}.
    ``voltage_kv`` selects the assessed bus (400 = POC, 220 = OSS 220 kV, 66).
    """
    if export_length_km is None:
        export_length_km = spec.export_length_km
    node = NODES.get(voltage_kv, 0)
    tier = _voltage_tier(voltage_kv)
    n_wtg = max(1, round(rated_mw / TURBINE_RATED_MW))
    i_wtg_pu = TURBINE_RATED_MW / S_BASE

    rows = []
    for order in sorted(h for h in harmonic_magnitudes if 2 <= h <= 50):
        i_pct = harmonic_magnitudes[order]
        if i_pct <= 0:
            continue
        i_sum = n_wtg ** (1 / summation_exponent(order)) * i_wtg_pu * i_pct / 100
        z_col = _impedance_column(float(order), grid_ssc_mva, export_length_km, spec)
        v_pct = abs(z_col[node]) * i_sum * 100
        v66 = abs(z_col[3]) * i_sum * 100
        limit = planning_level_pct(order, tier)
        rows.append(
            {
                "order": order,
                "frequency_hz": order * F0,
                "current_pct": round(i_pct, 3),
                "magnitude_pct": round(v_pct, 3),
                "voltage_66kv_pct": round(v66, 3),
                "impedance_ohm": round(abs(z_col[3]) * 66.0**2 / S_BASE, 2),
                "limit_pct": limit,
                "utilisation_pct": round(v_pct / limit * 100, 1),
                "exceeds_limit": v_pct > limit,
            }
        )

    thd_v = math.sqrt(sum(r["magnitude_pct"] ** 2 for r in rows))
    thd_i = math.sqrt(sum(v**2 for h, v in harmonic_magnitudes.items() if 2 <= h <= 50))
    dominant = max(rows, key=lambda r: r["utilisation_pct"], default=None)
    violations = [
        f"H{r['order']}: {r['magnitude_pct']:.2f} % > {r['limit_pct']:.2f} %"
        for r in rows
        if r["exceeds_limit"]
    ]
    if thd_v > THD_LIMIT[tier]:
        violations.insert(0, f"THD {thd_v:.2f} % > {THD_LIMIT[tier]} %")
    worst = max((r["utilisation_pct"] for r in rows), default=0.0)
    return {
        "thd_voltage_pct": round(thd_v, 3),
        "thd_current_pct": round(thd_i, 3),
        "dominant_harmonic_order": dominant["order"] if dominant else 0,
        "dominant_harmonic_pct": dominant["magnitude_pct"] if dominant else 0.0,
        "harmonics": rows,
        "compliant": not violations,
        "voltage_level": tier,
        "bus": NODE_NAMES[node],
        "thd_limit_pct": THD_LIMIT[tier],
        "worst_utilisation_pct": worst,
        "violations": violations,
        "assessment": "FAIL" if violations else "BORDERLINE" if worst > 50 else "PASS",
    }


# ── Resonance scan ───────────────────────────────────────────────


def compute_resonance_scan(
    cable_length_km: float = EXPORT_CABLE_LENGTH_KM,
    voltage_kv: float = 66.0,
    grid_fault_level_mva: float = GRID_SSC_MVA,
    scan_max_hz: float = 2500.0,
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """|Z(f)| seen from a bus, 50 Hz … scan_max, and its parallel resonances.

    Each peak is rated by its amplification: |Z(f)| over what the network's
    50 Hz short-circuit inductance alone would give at that frequency
    (h·|Z(50 Hz)|). > 3 medium, > 10 high risk.
    """
    node = NODES.get(voltage_kv, 3)
    z_base = (voltage_kv if voltage_kv in NODES else 66.0) ** 2 / S_BASE
    freqs = np.arange(F0, scan_max_hz + 1e-9, 5.0)
    z_pu = np.array(
        [
            abs(_impedance_column(float(f) / F0, grid_fault_level_mva, cable_length_km, spec)[node])
            for f in freqs
        ]
    )
    # Driving-point impedance at the viewpoint bus: column 3 is only exact for the
    # 66 kV bus, so use the full inverse for the other viewpoints
    if node != 3:
        z_pu = np.array(
            [
                abs(
                    np.linalg.inv(
                        _admittance(float(f) / F0, grid_fault_level_mva, cable_length_km, spec)
                    )[node, node]
                )
                for f in freqs
            ]
        )
    z50 = z_pu[0]
    points: list[dict[str, Any]] = []
    for i in range(1, len(freqs) - 1):
        if z_pu[i] > z_pu[i - 1] and z_pu[i] > z_pu[i + 1]:
            h = freqs[i] / F0
            amp = z_pu[i] / (h * z50)
            if amp < 1.0:
                continue
            points.append(
                {
                    "frequency_hz": round(float(freqs[i]), 1),
                    "impedance_ohm": round(float(z_pu[i] * z_base), 2),
                    "harmonic_order": round(float(h), 2),
                    "amplification": round(float(amp), 1),
                    "risk_level": "HIGH" if amp > 10 else "MEDIUM" if amp > 3 else "LOW",
                }
            )
    near = [p for p in points if p["risk_level"] != "LOW"]
    critical = sorted(
        {h for h in CHARACTERISTIC for p in near if abs(p["harmonic_order"] - h) <= 1}
    )
    rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
    worst = max((str(p["risk_level"]) for p in points), key=rank.__getitem__, default="LOW")
    first = points[0]["frequency_hz"] if points else 0.0
    return {
        "frequencies_hz": [round(float(f), 1) for f in freqs],
        "impedances_ohm": [round(float(z * z_base), 3) for z in z_pu],
        "resonance_points": points,
        "cable_resonant_freq_hz": first,
        "critical_harmonics": critical,
        "viewpoint": NODE_NAMES[node],
        "assessment": (
            f"HIGH — {', '.join(f'h{h}' for h in critical)} sit near a weakly damped resonance; "
            "check converter emission there, consider a damped filter"
            if worst == "HIGH" and critical
            else "MEDIUM — resonance near characteristic harmonics; verify with converter models"
            if critical
            else "LOW — no amplified resonance near the characteristic harmonics"
        ),
    }


# ── Flicker ──────────────────────────────────────────────────────

_C_TABLE = [(30.0, 0.38), (50.0, 0.27), (70.0, 0.21), (85.0, 0.18)]  # c(ψk), illustrative
_KF_TABLE = [(30.0, 0.065), (50.0, 0.052), (70.0, 0.042), (85.0, 0.037)]  # k_f(ψk), illustrative
PST_PLANNING_HV = 0.8
PLT_PLANNING_HV = 0.6


def compute_flicker(
    rated_mw: float = 510.0,
    grid_fault_level_mva: float = GRID_SSC_MVA,
    grid_impedance_angle_deg: float = 84.3,
    annual_switching_operations: int = 1000,
) -> dict[str, Any]:
    """P_st / P_lt of the farm at the POC (IEC 61400-21, cubic summation)."""
    n = max(1, round(rated_mw / TURBINE_RATED_MW))
    s_n = TURBINE_RATED_MW / 0.95  # MVA at rated power, cos φ 0.95
    c = _interpolate_table(_C_TABLE, grid_impedance_angle_deg)
    k_f = _interpolate_table(_KF_TABLE, grid_impedance_angle_deg)

    p_cont = c * math.sqrt(n) * s_n / grid_fault_level_mva
    ops_per_turbine_year = annual_switching_operations / n
    n10 = ops_per_turbine_year / (365.25 * 24 * 6)
    n120 = ops_per_turbine_year / (365.25 * 12)
    # per turbine, then cubic sum over n turbines: (n · P³)^(1/3)
    pst_sw = n ** (1 / 3) * 18 * n10**0.31 * k_f * s_n / grid_fault_level_mva if n10 > 0 else 0.0
    plt_sw = n ** (1 / 3) * 8 * n120**0.31 * k_f * s_n / grid_fault_level_mva if n120 > 0 else 0.0
    pst = (p_cont**3 + pst_sw**3) ** (1 / 3)
    plt = (p_cont**3 + plt_sw**3) ** (1 / 3)
    worst = max(pst / PST_PLANNING_HV, plt / PLT_PLANNING_HV)
    return {
        "pst": round(pst, 4),
        "plt": round(plt, 4),
        "pst_limit": PST_PLANNING_HV,
        "plt_limit": PLT_PLANNING_HV,
        "pst_compliant": pst <= PST_PLANNING_HV,
        "plt_compliant": plt <= PLT_PLANNING_HV,
        "pst_continuous": round(p_cont, 5),
        "pst_switching": round(pst_sw, 5),
        "flicker_coefficient": round(c, 3),
        "switching_coefficient": round(k_f, 4),
        "dominant_source": "SWITCHING" if pst_sw > p_cont else "CONTINUOUS_OPERATION",
        "assessment": "FAIL" if worst > 1 else "BORDERLINE" if worst > 0.5 else "PASS",
    }


# ── Filter design ────────────────────────────────────────────────


def design_passive_filter(
    dominant_harmonic_order: int,
    harmonic_current_a: float,
    system_voltage_kv: float = 66.0,
    rated_mvar: float = 10.0,
    grid_ssc_mva: float = GRID_SSC_MVA,
    export_length_km: float | None = None,
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """Single-tuned filter at the OSS 66 kV bus, tuned 3 % below the target order.

    Insertion loss is evaluated against the network's own harmonic impedance
    at the tuned frequency (harmonic model above), not a generic S_sc.
    """
    detuning = 0.03
    h_t = dominant_harmonic_order * (1 - detuning)
    omega_t = OMEGA0 * h_t
    v = system_voltage_kv * 1e3
    c_f = rated_mvar * 1e6 / (OMEGA0 * v**2)
    l_h = 1 / (omega_t**2 * c_f)
    q_target = 50.0
    r = omega_t * l_h / q_target
    z_base = system_voltage_kv**2 / S_BASE
    if export_length_km is None:
        export_length_km = spec.export_length_km
    z_col = _impedance_column(dominant_harmonic_order, grid_ssc_mva, export_length_km, spec)
    z_net = z_col[3] * z_base
    h = dominant_harmonic_order
    z_filter = complex(r, h * OMEGA0 * l_h - 1 / (h * OMEGA0 * c_f))
    z_parallel = z_net * z_filter / (z_net + z_filter)
    il_db = 20 * math.log10(abs(z_net) / abs(z_parallel))
    x_net_50 = 1 / (OMEGA0 * c_f) - OMEGA0 * l_h
    q_50 = v**2 / x_net_50 / 1e6
    i_ph = harmonic_current_a
    p_loss_kw = 3 * i_ph**2 * r / 1e3
    good = il_db >= 20
    return {
        "harmonic_order": h,
        "tuned_frequency_hz": round(h_t * F0, 2),
        "capacitor_mvar": round(rated_mvar, 3),
        "capacitor_uf": round(c_f * 1e6, 4),
        "reactor_mh": round(l_h * 1e3, 4),
        "reactor_resistance_ohm": round(r, 5),
        "quality_factor": q_target,
        "insertion_loss_db": round(il_db, 1),
        "reactive_contribution_mvar": round(q_50, 3),
        "estimated_loss_kw": round(p_loss_kw, 2),
        "network_impedance_ohm": round(abs(z_net), 2),
        "assessment": (
            "GOOD — ≥ 20 dB attenuation at the target order"
            if good
            else "ACCEPTABLE — 10–20 dB attenuation"
            if il_db >= 10
            else "REVIEW — little attenuation: the network is already low-impedance here"
        ),
    }


def get_harmonic_limits() -> dict[str, Any]:
    """IEC TR 61000-3-6 planning levels (MV, HV-EHV) and LV compatibility levels."""
    return {
        "standard": "IEC TR 61000-3-6:2008 Table 2 (planning); IEC 61000-2-2 (LV compatibility)",
        "thd_limit_lv_pct": THD_LIMIT["LV"],
        "thd_limit_mv_pct": THD_LIMIT["MV"],
        "thd_limit_hv_pct": THD_LIMIT["HV"],
        "entries": [
            {
                "order": h,
                "limit_lv_pct": planning_level_pct(h, "LV"),
                "limit_mv_pct": planning_level_pct(h, "MV"),
                "limit_hv_pct": planning_level_pct(h, "HV"),
                "characteristic": _harmonic_family(h),
            }
            for h in range(2, 26)
        ],
        "pse_additional_note": (
            "Planning levels bound the total distortion at a bus. The emission limit a TSO "
            "allocates to one plant is a share of them (IEC 61000-3-6 stage 2/3), so "
            "plant contributions near the planning level are already a problem."
        ),
    }


def _interpolate_table(table: list[tuple[float, float]], x: float) -> float:
    """Linear interpolation on a sorted (x, y) table, clamped at the ends."""
    xs, ys = zip(*table, strict=True)
    return float(np.interp(x, xs, ys))
