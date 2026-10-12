"""
Turbine availability from failure rates and the site's real weather (engineering audit F3).

The loss cascade used a "typical planning value" of 95 %. Here availability follows from
how often a turbine fails, how long each repair takes and how long the crew waits for a
sea state in which the vessel can work — on SB-510's 30-year hindcast (``weather``).

Per failure class c (rate λ_c per turbine-year):

    downtime = response + wait(T_window) + repair
    wait(T)  = mean, over every start time in the hindcast, of the time until a window of
               T hours opens in which Hs and wind stay within the vessel's limits
    T_window = repair + 2 × transit (round trip; the work must fit one weather window)

Time-based availability  A_t = 1 − Σ_c λ_c · downtime_c / 8760.
Energy-based availability A_e weights the lost hours with the turbine's power in that
calendar month (hub wind from the hindcast's 10 m wind, power-law shear, reference power
curve), because storms both raise failures' cost and lengthen waits: A_e < A_t.

Failure classes — Carroll, McDonald & McMillan (2016), Wind Energy 19:1107, ~350 offshore
turbines over five years: 8.3 failures per turbine-year = 6.2 minor repairs, 1.1 major
repairs, 0.3 major replacements, 0.7 without cost data (counted here as minor). Minor
repair time 7.0 h = the rate-weighted Fig. 13 values the control room uses
(``frontend/src/lib/plant/failures.ts``); major repair 19 h (median of the figure).
APPROXIMATIONS (no open source at this detail): major replacement 50 h on the turbine,
jack-up lead time 30 days, response 4 h (CTV) / 24 h (spares for a major repair).
The data are for 3–4 MW geared turbines; the IEA 15 MW is direct drive (no gearbox
failures), so the rates are conservative for it — stated, not corrected.
Not included: balance-of-plant outages (export cable, OSS), which are rare but long.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from app.services.lifecycle import weather

HOURS_PER_YEAR = 8760.0
CTV_TRANSIT_H = 2.0  # one way, ≈ 70 km at 20 kn (WOMBAT CTV speed; port distance varies)
SOURCE = (
    "Carroll et al. 2016 failure rates and repair times; waiting for vessel windows on the "
    "SB-510 30-year Hs / wind hindcast"
)


@dataclass(frozen=True)
class FailureClass:
    name: str
    rate_per_year: float
    repair_h: float
    response_h: float
    vessel: str
    hs_limit_m: float
    wind_limit_ms: float
    quality: str  # SourceBadge quality of the repair / response figures


FAILURE_CLASSES: tuple[FailureClass, ...] = (
    FailureClass("Minor repair", 6.9, 7.0, 4.0, "CTV", 1.5, 10.0, "literature"),
    FailureClass("Major repair", 1.1, 19.0, 24.0, "CTV", 1.5, 10.0, "literature"),
    FailureClass("Major replacement", 0.3, 50.0, 30 * 24.0, "Jack-up", 2.0, 8.0, "approximation"),
)


@dataclass(frozen=True)
class ClassResult:
    name: str
    rate_per_year: float
    mean_wait_h: float
    downtime_h: float  # per failure
    hours_lost_per_year: float


@dataclass(frozen=True)
class AvailabilityResult:
    time_based: float  # [-]
    energy_based: float  # [-]
    classes: tuple[ClassResult, ...]
    source: str = SOURCE


def _mean_wait_h(ok: np.ndarray, window_steps: int) -> np.ndarray:
    """Hours from each step until a run of ``window_steps`` workable steps starts."""
    run = weather.run_lengths(ok[None, :])[0]
    starts = np.flatnonzero(run >= window_steps)
    nxt = np.searchsorted(starts, np.arange(ok.size))
    wait_steps = np.where(nxt < starts.size, starts[np.minimum(nxt, starts.size - 1)], ok.size)
    return (wait_steps - np.arange(ok.size)) * weather.STEP_HOURS


@lru_cache(maxsize=8)
def availability(turbine_model: str | None = None) -> AvailabilityResult:
    """Time- and energy-based availability of one turbine at SB-510 (module docstring)."""
    from app.services.p1.turbine_models import get_turbine

    t, hs, v10 = weather.hindcast()
    month = np.asarray(t.astype("datetime64[M]").astype(int) % 12, dtype=int)
    power = get_turbine(turbine_model).power_curve_kw(weather.hub_wind(v10))
    p_month = np.array([power[month == m].mean() for m in range(12)])
    share = np.array([(month == m).mean() for m in range(12)])

    lost_h = 0.0
    lost_e = 0.0  # kWh per turbine-year
    classes = []
    for c in FAILURE_CLASSES:
        ok = (hs <= c.hs_limit_m) & (v10 <= c.wind_limit_ms)
        steps = int(np.ceil((c.repair_h + 2 * CTV_TRANSIT_H) / weather.STEP_HOURS))
        wait = _mean_wait_h(ok, steps)
        wait_month = np.array([wait[month == m].mean() for m in range(12)])
        down_month = c.response_h + wait_month + c.repair_h
        down = float(np.sum(share * down_month))
        hours = c.rate_per_year * down
        lost_h += hours
        # failures spread evenly over the year; each loses its month's mean power
        lost_e += c.rate_per_year * float(np.sum(share * down_month * p_month))
        classes.append(
            ClassResult(c.name, c.rate_per_year, float(np.sum(share * wait_month)), down, hours)
        )
    e_year = float(np.sum(share * p_month)) * HOURS_PER_YEAR
    return AvailabilityResult(
        time_based=1.0 - lost_h / HOURS_PER_YEAR,
        energy_based=1.0 - lost_e / e_year,
        classes=tuple(classes),
    )
