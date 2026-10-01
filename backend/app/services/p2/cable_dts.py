"""
Cable DTS Thermal Monitoring service — M10.

Physics layers
--------------
1. IEC 60287 steady-state thermal model
   T_conductor = T_ambient + I² × R_AC × R_thermal_total
   where R_thermal_total = T1 + T2 + T3 + T4 [K·m/W] (insulation + jacket + soil layers)

   Export cable = network_model.EXPORT_CABLE_1000 (single source of truth):
   220 kV 3-core XLPE, 1000 mm² Cu, 950 A static rating PER CIRCUIT, 45 km.
   The farm has 2 parallel circuits; each has its own DTS fibre, so this model
   simulates ONE circuit and ``current_a`` is the per-circuit current
   (≈ 730 A per circuit at 510 MW; ~1 360 A on the survivor right after an N-1 trip).

   R_AC at 90 °C (IEC 60287-1-1 §2.1):
     R_DC,20 = 0.0176 Ω/km                       (IEC 60228, 1000 mm² Cu)
     R_DC,90 = R_DC,20 × (1 + 0.00393 × 70)      = 0.02244 Ω/km
     R_AC,90 = R_DC,90 × (1 + y_s + y_p)          = 0.0233 Ω/km
       y_s ≈ 0.030 (skin, Milliken conductor k_s = 0.435)
       y_p ≈ 0.009 (proximity, k_p = 0.37, d_c ≈ 38 mm, core spacing s ≈ 120 mm)

   R_th is calibrated so the static rating is exactly the current that brings
   the worst spot (J-tube, zone factor 1.4) to 90 °C at 15 °C design ambient:
     R_th = (90 − 15) / (950² × R_AC,90 [Ω/m] × 1.4) ≈ 2.55 K·m/W
   (per metre — the cable length does not enter the thermal balance)

2. Spatial variation along the real 45 km route (km measured from the OSS)
   - J-tube on the OSS (0–0.3 km): cable in air inside a steel tube → worst cooling
   - Subsea burial (0.3–31.0 km): ~1–2 m in seabed sediment, good cooling
   - HDD landfall at Zaleskie (31.0–31.8 km): drilled 10–15 m under beach and dunes
     → high soil thermal resistance, the classic onshore hotspot
   - Land cable (31.8–45 km): direct-buried in soil to the onshore substation;
     soil drying in summer raises R_th
   (route geometry: frontend constants/windFarmLayout.ts, 31.5 km subsea + 13.4 km land)

3. Dynamic rating
   I_dynamic = I_static × sqrt((T_max - T_ambient_actual) / (T_max - T_ambient_design))
   Winter (T_amb = 4°C vs design 15°C): I_dynamic ≈ 950 × sqrt(86/75) ≈ 1017 A
   Summer (T_amb = 22°C vs design 15°C): I_dynamic ≈ 950 × sqrt(68/75) ≈ 905 A

4. Hotspot detection
   WARNING: T_conductor > 70°C (IEC 60502-2 alarm threshold)
   CRITICAL: T_conductor > 90°C (rated operating limit — forced derating required)

References
----------
IEC 60228:2004     — Conductors of insulated cables (DC resistance at 20 °C)
IEC 60287-1-1:2014 — Electric cables: current rating
IEC 60287-2-1:2015 — Thermal resistance
IEC 62067:2011     — Power cables above 150 kV (our 220 kV cable)
"""

from __future__ import annotations

import math
import random
from typing import Any

from app.services.p2.network_model import EXPORT_CABLE_1000, EXPORT_CABLE_LENGTH_KM

# ── Cable constants — one circuit of EXPORT_CABLE_1000 (220 kV, 1000 mm² Cu) ──

CABLE_LENGTH_KM = EXPORT_CABLE_LENGTH_KM
N_POINTS = 450  # 1 point per 100 m
STATIC_RATING_A = EXPORT_CABLE_1000.max_i_ka * 1000.0  # 950 A per circuit

T_CONDUCTOR_MAX = 90.0  # Normal operating limit [°C] — IEC 62067
T_AMBIENT_DESIGN = 15.0  # Design ambient temperature [°C]

# IEC 60287-1-1 §2.1: AC resistance at the 90 °C operating temperature (≈ 0.0233 Ω/km)
R_AC_OHM_PER_KM = EXPORT_CABLE_1000.r_ac_ohm_per_km

