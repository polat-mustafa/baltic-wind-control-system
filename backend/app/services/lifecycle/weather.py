"""
Sea states for campaign planning and O&M access — a REAL 30-year hindcast at SB-510.

``data/sb510_metocean_6h.csv.gz`` (``scripts/fetch_metocean.py``): significant wave
height Hs from the ERA5 ocean-wave model and the ERA5 10 m wind, 1995–2024, at PZP_44
(55.06 °N 16.54 °E), via Open-Meteo (CC BY 4.0). Each 6-hour value is the worst hour of
the block, so a step counts as workable only if every hour in it is.

Each campaign run replays one historical year: run r starts on the campaign start date
in year ``1995 + (seed + r) mod 30`` and continues through the record (wrapping from
2024 back to 1995). Storm persistence, the wind–wave correlation and the seasons are
therefore those of the real Baltic, not a model of them. With more than 30 runs the
years repeat; percentiles then weight the 30 years equally.

Sea ice: ``data/sb510_ice.json`` counts the days per winter that NOAA OISST v2.1
(passive microwave, 0.25°) shows ice in the site cell.
"""

from __future__ import annotations

import csv
import gzip
import json
from datetime import date, timedelta
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

STEP_HOURS = 6
STEPS_PER_DAY = 24 // STEP_HOURS
HUB_HEIGHT_M = 150.0
# Normal wind profile exponent for offshore sites (IEC 61400-3-1 NWP).
SHEAR_ALPHA = 0.14
DATA = Path(__file__).parent / "data"
HINDCAST_SOURCE = (
    "ERA5 ocean waves (ECMWF WAM) + ERA5 10 m wind, 1995–2024, 55.06 °N 16.54 °E, "
    "via Open-Meteo (CC BY 4.0); 6-hourly worst hour"
)


@cache
def hindcast() -> tuple[NDArray[np.datetime64], NDArray[np.float64], NDArray[np.float64]]:
    """(time [UTC, 6-hourly], Hs [m], 10 m wind [m/s]) of the bundled SB-510 hindcast."""
    with gzip.open(DATA / "sb510_metocean_6h.csv.gz", "rt", encoding="utf-8") as f:
        rows = list(csv.reader(f))[1:]
    t = np.array([r[0].rstrip("Z") for r in rows], dtype="datetime64[h]")
    return t, np.array([float(r[1]) for r in rows]), np.array([float(r[2]) for r in rows])


def _month_index(t: NDArray[np.datetime64]) -> NDArray[np.int_]:
    return np.asarray(t.astype("datetime64[M]").astype(int) % 12, dtype=int)


def monthly_means() -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Mean Hs [m] and 10 m wind [m/s] per calendar month (Jan..Dec) of the hindcast."""
    t, hs, v = hindcast()
    m = _month_index(t)
    return (
        np.array([hs[m == k].mean() for k in range(12)]),
        np.array([v[m == k].mean() for k in range(12)]),
    )


def monthly_access(hs_limit: float, v10_limit: float) -> NDArray[np.float64]:
    """Share of 6-hour steps per month with Hs ≤ limit AND wind ≤ limit (joint, measured)."""
    t, hs, v = hindcast()
    m = _month_index(t)
    ok = (hs <= hs_limit) & (v <= v10_limit)
    return np.array([ok[m == k].mean() for k in range(12)])


@cache
def ice_climate() -> dict[str, Any]:
    """Sea-ice days per winter at the site (NOAA OISST)."""
    data: dict[str, Any] = json.loads((DATA / "sb510_ice.json").read_text(encoding="utf-8"))
    days = list(data["ice_days_by_winter"].values())
    data["winters"] = len(days)
    data["winters_with_ice"] = sum(d > 0 for d in days)
    data["mean_ice_days"] = round(sum(days) / max(len(days), 1), 2)
    return data


HS_MEAN, VW_MEAN = monthly_means()


def hub_wind(v10: NDArray[np.float64]) -> NDArray[np.float64]:
    """10 m wind speed to hub height with the power law (α = SHEAR_ALPHA)."""
    return np.asarray(v10 * (HUB_HEIGHT_M / 10.0) ** SHEAR_ALPHA, dtype=float)


def step_months(start: date, steps: int) -> NDArray[np.int_]:
    """Calendar month index (0 = Jan) of every 6-hour step from ``start``."""
    days = steps // STEPS_PER_DAY + 1
    months = np.array([(start + timedelta(days=d)).month - 1 for d in range(days)], dtype=int)
    return np.repeat(months, STEPS_PER_DAY)[:steps]


def simulate(
    start: date, steps: int, runs: int, seed: int
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Hs [m] and 10 m wind [m/s], each (runs, steps): run r replays a historical year."""
    t, hs, v = hindcast()
    first = int(t[0].astype("datetime64[Y]").astype(int)) + 1970
    n_years = int(t[-1].astype("datetime64[Y]").astype(int)) + 1970 - first + 1
    out_h = np.empty((runs, steps))
    out_v = np.empty((runs, steps))
    for r in range(runs):
        year = first + (seed + r) % n_years
        day = min(start.day, 28) if start.month == 2 else start.day  # no 29 Feb in most years
        s0 = int(np.searchsorted(t, np.datetime64(date(year, start.month, day), "h")))
        idx = (s0 + np.arange(steps)) % len(t)  # wrap from the end of 2024 back to 1995
        out_h[r], out_v[r] = hs[idx], v[idx]
    return out_h, out_v


def run_lengths(ok: NDArray[np.bool_]) -> NDArray[np.int32]:
    """Consecutive workable steps starting at each step, shape (runs, steps)."""
    runs, steps = ok.shape
    out = np.zeros((runs, steps + 1), dtype=np.int32)
    for s in range(steps - 1, -1, -1):
        out[:, s] = (out[:, s + 1] + 1) * ok[:, s]
    return out[:, :steps]
