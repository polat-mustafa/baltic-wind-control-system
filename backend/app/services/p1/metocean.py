"""
Sea conditions at SB-510 from the Copernicus Marine Baltic reanalyses
(``data/cmems_metocean.json``, built by ``scripts/process_cmems.py``): wave
statistics and the 50-year significant wave height, surface currents, sea
surface temperature, sea ice, and the seabed temperature along the export route.

The seabed temperature sets the ambient of the buried export cable: the
datasheet rating (825 A) assumes 20 °C. With the measured monthly 99th
percentile per section, the conductor reaches 90 °C at

    I_max = sqrt((90 − θ_amb − W_d·(T_int/2 + R_ext)) / (R_ac,90 · (T_int + R_ext)))

(``cable_dts.rating_a``; R_ext per section relative to the calibrated J-tube).
Bottom-water temperature over the burial depth is conservative: the sediment
1–2 m down damps and delays the summer peak.
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

from app.services.lifecycle.weather import ice_climate
from app.services.p2.cable_dts import (
    R_EXT_J_TUBE,
    STATIC_RATING_A,
    T_AMBIENT_DESIGN,
    ZONES,
    rating_a,
)

DATA = Path(__file__).parent / "data" / "cmems_metocean.json"
#: Export cable section → the route point whose seabed temperature it sees.
SECTIONS = (("Subsea burial", "Mid-route (≈ 30 m)"), ("HDD landfall", "Near landfall (≈ 10 m)"))
#: Current per circuit at 510 MW (P2 load flow; the DTS default).
FULL_LOAD_A = 778.0


@cache
def metocean() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(DATA.read_text(encoding="utf-8"))
    rel = {z[0]: z[3] for z in ZONES}
    points = {p["label"]: p for p in data["sea"]["seabed"]}
    data["cable"] = {
        "static_rating_a": STATIC_RATING_A,
        "design_ambient_c": T_AMBIENT_DESIGN,
        "full_load_a": FULL_LOAD_A,
        "sections": [
            {
                "section": name,
                "seabed_point": point,
                "monthly_rating_a": [
                    round(rating_a(t, R_EXT_J_TUBE * rel[name]), 0)
                    for t in points[point]["monthly_p99_c"]
                ],
            }
            for name, point in SECTIONS
        ],
    }
    ice = ice_climate()
    data["ice"] = {
        "oisst": {"source": ice["source"], "days": ice["ice_days_by_winter"]},
        "cmems": ice.get("cmems"),
    }
    return data
