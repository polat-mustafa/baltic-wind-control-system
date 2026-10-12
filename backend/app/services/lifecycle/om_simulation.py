"""
O&M simulation of the SB-510 fleet: failures, crews, vessels and weather, hour by hour
(engineering audit B-9).

``availability_model`` gives one turbine's mean availability analytically, as if a crew
and a vessel were always free. A real farm has a few crew transfer vessels (CTVs), crews
that work daylight shifts, and a jack-up that must be chartered weeks ahead; failures
queue for them. This module replays each of the 30 hindcast years (``weather``) with the
34 turbines and those resources, the way WOMBAT (Hammond & Cooperman, NREL, 2022) does,
in a simplified, transparent form:

- Failures: Poisson arrivals per turbine and class at the ``availability_model`` rates
  (Carroll et al. 2016). A failed turbine stops until repaired.
- Response: spares / planning delay per class before a job can be worked
  (4 h minor, 24 h major repair; major replacement waits for the jack-up).
- CTV work (minor and major repairs) in daylight shifts 07:00–19:00 UTC: a shift goes out
  only if Hs and wind stay within the CTV limits for the whole shift (perfect forecast);
  each of ``n_ctv`` vessels carries ``crews_per_ctv`` crews; one crew works one job per
  shift for 12 h − 2 × transit; longer jobs continue on the next workable shift.
- Jack-up (major replacements): chartered on the first failure, arrives after the lead
  time (30 days), then works around the clock when the sea allows (Hs ≤ 2 m,
  wind ≤ 8 m/s at 10 m — crane limit), with 12 h to move and jack between turbines; it
  leaves when no replacement is waiting.
- Energy-based availability: lost energy = the turbine's power at that hour's hub wind
  (hindcast 10 m wind, power-law shear, reference power curve) while it is down.

``mode="continuous"`` (unlimited crews and vessels, every job — replacements included —
waits its own response time and then one continuous window of repair + 2 × transit, no
shifts) reproduces the analytic model's assumptions; tests check the two agree.

Costs (APPROXIMATION — order-of-magnitude public figures, not quotes): CTV charter
€3 500 per vessel-day all year, technicians €90 000 per person-year (3 per crew),
jack-up €150 000 per day on charter plus €500 000 per mobilisation (WOMBAT library
vessel rates), materials per failure €500 / €5 000 / €100 000 (Carroll et al. 2016 cost
bands: < €1 000, €1 000–10 000, > €10 000).
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from numpy.typing import NDArray

from app.services.lifecycle import weather
from app.services.lifecycle.availability_model import CTV_TRANSIT_H, FAILURE_CLASSES

N_TURBINES = 34
TURBINE_MW = 15.0
SHIFT_START_H = 7
SHIFT_LEN_H = 12
JACKUP_LEAD_H = 30 * 24
JACKUP_MOVE_H = 12.0
JACKUP_HS_M = 2.0
JACKUP_WIND_MS = 8.0
CTV_DAY_RATE_EUR = 3_500.0
TECH_EUR_PER_YEAR = 90_000.0
TECHS_PER_CREW = 3
JACKUP_DAY_RATE_EUR = 150_000.0
JACKUP_MOBILISATION_EUR = 500_000.0
MATERIALS_EUR = {"Minor repair": 500.0, "Major repair": 5_000.0, "Major replacement": 100_000.0}
SOURCE = (
    "Hourly replay of the 30 hindcast years: Carroll et al. 2016 failure rates, CTV shifts, "
    "jack-up charter; costs are order-of-magnitude approximations (WOMBAT library rates)"
)


@dataclass(order=True)
class _Job:
    ready_h: float
    turbine: int = field(compare=False)
    cls: int = field(compare=False)
    remaining_h: float = field(compare=False)
    failed_h: float = field(compare=False)


@dataclass(frozen=True)
class YearResult:
    year: int
    time_based: float
    energy_based: float
    failures: int
    jackup_days: float
    jackup_mobilisations: int


@dataclass(frozen=True)
class OMResult:
    years: tuple[YearResult, ...]
    time_based_mean: float
    energy_based_mean: float
    energy_based_p90: float  # exceeded in 90 % of years
    mean_downtime_h: tuple[float, ...]  # per failure, per class
    cost_eur_per_year: dict[str, float]
    cost_eur_per_mw_year: float
    n_ctv: int
    crews_per_ctv: int
    mode: str
    source: str = SOURCE


@lru_cache(maxsize=1)
def _hourly() -> tuple[
    NDArray[np.int_], NDArray[np.float64], NDArray[np.float64], NDArray[np.int_]
]:
    """(year, Hs, 10 m wind, hour of day) hour by hour (6-hourly blocks repeated)."""
    t, hs, v10 = weather.hindcast()
    th = (t[:, None] + np.arange(weather.STEP_HOURS).astype("timedelta64[h]")).ravel()
    year = th.astype("datetime64[Y]").astype(int) + 1970
    hour = (th - th.astype("datetime64[D]")).astype(int)
    return (
        year,
        np.repeat(hs, weather.STEP_HOURS),
        np.repeat(v10, weather.STEP_HOURS),
        np.asarray(hour),
    )


def _window_ok(ok: NDArray[np.bool_], length: int) -> NDArray[np.bool_]:
    """ok_window[h] = all(ok[h : h + length])."""
    c = np.concatenate(([0], np.cumsum(~ok)))
    n = len(ok)
    end = np.minimum(np.arange(n) + length, n)
    full = (np.arange(n) + length) <= n
    return np.asarray(((c[end] - c[:n]) == 0) & full, dtype=np.bool_)


def _simulate(
    years: NDArray[np.int_],
    rng: np.random.Generator,
    n_ctv: int,
    crews_per_ctv: int,
    mode: str,
    power_kw: NDArray[np.float64],
    hs: NDArray[np.float64],
    v10: NDArray[np.float64],
    hour: NDArray[np.int_],
) -> tuple[list[YearResult], tuple[float, ...]]:
    """One continuous run over the whole record (queues and charters carry across years);
    per-year results plus the mean downtime per failure of each class [h]."""
    n = len(hs)
    ctv = FAILURE_CLASSES[0]
    ctv_ok = (hs <= ctv.hs_limit_m) & (v10 <= ctv.wind_limit_ms)
    jack_ok = (hs <= JACKUP_HS_M) & (v10 <= JACKUP_WIND_MS)
    shift_ok = _window_ok(ctv_ok, SHIFT_LEN_H)
    work_per_shift = SHIFT_LEN_H - 2 * CTV_TRANSIT_H

    # failures: Poisson per turbine and class over the year
    events: list[tuple[float, int, int]] = []
    for c_idx, c in enumerate(FAILURE_CLASSES):
        for tb in range(N_TURBINES):
            k = rng.poisson(c.rate_per_year * n / 8760.0)
            events.extend((float(x), tb, c_idx) for x in rng.uniform(0, n, k))
    events.sort()

    down = np.zeros((N_TURBINES, n + 1), dtype=np.int8)  # +1/−1 markers, cumulated below
    lost_by_class = [0.0] * len(FAILURE_CLASSES)
    ctv_queue: list[_Job] = []
    jack_queue: list[_Job] = []
    jack_arrival: float | None = None
    on_charter = np.zeros(n, dtype=bool)
    mob_hours: list[int] = []
    jack_busy_until = 0.0
    jack_job: _Job | None = None
    cont_ok = {
        c_idx: _window_ok(
            (hs <= c.hs_limit_m) & (v10 <= c.wind_limit_ms),
            int(np.ceil(c.repair_h + 2 * CTV_TRANSIT_H)),
        )
        for c_idx, c in enumerate(FAILURE_CLASSES)
    }

    def restore(job: _Job, at: float) -> None:
        a, b = int(job.failed_h), min(int(np.ceil(at)), n)
        down[job.turbine, a] += 1
        down[job.turbine, b] -= 1
        lost_by_class[job.cls] += b - a

    ev = 0
    for h in range(n):
        while ev < len(events) and events[ev][0] < h + 1:
            t_f, tb, c_idx = events[ev]
            c = FAILURE_CLASSES[c_idx]
            if c.vessel == "Jack-up" and mode != "continuous":
                job = _Job(t_f, tb, c_idx, c.repair_h, t_f)
                jack_queue.append(job)
                if jack_arrival is None:
                    jack_arrival = t_f + JACKUP_LEAD_H
                    mob_hours.append(h)
            else:
                heapq.heappush(ctv_queue, _Job(t_f + c.response_h, tb, c_idx, c.repair_h, t_f))
            ev += 1

        # CTV work
        if mode == "continuous":
            keep: list[_Job] = []
            while ctv_queue:
                job = heapq.heappop(ctv_queue)
                if job.ready_h <= h and cont_ok[job.cls][h]:
                    restore(job, h + CTV_TRANSIT_H + job.remaining_h)
                else:
                    keep.append(job)
            for job in keep:
                heapq.heappush(ctv_queue, job)
        elif hour[h] == SHIFT_START_H and shift_ok[h]:
            crews = n_ctv * crews_per_ctv
            ready = [j for j in ctv_queue if j.ready_h <= h + CTV_TRANSIT_H]
            ready.sort()
            for job in ready[:crews]:
                worked = min(job.remaining_h, work_per_shift)
                job.remaining_h -= worked
                if job.remaining_h <= 1e-9:
                    restore(job, h + CTV_TRANSIT_H + worked)
                    ctv_queue.remove(job)
            heapq.heapify(ctv_queue)

        # jack-up campaign
        if jack_arrival is not None and h >= jack_arrival:
            on_charter[h] = True
            if jack_job is None and jack_queue and h >= jack_busy_until:
                jack_job = jack_queue.pop(0)
                jack_busy_until = h + JACKUP_MOVE_H
            if jack_job is not None and h >= jack_busy_until and jack_ok[h]:
                jack_job.remaining_h -= 1.0
                if jack_job.remaining_h <= 1e-9:
                    restore(jack_job, h + 1)
                    jack_job = None
            if jack_job is None and not jack_queue and h >= jack_busy_until:
                jack_arrival = None  # demobilise

    # jobs still open at the end of the record: down until then
    for job in [*ctv_queue, *jack_queue, *([jack_job] if jack_job else [])]:
        restore(job, n)
    state = np.cumsum(down[:, :n], axis=1) > 0
    n_fail = np.bincount([e[2] for e in events], minlength=len(FAILURE_CLASSES))
    fail_year = years[np.minimum([int(e[0]) for e in events], n - 1)] if events else years[:0]
    mob_year = years[mob_hours] if mob_hours else years[:0]
    out = []
    for y in np.unique(years):
        sel = years == y
        st = state[:, sel]
        pw = power_kw[sel]
        out.append(
            YearResult(
                year=int(y),
                time_based=1 - float(st.sum()) / st.size,
                energy_based=1 - float((st * pw[None, :]).sum()) / (float(pw.sum()) * N_TURBINES),
                failures=int(np.sum(fail_year == y)),
                jackup_days=float(on_charter[sel].sum()) / 24,
                jackup_mobilisations=int(np.sum(mob_year == y)),
            )
        )
    per_failure = tuple(lost / max(k, 1) for lost, k in zip(lost_by_class, n_fail, strict=True))
    return out, per_failure


@lru_cache(maxsize=16)
def simulate_om(
    n_ctv: int = 2,
    crews_per_ctv: int = 3,
    mode: str = "shifts",
    seed: int = 0,
    turbine_model: str | None = None,
) -> OMResult:
    """Replay every hindcast year with the fleet's failures and resources (docstring)."""
    from app.services.p1.turbine_models import get_turbine

    year, hs, v10, hour = _hourly()
    power = get_turbine(turbine_model).power_curve_kw(weather.hub_wind(v10))
    rng = np.random.default_rng(seed)
    results, per_failure = _simulate(year, rng, n_ctv, crews_per_ctv, mode, power, hs, v10, hour)
    eb = np.array([r.energy_based for r in results])
    n_years = len(results)
    materials = sum(
        c.rate_per_year * N_TURBINES * MATERIALS_EUR.get(c.name, 0.0) for c in FAILURE_CLASSES
    )
    jack = (
        sum(
            r.jackup_days * JACKUP_DAY_RATE_EUR + r.jackup_mobilisations * JACKUP_MOBILISATION_EUR
            for r in results
        )
        / n_years
    )
    cost = {
        "ctv_charter": n_ctv * 365 * CTV_DAY_RATE_EUR,
        "technicians": n_ctv * crews_per_ctv * TECHS_PER_CREW * TECH_EUR_PER_YEAR,
        "jackup": jack,
        "materials": materials,
    }
    total = sum(cost.values())
    return OMResult(
        years=tuple(results),
        time_based_mean=float(np.mean([r.time_based for r in results])),
        energy_based_mean=float(eb.mean()),
        energy_based_p90=float(np.percentile(eb, 10)),
        mean_downtime_h=tuple(round(float(d), 1) for d in per_failure),
        cost_eur_per_year={k: round(v) for k, v in cost.items()},
        cost_eur_per_mw_year=round(total / (N_TURBINES * TURBINE_MW)),
        n_ctv=n_ctv,
        crews_per_ctv=crews_per_ctv,
        mode=mode,
    )
