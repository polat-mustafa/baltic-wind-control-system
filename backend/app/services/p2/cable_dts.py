"""
Cable DTS Thermal Monitoring service — M10.

Physics layers
--------------
1. IEC 60287 steady-state thermal model
   T_conductor = T_ambient + I² × R_AC × R_thermal_total
   where R_thermal_total = T1 + T2 + T3 + T4 [K·m/W] (insulation + jacket + soil layers)

   For 220 kV XLPE 1×800 mm² at 45 km submarine cable:
   R_AC   = 0.028 Ω/km (aluminium conductor at 90°C)
   R_th   = 0.87 K·m/W (combined insulation + sea burial)
   Static rating I_max: T_conductor = 90°C → I = sqrt((90-T_amb)/R_AC/R_th * 1/L)
   With T_amb = 15°C → I_max ≈ 800 A (standard nameplate)

2. Spatial variation along 45 km route
   Three zones with different thermal environments:
   - Zone A (0–5 km): J-tube / landfall → higher ambient, reduced cooling → hotspot risk
   - Zone B (5–40 km): open sea burial → uniform 12°C sea-floor, good cooling
   - Zone C (40–45 km): shallow near-shore → seasonal temperature, summer warming

3. Dynamic rating
   I_dynamic = I_static × sqrt((T_max - T_ambient_actual) / (T_max - T_ambient_design))
   Winter (T_amb = 4°C vs design 15°C): I_dynamic ≈ 800 × sqrt(86/75) ≈ 856 A
   Summer (T_amb = 22°C vs design 15°C): I_dynamic ≈ 800 × sqrt(68/75) ≈ 762 A

4. Hotspot detection
   WARNING: T_conductor > 70°C (IEC 60502-2 alarm threshold)
   CRITICAL: T_conductor > 90°C (rated operating limit — forced derating required)

References
----------
IEC 60287-1-1:2014 — Electric cables: current rating
IEC 60287-2-1:2015 — Thermal resistance
IEC 60502-2:2014   — Power cables: 1-30 kV (principles same for HV)
IEC 62067:2011     — Power cables above 150 kV (our 220 kV cable)
"""

from __future__ import annotations

import math
import random
from typing import Any

# ── Cable constants — 220 kV XLPE 1×800 mm² aluminium ────────────────────────

CABLE_LENGTH_KM = 45.0
N_POINTS = 450  # 1 point per 100 m
STATIC_RATING_A = 800.0

# IEC 60287 parameters
R_AC_OHM_PER_KM = 0.028  # AC resistance at 90°C [Ω/km]
# IEC 60287 calibration: 800 A at 15 °C ambient → 90 °C in J-tube (zone_factor=1.4)
# R_THERMAL = ΔT / (I² × R_AC_per_m × zone_factor) = 75 / (640000 × 2.8e-5 × 1.4)
R_THERMAL = 2.989  # Combined thermal resistance [K·m/W]

T_CONDUCTOR_MAX = 90.0  # Normal operating limit [°C] — IEC 62067
T_AMBIENT_DESIGN = 15.0  # Design ambient temperature [°C]

# Hotspot thresholds
T_WARN = 70.0  # °C — DTS alarm
T_CRIT = 90.0  # °C — rated limit (derating required)


# ── Spatial thermal profile ───────────────────────────────────────────────────


def _zone_thermal_factor(km: float) -> float:
    """
    Spatial variation in thermal environment along the 45 km route.

    Returns a multiplier on the conductor temperature rise above ambient.
    > 1.0 means hotter than average (poor cooling).
    < 1.0 means cooler than average (good cooling).
    """
    if km <= 5.0:
        # J-tube + landfall zone: concrete encasement, reduced cooling
        # Linear interpolation from 1.4 at km=0 (surface) to 1.1 at km=5
        return 1.4 - 0.06 * km
    elif km <= 40.0:
        # Open sea: uniform sea-floor burial, optimal cooling
        # Small sinusoidal variation from seabed micro-topography
        return 1.0 + 0.05 * math.sin(2 * math.pi * km / 8.0)
    else:
        # Near-shore shallow water: seasonal warming effect
        # Gradual increase from km=40 to km=45
        return 1.05 + 0.03 * (km - 40.0)


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
    Simulate DTS temperature profile along 45 km export cable.

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
            if km <= 5.0:
                cause = "J-tube / landfall thermal bottleneck — limited convective cooling"
            elif km >= 40.0:
                cause = "Shallow near-shore burial — seasonal seawater warming"
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
