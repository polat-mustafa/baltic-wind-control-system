"""
Cable DTS thermal monitoring — M10.

One circuit of the 220 kV export cable (network_model.EXPORT_CABLE_1000: 3-core
XLPE, 1000 mm² Cu, 825 A static rating — ABB/NKT 2GM5007 rev 5 Table 34, one cable
1 m deep in a 20 °C seabed of 1.0 K·m/W — 108 km). The farm has two circuits,
each with its own fibre, so ``current_a`` is the per-circuit current
(≈ 818 A at the OSS end of each circuit at 510 MW, P2 load flow — 99 % of the
rating, the charging current of 108 km takes much of it; ≈ 1 438 A on the
survivor after an N-1 trip, before the runback).

What DTS measures, and what it does not
---------------------------------------
Raman DTS reads the temperature of an optical fibre laid in the cable
(between the cores, under the armour) — not the conductor. The conductor
temperature that limits the cable is estimated from the fibre reading plus
the internal temperature rise, which needs the current and a thermal model.
That estimate is what real-time thermal rating (RTTR) systems run on.

Steady-state thermal circuit (IEC 60287-1-1 structure, per conductor)
--------------------------------------------------------------------
    T_c − T_amb = (W_c + ½W_d)·T_int + (W_c + W_d)·R_ext(zone)
    T_f − T_amb = (W_c + W_d)·R_ext(zone)                    (fibre)

- W_c = I²·R_AC(T_c): R_DC,20 = 0.0176 Ω/km (IEC 60228), α = 0.00393 /K,
  skin + proximity factor 1.039 → R_AC,90 = 0.0233 Ω/km. R_AC rises with the
  conductor temperature, so T_c is solved from a linear equation; when
  I²·R·α·(T_int + R_ext) ≥ 1 there is no steady state (thermal runaway).
- W_d = ω·C·U0²·tan δ: dielectric loss, which IEC 60287-1-1 requires for XLPE
  from U0 = 127 kV — exactly this cable's 220/√3 kV. C = 190 nF/km, tan δ =
  0.001 (IEC 60287-1-1 Table 3) → ≈ 0.96 W/m per core.
- T_int = 0.5 K·m/W: conductor → fibre (insulation and screens) — assumption.
- R_ext(zone): fibre → ambient per unit of one conductor's loss, so it holds
  the mutual heating of the three cores. Calibrated so that the datasheet rating
  (825 A) at its 20 °C reference ambient brings the worst zone (OSS J-tube) to
  exactly 90 °C; the other zones are set relative to it (assumed ratios, not a
  survey).

Route zones (km from the OSS; geometry: frontend constants/windFarmLayout.ts)
- J-tube 0–0.3 km: cable in air in a steel tube on the OSS — worst cooling.
- Subsea burial 0.3–78.7 km: 1–2 m in seabed sediment; ±5 % from burial depth.
- HDD landfall 78.7–79.5 km at Darłówko-Wschodnie (coast at 79.3 km): 10–15 m
  under beach and dunes.
- Land cable 79.5–108 km: direct-buried to the onshore substation at Krzemienica.
One ambient temperature applies to the whole route — a simplification (air,
seabed and soil differ in reality). The current is taken as uniform; in a
108 km HVAC cable the charging current (≈ 820 A at full length) makes it vary
along the route, depending on where the shunt reactors sit.

Transient (N-1 emergency loading)
---------------------------------
Two-node thermal ladder per zone (conductor, fibre/armour) with thermal
capacitances, the form IEC 60853-2 reduces a cable to. Time constants are
assumptions: internal ≈ 1 h (copper + inner insulation ≈ 7 kJ/(m·K) per core
× T_int); external ≈ 20 h in the J-tube, where only the cable's own outer
layers (≈ 25 kJ/(m·K) per core) store heat, and longer where soil takes part:
48 h subsea, 72 h land, 150 h under the deep HDD.

Limits: 90 °C continuous conductor temperature for XLPE (IEC 62067). The
80 °C DTS alarm (10 K below the limit) is an operator setting, not a standard value;
at full load the J-tube runs at ≈ 82 °C (818 A, 15 °C) —
above the alarm, below the limit: the 108 km circuits run at 99 % of their rating.
"""