J_TUBE_ZONE_FACTOR = 1.4  # worst thermal environment (J-tube at km 0)
# Calibration: STATIC_RATING_A at design ambient → exactly 90 °C in the J-tube
R_THERMAL = (T_CONDUCTOR_MAX - T_AMBIENT_DESIGN) / (
    STATIC_RATING_A**2 * (R_AC_OHM_PER_KM / 1000.0) * J_TUBE_ZONE_FACTOR
)  # ≈ 2.55 K·m/W

# Hotspot thresholds
T_WARN = 70.0  # °C — DTS alarm
T_CRIT = 90.0  # °C — rated limit (derating required)


# ── Spatial thermal profile ───────────────────────────────────────────────────


J_TUBE_END_KM = 0.3
HDD_START_KM = 31.0
HDD_END_KM = 31.8


def _zone_thermal_factor(km: float) -> float:
    """
    Spatial variation in thermal environment along the 45 km route.

    Returns a multiplier on the conductor temperature rise above ambient.
    > 1.0 means hotter than average (poor cooling).
    < 1.0 means cooler than average (good cooling).
    """
    if km <= J_TUBE_END_KM:
        # J-tube on the OSS: cable in air in a steel tube — worst spot (calibration point)
        return J_TUBE_ZONE_FACTOR
    if km < HDD_START_KM:
        # Open-sea burial: small variation from seabed micro-topography / burial depth
        return 1.0 + 0.05 * math.sin(2 * math.pi * km / 8.0)
    if km <= HDD_END_KM:
        # HDD landfall: 10–15 m deep under the beach and dunes — onshore hotspot
        return 1.3
    # Land section: direct-buried in soil
    return 1.1


def _conductor_temp(
    current_a: float,
    ambient_temp_c: float,
    km: float,
    rng: random.Random,
) -> float:
    """
    IEC 60287 conductor temperature at position km.

    T = T_amb + I² × R_AC × R_th × zone_factor + noise
    """
    power_loss_w_per_m = (current_a**2) * (R_AC_OHM_PER_KM / 1000.0)
    base_rise = power_loss_w_per_m * R_THERMAL
    zone_factor = _zone_thermal_factor(km)
    noise = rng.gauss(0.0, 0.3)  # DTS measurement noise ±0.3 °C
    temp = ambient_temp_c + base_rise * zone_factor + noise
    return round(temp, 1)


# ── Public API ────────────────────────────────────────────────────────────────


