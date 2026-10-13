# ruff: noqa: E501
"""Audit C-2 / 2.6 — the app's fleet O&M replay (``lifecycle.om_simulation``) against NREL WOMBAT.

Same inputs on both sides: 34 × 15 MW turbines, the Carroll et al. 2016 failure classes of
``availability_model`` (Poisson arrivals = Weibull shape 1, scale 1/rate years; repair
hours; materials), 2 CTVs × 3 crews in 07:00–19:00 shifts (Hs ≤ 1.5 m, wind ≤ 10 m/s,
2 h transit each way), a jack-up for major replacements (30 days mobilisation, Hs ≤ 2 m,
wind ≤ 8 m/s, around the clock), and the same 30-year hindcast hour by hour (``weather``).
WOMBAT's wind column is the 10 m wind the vessel limits refer to; its power curve is the
IEA 15 MW curve re-expressed against that 10 m wind (the app's power-law shear), so both
compute energy-based availability from the same power.

Known model differences (not errors): WOMBAT has no per-class response delay (app: 4 h
minor, 24 h major repair), charters the jack-up for a fixed 30 days (app: until no
replacement is waiting), and dispatches crews by its own queueing rules.

Needs: pip install wombat==0.13.4. Run: cd backend && PYTHONPATH=. python scripts/audit/c2_wombat_om.py
"""

from __future__ import annotations

import logging
import tempfile
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

N_CTV, CREWS = 2, 3
CTV_SPEED_KMH = 37.0  # 20 kn
SEED = 2016


def _weather(years: int) -> pd.DataFrame:
    from app.services.lifecycle import om_simulation as om
    from app.services.lifecycle import weather

    t, _hs, _v10 = weather.hindcast()
    th = (t[:, None] + np.arange(weather.STEP_HOURS).astype("timedelta64[h]")).ravel()
    year, hs_h, v10_h, _hour = om._hourly()
    keep = year < year[0] + years
    return pd.DataFrame(
        {"datetime": pd.to_datetime(th[keep]), "windspeed": v10_h[keep], "waveheight": hs_h[keep]}
    )


def _power_curve_vs_v10(lib: Path) -> None:
    """IEA 15 MW power as a function of the 10 m wind (the app's shear to hub height)."""
    from app.services.lifecycle import weather
    from app.services.p1.turbine_models import get_turbine

    v10 = np.arange(0.5, 30.0, 0.25)
    p = get_turbine(None).power_curve_kw(weather.hub_wind(v10))
    pd.DataFrame({"windspeed_ms": v10, "power_kw": p}).to_csv(
        lib / "turbines" / "iea15_v10.csv", index=False
    )