from __future__ import annotations

import math
import random
from typing import Any

from app.services.p2.network_model import EXPORT_CABLE_1000, EXPORT_CABLE_LENGTH_KM

CABLE_LENGTH_KM = EXPORT_CABLE_LENGTH_KM
N_POINTS = round(CABLE_LENGTH_KM * 10)  # one reading per 100 m
STATIC_RATING_A = EXPORT_CABLE_1000.max_i_ka * 1000.0  # 825 A per circuit (datasheet)
NUM_CIRCUITS = 2
U_KV = 220.0

T_CONDUCTOR_MAX = 90.0  # XLPE continuous limit [°C], IEC 62067
T_AMBIENT_DESIGN = 20.0  # datasheet reference: seabed 20 °C [°C]
T_ALARM = 80.0  # DTS alarm — operator setting, 10 K below the limit [°C]

ALPHA_CU = 0.00393  # [1/K] at 20 °C
R_AC20_OHM_PER_M = EXPORT_CABLE_1000.r_ohm_per_km * EXPORT_CABLE_1000.ac_factor / 1000.0
R_AC90_OHM_PER_M = R_AC20_OHM_PER_M * (1 + ALPHA_CU * (T_CONDUCTOR_MAX - 20.0))

TAN_DELTA = 0.001
U0_V = U_KV * 1e3 / math.sqrt(3)
W_DIELECTRIC = 2 * math.pi * 50 * EXPORT_CABLE_1000.c_nf_per_km * 1e-12 * U0_V**2 * TAN_DELTA

T_INT = 0.5  # conductor → fibre [K·m/W] — assumption
TAU_INT_H = 1.0  # internal time constant — assumption

J_TUBE_END_KM = 0.3
HDD_START_KM = 78.7
HDD_END_KM = 79.5

# name, start km, end km, R_ext relative to the J-tube, external time constant [h]
ZONES: tuple[tuple[str, float, float, float, float], ...] = (
    ("OSS J-tube", 0.0, J_TUBE_END_KM, 1.0, 20.0),
    ("Subsea burial", J_TUBE_END_KM, HDD_START_KM, 1.0 / 1.4, 48.0),
    ("HDD landfall", HDD_START_KM, HDD_END_KM, 1.3 / 1.4, 150.0),
    ("Land cable", HDD_END_KM, CABLE_LENGTH_KM, 1.1 / 1.4, 72.0),
)

# Calibration: 825 A, 20 °C ambient, J-tube → 90 °C
_W_C_RATED = STATIC_RATING_A**2 * R_AC90_OHM_PER_M
R_EXT_J_TUBE = (T_CONDUCTOR_MAX - T_AMBIENT_DESIGN - (_W_C_RATED + W_DIELECTRIC / 2) * T_INT) / (
    _W_C_RATED + W_DIELECTRIC
)  # ≈ 2.9 K·m/W


def _zone(km: float) -> tuple[str, float, float, float, float]:
    return next((z for z in ZONES if km <= z[2]), ZONES[-1])


def _r_ext(km: float) -> float:
    name, *_, rel, _tau = _zone(km)
    r = R_EXT_J_TUBE * rel
    if name == "Subsea burial":
        r *= 1 + 0.05 * math.sin(2 * math.pi * km / 8.0)  # burial depth variation
    return r


def steady_temps(current_a: float, ambient_c: float, r_ext: float) -> tuple[float, float]:
    """Conductor and fibre temperature [°C] in steady state; inf on thermal runaway."""
    a = current_a**2 * R_AC20_OHM_PER_M  # W_c at 20 °C [W/m]
    k = T_INT + r_ext
    denom = 1 - a * k * ALPHA_CU
    if denom <= 0:
        return math.inf, math.inf
    t_c = (ambient_c + a * k * (1 - 20 * ALPHA_CU) + W_DIELECTRIC * (T_INT / 2 + r_ext)) / denom
    w_c = a * (1 + ALPHA_CU * (t_c - 20))
    return t_c, ambient_c + (w_c + W_DIELECTRIC) * r_ext