def simulate_dts(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> dict[str, Any]:
    """
    Simulate DTS temperature profile along one 45 km export cable circuit.

    ``current_a`` is the current in that circuit [A] (not the farm total).
    Returns 450 temperature points (1 per 100 m), hotspot count, and assessment.
    """
    rng = random.Random(int(current_a * 100 + ambient_temp_c * 10))
    step_km = CABLE_LENGTH_KM / N_POINTS
    profile = []
    max_temp = -99.0
    max_temp_km = 0.0
    hotspot_count = 0

    for i in range(N_POINTS):
        km = round(i * step_km + step_km / 2, 3)
        temp = _conductor_temp(current_a, ambient_temp_c, km, rng)
        loading = round(100.0 * current_a / STATIC_RATING_A, 1)
        is_hot = temp >= T_WARN

        if is_hot:
            hotspot_count += 1
        if temp > max_temp:
            max_temp = temp
            max_temp_km = km

        profile.append(
            {
                "distance_km": km,
                "temperature_c": temp,
                "loading_percent": loading,
                "is_hotspot": is_hot,
            }
        )

    if max_temp < T_WARN:
        assessment = f"NORMAL — max {max_temp:.1f} degC at {max_temp_km:.1f} km"
    elif max_temp < T_CRIT:
        assessment = (
            f"WARNING — hotspot {max_temp:.1f} degC at {max_temp_km:.1f} km; inspect burial depth"
        )
    else:
        assessment = (
            f"CRITICAL — {max_temp:.1f} degC at {max_temp_km:.1f} km exceeds 90 degC limit; "
            "derate cable immediately"
        )

    return {
        "current_a": current_a,
        "ambient_temp_c": ambient_temp_c,
        "cable_length_km": CABLE_LENGTH_KM,
        "n_points": N_POINTS,
        "profile": profile,
        "max_temp_c": round(max_temp, 1),
        "max_temp_location_km": round(max_temp_km, 3),
        "hotspot_count": hotspot_count,
        "static_rating_a": STATIC_RATING_A,
        "assessment": assessment,
    }


def detect_hotspots(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> dict[str, Any]:
    """
    Detect and classify hotspots along the cable.

    Returns only segments above T_WARN (70°C) with severity classification.
    """
    dts = simulate_dts(current_a, ambient_temp_c)
    hotspots = []
    max_severity = "NORMAL"

    for point in dts["profile"]:
        if point["is_hotspot"]:
            temp = point["temperature_c"]
            severity = "CRITICAL" if temp >= T_CRIT else "WARNING"
            if severity == "CRITICAL":
                max_severity = "CRITICAL"
            elif max_severity == "NORMAL":
                max_severity = "WARNING"

            km = point["distance_km"]
            if km <= J_TUBE_END_KM:
                cause = "OSS J-tube — cable in air, limited convective cooling"
            elif HDD_START_KM <= km <= HDD_END_KM:
                cause = "HDD landfall — deep burial under beach/dunes, high soil thermal resistance"
            elif km > HDD_END_KM:
                cause = "Land section — soil drying raises thermal resistance"
            else:
                cause = "Possible local burial depth anomaly or sediment blockage"

            hotspots.append(
                {
                    "distance_km": km,
                    "temperature_c": temp,
                    "loading_percent": point["loading_percent"],
                    "severity": severity,
                    "cause": cause,
                }
            )

    count = len(hotspots)
    if max_severity == "NORMAL":
        assessment = "No hotspots detected — cable within thermal limits"
    elif max_severity == "WARNING":
        assessment = f"{count} WARNING hotspot(s) — schedule inspection; no immediate derating"
    else:
        assessment = (
            f"{count} CRITICAL hotspot(s) — reduce cable current below dynamic rating immediately"
        )

    return {
        "current_a": current_a,
        "hotspots": hotspots,
        "hotspot_count": count,
        "max_severity": max_severity,
        "assessment": assessment,
    }


def calculate_dynamic_rating(
    current_a: float = 650.0,
    ambient_temp_c: float = 10.0,
) -> dict[str, Any]:
    """
    Calculate real-time dynamic thermal rating (IEC 60287 § 5.2).

    I_dynamic = I_static × sqrt((T_max - T_ambient) / (T_max - T_ambient_design))

    In cool conditions (winter) the cable can carry more than rated current.
    In warm conditions (summer) the rated current must be derated.
    """
    temp_margin_actual = T_CONDUCTOR_MAX - ambient_temp_c
    temp_margin_design = T_CONDUCTOR_MAX - T_AMBIENT_DESIGN

    if temp_margin_actual <= 0.0:
        dynamic_rating = 0.0
    else:
        ratio = temp_margin_actual / temp_margin_design
        dynamic_rating = round(STATIC_RATING_A * math.sqrt(ratio), 1)

    headroom_a = round(dynamic_rating - current_a, 1)
    headroom_pct = round(100.0 * headroom_a / max(1.0, dynamic_rating), 1)
    utilisation = round(100.0 * current_a / max(1.0, dynamic_rating), 1)

    if utilisation <= 70.0:
        assessment = (
            f"COMFORTABLE -- {utilisation:.0f}% of dynamic rating; {headroom_a:.0f} A headroom"
        )
    elif utilisation <= 90.0:
        assessment = f"LOADED — {utilisation:.0f}% of dynamic rating; monitor temperature"
    elif utilisation <= 100.0:
        assessment = f"HIGH LOAD — {utilisation:.0f}% of dynamic rating; hotspot risk"
    else:
        assessment = (
            f"OVERLOADED — {utilisation:.0f}% of dynamic rating; "
            "exceeds cable capability — shed load"
        )

    return {
        "current_a": current_a,
        "ambient_temp_c": ambient_temp_c,
        "static_rating_a": STATIC_RATING_A,
        "dynamic_rating_a": dynamic_rating,
        "headroom_a": headroom_a,
        "headroom_pct": headroom_pct,
        "thermal_utilisation_pct": utilisation,
        "assessment": assessment,
    }
