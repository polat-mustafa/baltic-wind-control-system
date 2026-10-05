"""
Offshore construction and decommissioning campaigns in weather windows.

Method (teaching version of a marine-operations campaign simulation):

1. Weather: ``weather.simulate`` gives ``runs`` synthetic 6-hourly Hs / wind
   series from the campaign start date.
2. Weather-restricted operations (DNV-ST-N001, Marine operations and marine
   warranty): every unit of work (one foundation, one turbine, one cable
   section …) is an operation of planned duration T_POP that needs a weather
   window in which Hs and wind stay below the *forecast* limit
   OP_WF = α · OP_LIM for the whole operation. α < 1 covers the uncertainty
   of the weather forecast; here it is one user input for every operation.
3. Each vessel works through its activities in order. A unit starts when
   the vessel is free, its predecessors are done (``after`` = whole
   activities, ``gate`` = the matching unit of another activity, e.g. a
   turbine needs its foundation) and a long-enough window opens. Time spent
   waiting for that window is waiting on weather (WoW).
4. During installation the cable-lay vessel, which only follows the slower
   foundation campaign, is mobilised just in time: late enough not to wait
   for it at twice its calm-weather pace. During removal the vessels follow
   each other turbine by turbine and wait on site (idle time is paid). It is on charter
   from the start to the end of its work, including WoW, and stays on hire
   through gaps of up to 30 days between activities; a longer gap costs a
   new mobilisation. Cost = day rate × charter days + mobilisations.

All vessel limits, durations and rates are ILLUSTRATIVE teaching values
(order of magnitude for 15 MW-class projects), returned with the result so
the page can show them. They are not vendor or market data.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal

import numpy as np
from numpy.typing import NDArray

from app.services.lifecycle import weather
from app.services.p1.weather_window import (
    _VESSEL_DAY_RATE,
    _VESSEL_HS_LIMIT,
    _VESSEL_MOBILISATION_EUR,
    _VESSEL_VW_LIMIT,
)

Mode = Literal["install", "remove"]
STEP_H = weather.STEP_HOURS
HORIZON_YEARS = 6
KEEP_ON_HIRE_DAYS = 30
# planning buffer of a just-in-time follower: twice its calm-weather duration
JIT_BUFFER = 2.0
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@dataclass(frozen=True)
class Vessel:
    id: str
    name: str
    role: str
    hs_limit_m: float
    wind_limit_ms: float
    wind_at_hub: bool
    day_rate_keur: float
    mobilisation_keur: float


# CTV limits and rates are the ones of the O&M model (services/p1/weather_window.py).
VESSELS: dict[str, Vessel] = {
    v.id: v
    for v in (
        Vessel(
            "HLV",
            "Heavy-lift vessel",
            "Foundations, offshore substation",
            1.5,
            13.0,
            False,
            300.0,
            1500.0,
        ),
        Vessel(
            "WTIV",
            "Jack-up installation vessel",
            "Turbines (tower, nacelle, blades)",
            2.0,
            14.0,
            True,
            250.0,
            1000.0,
        ),
        Vessel(
            "CLV", "Cable-lay vessel", "Export and array cables", 2.0, 15.0, False, 150.0, 800.0
        ),
        Vessel(
            "CTV",
            "Crew transfer vessel",
            "Commissioning teams, turbine isolation",
            _VESSEL_HS_LIMIT["CTV"],
            _VESSEL_VW_LIMIT["CTV"],
            False,
            _VESSEL_DAY_RATE["CTV"] / 1000,
            _VESSEL_MOBILISATION_EUR["CTV"] / 1000,
        ),
        Vessel(
            "SURVEY",
            "Survey vessel",
            "Seabed survey, debris clearance",
            2.5,
            15.0,
            False,
            25.0,
            50.0,
        ),
    )
}


@dataclass
class Activity:
    id: str
    name: str
    vessel: str
    units: int
    op_hours: float
    """Weather-restricted duration of one unit (T_POP) [h]."""
    trip_every: int = 0
    """Units carried per port round trip (0 = no port calls)."""
    trip_hours: float = 0.0
    """Port loading + transit per round trip [h], not weather-limited here."""
    after: list[str] = field(default_factory=list)
    gate: Callable[[int, dict[str, NDArray[np.int64]]], int] | None = None
    """Earliest start step of unit k from the unit end times of earlier activities."""
    jit: bool = False
    """Mobilise just in time behind the gating activity instead of waiting on site."""


@dataclass
class CampaignInput:
    mode: Mode
    n_turbines: int
    strings: list[int]
    array_km: float
    export_km: float
    foundation: Literal["monopile", "jacket"]
    start: date
    alpha: float
    runs: int
    seed: int
    remove_foundations: Literal["cut", "full"] = "cut"
    remove_array: bool = False
    remove_export: bool = False
    remove_scour: bool = False
    limits: dict[str, tuple[float, float]] = field(default_factory=dict)


def _string_of(strings: list[int]) -> list[int]:
    out: list[int] = []
    for s, n in enumerate(strings):
        out += [s] * n
    return out


def _unit_gate(src: str) -> Callable[[int, dict[str, NDArray[np.int64]]], int]:
    return lambda k, ends: int(ends[src][k])


def install_plan(c: CampaignInput) -> list[Activity]:
    n = c.n_turbines
    string_of = _string_of(c.strings)
    jacket = c.foundation == "jacket"
    export_units = math.ceil(c.export_km / 5.0) + 2  # 5 km lay-and-bury per day + two pull-ins
    array_op = max(12.0, 24.0 * (c.array_km / n) / 1.6)  # 24 h for a 1.6 km section incl. pull-ins

    def commissioning_gate(k: int, ends: dict[str, NDArray[np.int64]]) -> int:
        s = string_of[k]
        same = [j for j in range(n) if string_of[j] == s]
        return int(max(ends["turbines"][k], max(ends["array"][j] for j in same)))

    return [
        Activity("oss", "Offshore substation: jacket and topside lifts", "HLV", 2, 36.0, 2, 48.0),
        Activity(
            "foundations",
            "Jackets with pin piles" if jacket else "Monopiles and transition pieces",
            "HLV",
            n,
            48.0 if jacket else 30.0,
            2 if jacket else 4,
            48.0,
        ),
        Activity("export", "Export cable: lay, bury, pull in", "CLV", export_units, 24.0),
        Activity(
            "array",
            "Array cables: lay, pull in, bury",
            "CLV",
            n,
            array_op,
            gate=_unit_gate("foundations"),
            jit=True,
        ),
        Activity(
            "turbines",
            "Turbines: tower, nacelle, three blades",
            "WTIV",
            n,
            36.0,
            4,
            48.0,
            gate=_unit_gate("foundations"),
        ),
        # P5 Commissioning: the export system energisation (switching programme S-001 … S-022)
        Activity(
            "energise",
            "Energise export cable, OSS and 66 kV busbar (P5 programme)",
            "CTV",
            6,
            12.0,
            after=["oss", "export"],
        ),
        Activity(
            "commissioning",
            "String energisation, turbine commissioning",
            "CTV",
            n,
            12.0,
            after=["energise"],
            gate=commissioning_gate,
        ),
    ]


def remove_plan(c: CampaignInput) -> list[Activity]:
    n = c.n_turbines
    jacket = c.foundation == "jacket"
    found_op = (
        (48.0 if jacket else 36.0) if c.remove_foundations == "cut" else (72.0 if jacket else 60.0)
    )
    if c.remove_scour:
        found_op += 24.0
    array_op = max(12.0, 24.0 * (c.array_km / n) / 1.6) if c.remove_array else 6.0
    export_units = math.ceil(c.export_km / 5.0) + 2 if c.remove_export else 2
    return [
        Activity("isolate", "Isolate turbines, drain oils and coolants", "CTV", n, 12.0),
        Activity(
            "turbines",
            "Remove turbines (reverse installation)",
            "WTIV",
            n,
            36.0,
            4,
            48.0,
            gate=_unit_gate("isolate"),
        ),
        Activity(
            "array",
            "Recover array cables" if c.remove_array else "Cut array cables, bury the ends",
            "CLV",
            n,
            array_op,
            gate=_unit_gate("turbines"),
        ),
        Activity(
            "foundations",
            ("Cut " if c.remove_foundations == "cut" else "Fully remove ")
            + ("jackets" if jacket else "monopiles")
            + (" and scour protection" if c.remove_scour else ""),
            "HLV",
            n,
            found_op,
            2 if jacket else 4,
            48.0,
            gate=_unit_gate("array"),
        ),
        Activity("oss", "Remove offshore substation topside and jacket", "HLV", 2, 36.0, 2, 48.0),
        Activity(
            "export",
            "Recover export cable" if c.remove_export else "Cut, seal and bury export cable ends",
            "CLV",
            export_units,
            24.0 if c.remove_export else 12.0,
            after=["oss"],
        ),
        Activity(
            "survey",
            "Seabed survey and debris clearance",
            "SURVEY",
            n + 1,
            6.0,
            after=["foundations", "oss", "export"],
        ),
    ]


def _limits(c: CampaignInput, v: Vessel) -> tuple[float, float]:
    return c.limits.get(v.id, (v.hs_limit_m, v.wind_limit_ms))


def _steps(hours: float) -> int:
    return max(1, math.ceil(hours / STEP_H))


def _charter(
    start: NDArray[np.float64], end: NDArray[np.float64]
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Charter steps and mobilisations per run for one vessel's activities.

    The vessel stays on hire through gaps up to ``KEEP_ON_HIRE_DAYS``
    between its activities; a longer gap means demobilise and mobilise again.
    """
    keep = KEEP_ON_HIRE_DAYS * weather.STEPS_PER_DAY
    charter = np.zeros(start.shape[0])
    mobs = np.ones(start.shape[0])
    for r in range(start.shape[0]):
        spans = sorted(zip(start[r], end[r], strict=True))
        charter[r] = spans[0][1] - spans[0][0]
        prev = spans[0][1]
        for s0, s1 in spans[1:]:
            gap = max(0.0, s0 - prev)
            if gap > keep:
                mobs[r] += 1
            else:
                charter[r] += gap
            charter[r] += s1 - max(s0, prev)
            prev = max(prev, s1)
    return charter, mobs