def rating_a(ambient_c: float, r_ext: float) -> float:
    """Current [A] that holds the conductor at 90 °C (IEC 60287 steady state)."""
    margin = T_CONDUCTOR_MAX - ambient_c - W_DIELECTRIC * (T_INT / 2 + r_ext)
    if margin <= 0:
        return 0.0
    return math.sqrt(margin / (R_AC90_OHM_PER_M * (T_INT + r_ext)))


def _route_rating(ambient_c: float) -> tuple[float, str]:
    """Route rating = the lowest zone rating, and the zone that sets it."""
    return min((rating_a(ambient_c, R_EXT_J_TUBE * z[3]), z[0]) for z in ZONES)


def export_capability_mva(current_a: float) -> float:
    """Apparent power both circuits carry at current_a each [MVA]."""
    return math.sqrt(3) * U_KV * current_a / 1000.0 * NUM_CIRCUITS


def simulate_dts(current_a: float = 818.0, ambient_temp_c: float = 15.0) -> dict[str, Any]:
    """DTS profile of one circuit: fibre reading and conductor estimate every 100 m."""
    rng = random.Random(int(current_a * 100 + ambient_temp_c * 10))
    step = CABLE_LENGTH_KM / N_POINTS
    profile: list[dict[str, Any]] = []
    zone_max: dict[str, dict[str, float]] = {}
    for i in range(N_POINTS):
        km = round((i + 0.5) * step, 3)
        name = _zone(km)[0]
        t_c, t_f = steady_temps(current_a, ambient_temp_c, _r_ext(km))
        noise = rng.gauss(0.0, 0.3)  # DTS reading noise σ = 0.3 °C (assumed)
        point: dict[str, Any] = {
            "distance_km": km,
            "zone": name,
            "fibre_temp_c": round(t_f + noise, 1) if math.isfinite(t_f) else 999.0,
            "conductor_temp_c": round(t_c + noise, 1) if math.isfinite(t_c) else 999.0,
        }
        profile.append(point)
        zm = zone_max.setdefault(name, {"c": -math.inf, "f": -math.inf})
        zm["c"] = max(zm["c"], point["conductor_temp_c"])
        zm["f"] = max(zm["f"], point["fibre_temp_c"])

    zones = [
        {
            "name": name,
            "start_km": start,
            "end_km": end,
            "r_ext_k_m_per_w": round(R_EXT_J_TUBE * rel, 2),
            "max_conductor_c": zone_max[name]["c"],
            "max_fibre_c": zone_max[name]["f"],
            "rating_a": round(rating_a(ambient_temp_c, R_EXT_J_TUBE * rel), 0),
        }
        for name, start, end, rel, _tau in ZONES
    ]
    hottest = max(profile, key=lambda p: p["conductor_temp_c"])
    alarm_km = round(sum(step for p in profile if p["conductor_temp_c"] >= T_ALARM), 1)
    route_rating, limiting_zone = _route_rating(ambient_temp_c)
    w_c = current_a**2 * R_AC20_OHM_PER_M * (1 + ALPHA_CU * (hottest["conductor_temp_c"] - 20))

    t_max = hottest["conductor_temp_c"]
    where = f"{hottest['zone']} ({hottest['distance_km']:.2f} km)"
    if t_max >= T_CONDUCTOR_MAX:
        assessment = f"OVER LIMIT — {t_max:.1f} °C in the {where}; reduce the current"
    elif t_max >= T_ALARM:
        assessment = f"ALARM — {t_max:.1f} °C in the {where}, above the {T_ALARM:.0f} °C setting"
    else:
        assessment = f"NORMAL — hottest {t_max:.1f} °C in the {where}"

    return {
        "current_a": current_a,
        "ambient_temp_c": ambient_temp_c,
        "cable_length_km": CABLE_LENGTH_KM,
        "profile": profile,
        "zones": zones,
        "max_conductor_c": t_max,
        "max_location_km": hottest["distance_km"],
        "alarm_length_km": alarm_km,
        "joule_loss_w_per_m": round(w_c, 2),
        "dielectric_loss_w_per_m": round(W_DIELECTRIC, 2),
        "static_rating_a": STATIC_RATING_A,
        "rating_at_ambient_a": round(route_rating, 0),
        "limiting_zone": limiting_zone,
        "export_capability_mva": round(export_capability_mva(route_rating), 0),
        "rating_curve": rating_curve(),
        "assessment": assessment,
    }