def _library(lib: Path, years: int) -> dict:
    from app.services.lifecycle import om_simulation as om
    from app.services.lifecycle.availability_model import CTV_TRANSIT_H, FAILURE_CLASSES

    for d in (
        "project/config",
        "project/plant",
        "turbines",
        "weather",
        "vessels",
        "substations",
        "cables",
    ):
        (lib / d).mkdir(parents=True, exist_ok=True)
    w = _weather(years)
    w.to_csv(lib / "weather" / "sb510.csv", index=False)
    _power_curve_vs_v10(lib)
    start, end = int(w.datetime.dt.year.min()), int(w.datetime.dt.year.max())

    # one subassembly per failure class: WOMBAT pauses and resets the failure clocks of a
    # subassembly while it is down or replaced; the app's classes are independent Poisson
    # processes, which separate subassemblies reproduce
    turbine: dict = {
        "capacity_kw": om.TURBINE_MW * 1000,
        "capex_kw": 1300,
        "power_curve": {"file": "iea15_v10.csv", "bin_width": 0.25},
    }
    for level, c in enumerate(FAILURE_CLASSES, start=1):
        key = c.name.lower().replace(" ", "_")
        turbine[key] = {
            "name": c.name,
            "maintenance": [],
            "failures": [
                {
                    "scale": 1.0 / c.rate_per_year,
                    "shape": 1.0,
                    "time": c.repair_h,
                    "materials": om.MATERIALS_EUR[c.name],
                    "operation_reduction": 1.0,
                    "level": level,
                    "service_equipment": "CTV" if c.vessel == "CTV" else "LCN",
                    "replacement": c.vessel != "CTV",
                    "description": c.name,
                }
            ],
        }
    substation = {
        "capacity_kw": 600_000,
        "capex_kw": 120,
        "transformer": {"name": "transformer", "maintenance": [], "failures": []},
    }
    cable = {"name": "array cable", "maintenance": [], "failures": []}
    ctv_limits = FAILURE_CLASSES[0]
    jack = FAILURE_CLASSES[2]
    vessels = {
        "ctv": {
            "name": "CTV",
            "equipment_rate": om.CTV_DAY_RATE_EUR,
            "n_crews": CREWS,
            "crew": {
                "n_day_rate": om.TECHS_PER_CREW,
                "day_rate": 0,
                "n_hourly_rate": 0,
                "hourly_rate": 0,
            },
            "capability": "CTV",
            "speed": CTV_SPEED_KMH,
            "port_distance": CTV_TRANSIT_H * CTV_SPEED_KMH,
            "max_windspeed_transport": ctv_limits.wind_limit_ms,
            "max_windspeed_repair": ctv_limits.wind_limit_ms,
            "max_waveheight_transport": ctv_limits.hs_limit_m,
            "max_waveheight_repair": ctv_limits.hs_limit_m,
            "workday_start": om.SHIFT_START_H,
            "workday_end": om.SHIFT_START_H + om.SHIFT_LEN_H,
            "start_month": 1,
            "start_day": 1,
            "end_month": 12,
            "end_day": 31,
            "start_year": start,
            "end_year": end,
            "strategy": "scheduled",
        },
        "jackup": {
            "name": "Jack-up",
            "equipment_rate": om.JACKUP_DAY_RATE_EUR,
            "n_crews": 1,
            "crew": {"n_day_rate": 0, "day_rate": 0, "n_hourly_rate": 0, "hourly_rate": 0},
            "capability": "LCN",
            "speed": 11.0,
            "port_distance": 74.0,
            "mobilization_cost": om.JACKUP_MOBILISATION_EUR,
            "mobilization_days": om.JACKUP_LEAD_H // 24,
            "max_windspeed_transport": jack.wind_limit_ms,
            "max_windspeed_repair": jack.wind_limit_ms,
            "max_waveheight_transport": jack.hs_limit_m,
            "max_waveheight_repair": jack.hs_limit_m,
            "workday_start": 0,
            "workday_end": 24,
            "strategy": "requests",
            "strategy_threshold": 1,
            "charter_days": 30,
        },
    }
    # one substation, 34 turbines on 6 strings (6-6-6-6-5-5) as the P2 network
    rows = [
        {
            "id": "OSS",
            "substation_id": "OSS",
            "name": "OSS",
            "type": "substation",
            "string": "",
            "order": "",
            "distance": 0,
            "subassembly": "oss",
            "upstream_cable": "array",
        }
    ]
    n = 0
    for s, count in enumerate((6, 6, 6, 6, 5, 5)):
        for o in range(count):
            n += 1
            rows.append(
                {
                    "id": f"WTG{n:02d}",
                    "substation_id": "OSS",
                    "name": f"WTG{n:02d}",
                    "type": "turbine",
                    "string": s,
                    "order": o,
                    "distance": 2.0,
                    "subassembly": "iea15",
                    "upstream_cable": "array",
                }
            )
    layout = pd.DataFrame(rows)
    return {
        "name": "sb510_wombat",
        "layout": layout,
        "layout_coords": "distance",
        "service_equipment": [["ctv", N_CTV], "jackup"],
        "weather": "sb510.csv",
        "workday_start": om.SHIFT_START_H,
        "workday_end": om.SHIFT_START_H + om.SHIFT_LEN_H,
        "inflation_rate": 0,
        "project_capacity": om.N_TURBINES * om.TURBINE_MW,
        "start_year": start,
        "end_year": end,
        "random_seed": SEED,
        "turbines": {"iea15": turbine},
        "substations": {"oss": substation},
        "cables": {"array": cable},
        "vessels": vessels,
    }


def compare(years: int = 30) -> dict[str, tuple[float, float]]:
    """(time-based, energy-based) availability [%] of the app and of WOMBAT."""
    from wombat import Simulation

    from app.services.lifecycle.om_simulation import simulate_om

    with tempfile.TemporaryDirectory() as tmp:
        lib = Path(tmp)
        config = _library(lib, years)
        sim = Simulation(library_path=lib, config=config, random_seed=SEED)
        sim.run(delete_logs=True, save_metrics_inputs=False)
        tb = float(
            sim.metrics.time_based_availability(frequency="project", by="windfarm").squeeze()
        )
        pb = float(
            sim.metrics.production_based_availability(frequency="project", by="windfarm").squeeze()
        )
    app = simulate_om(N_CTV, CREWS)
    n = min(years, len(app.years))
    app_t = float(np.mean([y.time_based for y in app.years[:n]]))
    app_e = float(np.mean([y.energy_based for y in app.years[:n]]))
    return {"app": (100 * app_t, 100 * app_e), "wombat": (100 * tb, 100 * pb)}


if __name__ == "__main__":
    r = compare()
    for k, (t, e) in r.items():
        print(f"{k:7s} time-based {t:6.2f} %   energy-based {e:6.2f} %")