def run_campaign(c: CampaignInput) -> dict[str, Any]:
    plan = install_plan(c) if c.mode == "install" else remove_plan(c)
    horizon = HORIZON_YEARS * 365 * weather.STEPS_PER_DAY
    hs, v10 = weather.simulate(c.start, horizon, c.runs, c.seed)
    months = weather.step_months(c.start, horizon)
    vessels_used = list(dict.fromkeys(a.vessel for a in plan))

    ok: dict[str, NDArray[np.bool_]] = {}
    for vid in vessels_used:
        v = VESSELS[vid]
        hs_lim, w_lim = _limits(c, v)
        wind = weather.hub_wind(v10) if v.wind_at_hub else v10
        ok[vid] = (hs <= c.alpha * hs_lim) & (wind <= c.alpha * w_lim)
    rl = {vid: weather.run_lengths(ok[vid]) for vid in vessels_used}
    # sorted window starts per (vessel, steps needed) and run
    starts: dict[tuple[str, int], list[NDArray[np.intp]]] = {}
    for a in plan:
        key = (a.vessel, _steps(a.op_hours))
        if key not in starts:
            starts[key] = [np.flatnonzero(rl[a.vessel][r] >= key[1]) for r in range(c.runs)]

    act_ids = [a.id for a in plan]
    a_start = np.zeros((c.runs, len(plan)))
    a_end = np.zeros((c.runs, len(plan)))
    a_wow = np.zeros((c.runs, len(plan)))
    a_first = np.zeros((c.runs, len(plan)))  # end of the first unit
    unfinished = 0
    for r in range(c.runs):
        free = dict.fromkeys(vessels_used, 0)
        ends: dict[str, NDArray[np.int64]] = {}
        done: dict[str, int] = {}
        failed = False
        for i, a in enumerate(plan):
            need = _steps(a.op_hours)
            trip = _steps(a.trip_hours) if a.trip_hours else 0
            win = starts[(a.vessel, need)][r]
            t = max([free[a.vessel]] + [done[d] for d in a.after])
            first: int | None = None
            wow = 0
            ue = np.zeros(a.units, dtype=np.int64)
            if a.gate is not None and a.jit:
                # just-in-time mobilisation: start late enough that, at
                # JIT_BUFFER × its calm-weather pace, no unit waits for its
                # predecessor
                lead = 0.0
                latest = t
                for k in range(a.units):
                    lead += JIT_BUFFER * (trip if a.trip_every and k % a.trip_every == 0 else 0)
                    latest = max(latest, int(a.gate(k, ends) - lead))
                    lead += JIT_BUFFER * need
                t = latest
            for k in range(a.units):
                g = a.gate(k, ends) if a.gate is not None else 0
                trip_now = trip if a.trip_every and k % a.trip_every == 0 else 0
                if first is None:
                    # mobilise so the loaded vessel arrives when the first unit can start
                    t = max(t, g - trip_now)
                    first = t
                t = max(t + trip_now, g)
                j = int(np.searchsorted(win, t))
                if j >= len(win) or win[j] + need > horizon:
                    failed = True
                    s = horizon
                else:
                    s = int(win[j])
                wow += s - t
                t = s + need
                ue[k] = t
            ends[a.id] = ue
            done[a.id] = t
            free[a.vessel] = t
            a_start[r, i] = first if first is not None else t
            a_end[r, i] = t
            a_wow[r, i] = wow
            a_first[r, i] = ue.min()
        unfinished += failed

    spd = weather.STEPS_PER_DAY
    total = a_end.max(axis=1) / spd
    median_run = int(np.argsort(total)[len(total) // 2])

    def pct(x: NDArray[np.float64]) -> dict[str, float]:
        p10, p50, p90 = np.percentile(x, [10, 50, 90])
        return {
            "p10": round(float(p10), 1),
            "p50": round(float(p50), 1),
            "p90": round(float(p90), 1),
        }

    # vessel charter cost per run
    cost = np.zeros(c.runs)
    vessel_rows = []
    for vid in vessels_used:
        v = VESSELS[vid]
        idx = [i for i, a in enumerate(plan) if a.vessel == vid]
        charter, mobs = _charter(a_start[:, idx], a_end[:, idx])
        charter /= spd
        wow_days = a_wow[:, idx].sum(axis=1) / spd
        vcost = (v.day_rate_keur * charter + v.mobilisation_keur * mobs) / 1000.0  # M€
        cost += vcost
        hs_lim, w_lim = _limits(c, v)
        need = max(_steps(plan[i].op_hours) for i in idx)
        work_m, win_m = [], []
        for m in range(12):
            sel = months == m
            work_m.append(round(100.0 * float(ok[vid][:, sel].mean()), 1) if sel.any() else None)
            win_m.append(
                round(100.0 * float((rl[vid][:, sel] >= need).mean()), 1) if sel.any() else None
            )
        vessel_rows.append(
            {
                "id": vid,
                "name": v.name,
                "role": v.role,
                "hs_limit_m": hs_lim,
                "wind_limit_ms": w_lim,
                "wind_reference": f"hub height {weather.HUB_HEIGHT_M:.0f} m"
                if v.wind_at_hub
                else "10 m",
                "day_rate_keur": v.day_rate_keur,
                "mobilisation_keur": v.mobilisation_keur,
                "workable_pct_by_month": work_m,
                "window_hours": need * STEP_H,
                "window_pct_by_month": win_m,
                "charter_days": pct(charter),
                "wow_days": pct(wow_days),
                "cost_meur": pct(vcost),
            }
        )

    activities = []
    for i, a in enumerate(plan):
        dur = (a_end[:, i] - a_start[:, i]) / spd
        activities.append(
            {
                "id": a.id,
                "name": a.name,
                "vessel": a.vessel,
                "units": a.units,
                "op_hours": a.op_hours,
                "trip_every": a.trip_every,
                "start_day": round(float(a_start[median_run, i] / spd), 1),
                "end_day": round(float(a_end[median_run, i] / spd), 1),
                "wow_days": round(float(a_wow[median_run, i] / spd), 1),
                "end_days": pct(a_end[:, i] / spd),
                "wow_share_pct": round(
                    100.0
                    * float(np.mean(a_wow[:, i] / np.maximum(1.0, a_end[:, i] - a_start[:, i]))),
                    1,
                ),
                "duration_days": pct(dur),
            }
        )

    def day_date(d: float) -> str:
        return (c.start + timedelta(days=math.floor(d))).isoformat()

    def milestone(mid: str, label: str, x: NDArray[np.float64]) -> dict[str, Any]:
        p = pct(x / spd)
        return {
            "id": mid,
            "label": label,
            "days": p,
            "date_p50": day_date(p["p50"]),
            "date_p90": day_date(p["p90"]),
        }

    col = {a: i for i, a in enumerate(act_ids)}
    if c.mode == "install":
        first_power = a_first[:, col["commissioning"]]
        milestones = [
            milestone("oss", "Offshore substation installed", a_end[:, col["oss"]]),
            milestone("export", "Export cable laid", a_end[:, col["export"]]),
            milestone("foundations", "All foundations installed", a_end[:, col["foundations"]]),
            milestone("first-power", "First power (first turbine commissioned)", first_power),
            milestone("turbines", "All turbines installed", a_end[:, col["turbines"]]),
            milestone("cod", "Full commercial operation", a_end[:, col["commissioning"]]),
        ]
    else:
        milestones = [
            milestone("turbines", "All turbines removed", a_end[:, col["turbines"]]),
            milestone("foundations", "Foundations removed", a_end[:, col["foundations"]]),
            milestone("oss", "Offshore substation removed", a_end[:, col["oss"]]),
            milestone("survey", "Seabed survey and clearance done", a_end[:, col["survey"]]),
        ]

    return {
        "mode": c.mode,
        "start_date": c.start.isoformat(),
        "alpha": c.alpha,
        "runs": c.runs,
        "seed": c.seed,
        "n_turbines": c.n_turbines,
        "strings": c.strings,
        "unfinished_runs": unfinished,
        "total_days": pct(total),
        "cost_meur": pct(cost),
        "milestones": milestones,
        "activities": activities,
        "vessels": vessel_rows,
        "months": MONTHS,
    }