def rating_curve() -> dict[str, Any]:
    """Steady-state rating of each zone against ambient temperature, 0–30 °C."""
    ambient = list(range(0, 31, 2))
    return {
        "ambient_c": ambient,
        "zones": [
            {
                "name": z[0],
                "rating_a": [round(rating_a(t, R_EXT_J_TUBE * z[3]), 1) for t in ambient],
            }
            for z in ZONES
        ],
    }


def simulate_transient(
    prefault_current_a: float = 818.0,
    emergency_current_a: float = 1438.0,
    ambient_temp_c: float = 15.0,
    duration_h: float = 24.0,
) -> dict[str, Any]:
    """
    Conductor temperature per zone after a current step at t = 0 (N-1 loading).

    Two-node ladder, conductor (C_i) and fibre/armour (C_e):
        C_i·dT_c/dt = W_c(T_c) + ½W_d − (T_c − T_f)/T_int
        C_e·dT_f/dt = (T_c − T_f)/T_int + ½W_d − (T_f − T_amb)/R_ext
    with C_i = τ_int/T_int and C_e = τ_ext/R_ext. Starts from the pre-fault
    steady state; explicit Euler, 30 s step.
    """
    dt_s = 30.0
    n = round(duration_h * 3600 / dt_s)
    every = 20  # report every 10 min
    time_h = [round(k * dt_s / 3600, 3) for k in range(0, n + 1, every)]
    zones: list[dict[str, Any]] = []
    for name, _s, _e, rel, tau_ext_h in ZONES:
        r_ext = R_EXT_J_TUBE * rel
        c_i = TAU_INT_H * 3600 / T_INT
        c_e = tau_ext_h * 3600 / r_ext
        t_c, t_f = steady_temps(prefault_current_a, ambient_temp_c, r_ext)
        series, t_limit = [round(t_c, 2)], None
        for k in range(1, n + 1):
            w_c = emergency_current_a**2 * R_AC20_OHM_PER_M * (1 + ALPHA_CU * (t_c - 20))
            q_int = (t_c - t_f) / T_INT
            t_c += dt_s * (w_c + W_DIELECTRIC / 2 - q_int) / c_i
            t_f += dt_s * (q_int + W_DIELECTRIC / 2 - (t_f - ambient_temp_c) / r_ext) / c_e
            if t_limit is None and t_c >= T_CONDUCTOR_MAX:
                t_limit = round(k * dt_s / 60, 1)
            if k % every == 0:
                series.append(round(t_c, 2))
        final, _ = steady_temps(emergency_current_a, ambient_temp_c, r_ext)
        zones.append(
            {
                "name": name,
                "tau_ext_h": tau_ext_h,
                "conductor_temp_c": series,
                "minutes_to_limit": t_limit,
                "steady_state_c": round(final, 1) if math.isfinite(final) else None,
            }
        )

    limits = [z["minutes_to_limit"] for z in zones if z["minutes_to_limit"] is not None]
    allowed = min(limits) if limits else None
    if allowed is None:
        first = None
        assessment = (
            f"{emergency_current_a:.0f} A can be carried for {duration_h:.0f} h "
            "without reaching 90 °C"
        )
    else:
        first = min(
            (z for z in zones if z["minutes_to_limit"] is not None),
            key=lambda z: z["minutes_to_limit"],
        )["name"]
        assessment = (
            f"{first} reaches 90 °C after {allowed:.0f} min at {emergency_current_a:.0f} A — "
            "curtail before then"
        )
    return {
        "prefault_current_a": prefault_current_a,
        "emergency_current_a": emergency_current_a,
        "ambient_temp_c": ambient_temp_c,
        "time_h": time_h,
        "zones": zones,
        "allowed_minutes": allowed,
        "limiting_zone": first,
        "assessment": assessment,
    }
