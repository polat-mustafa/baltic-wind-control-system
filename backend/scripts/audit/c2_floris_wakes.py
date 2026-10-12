# ruff: noqa: E501
"""Audit C-2 — the app's wake models (PyWake) against NREL FLORIS on the SB-510 layout.

The same 34 IEA 15 MW positions (``generate_regular_grid``: 5 D × 8 D, 6 columns), the
same power / thrust table (``turbine_models``, official IEA-15-240-RWT table), ambient
TI 6 %, 36 directions × wind speeds 4–24 m/s weighted with the SB-510 Weibull
(A 10.80 m/s, k 2.04), omnidirectional. Three model pairs:

  Jensen      PyWake NOJDeficit(k = 0.05) + SquaredSum   vs FLORIS "jensen" (we = 0.05) + "sosfs"
              — the same published model; differences come from rotor averaging only
  TurbOPark   app turbopark_model (verified against Ørsted's code, A2)  vs FLORIS "turboparkgauss"
              (Pedersen et al. 2022, Gaussian overlap as Ørsted's code; FLORIS's older
              "turbopark" approximates the overlap and is shown for comparison)
  Gaussian    app NiayifarGaussianDeficit + LinearSum + STF2017 (production)  vs FLORIS "gauss"
              (Bastankhah & Porté-Agel 2016 with near-wake, TI-expansion) — related, not the
              same model: their difference is model-form spread, not an error

Needs: pip install floris==4.2.1. Run: cd backend && PYTHONPATH=. python scripts/audit/c2_floris_wakes.py
"""

from __future__ import annotations

import logging
import math
import warnings

import numpy as np

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

WD = np.arange(0.0, 360.0, 10.0)
WS = np.arange(4.0, 25.0, 1.0)
TI = 0.06


def _weights() -> np.ndarray:
    from app.services.site_assessment.wind_climate import SB510_WEIBULL_A as A
    from app.services.site_assessment.wind_climate import SB510_WEIBULL_K as K

    def cdf(v: float) -> float:
        return 1 - math.exp(-((max(v, 0.0) / A) ** K))

    return np.array([cdf(v + 0.5) - cdf(v - 0.5) for v in WS])


def _layout() -> tuple[np.ndarray, np.ndarray]:
    from app.services.p1.layout_optimizer import generate_regular_grid

    lay = generate_regular_grid()
    return np.asarray(lay.x_positions, float), np.asarray(lay.y_positions, float)


def _table() -> tuple[np.ndarray, np.ndarray, np.ndarray, float, float]:
    from app.services.p1.turbine_models import get_turbine

    t = get_turbine()
    ws = np.arange(0.0, 35.01, 0.25)
    return ws, t.power_curve_kw(ws), t.ct_curve(ws), t.rotor_diameter_m, t.hub_height_m


def wake_loss(power: np.ndarray, power_free: np.ndarray) -> float:
    """AEP-weighted farm wake loss [%]; power arrays (n_wd, n_ws, n_turb)."""
    w = _weights()[None, :]
    return float(100 * (1 - (power.sum(-1) * w).sum() / (power_free.sum(-1) * w).sum()))


def pywake(model: str) -> float:
    from py_wake.deficit_models.noj import NOJDeficit
    from py_wake.site import UniformSite
    from py_wake.superposition_models import SquaredSum
    from py_wake.wind_farm_models import PropagateDownwind
    from py_wake.wind_turbines import WindTurbine
    from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

    from app.services.p1.wake_model import configure_wake_model, turbopark_model

    ws, p, ct, d, h = _table()
    wt = WindTurbine("IEA15", d, h, PowerCtTabular(ws, p, "kW", ct))
    site = UniformSite(ti=TI)
    x, y = _layout()
    if model == "jensen":
        wfm = PropagateDownwind(
            site, wt, wake_deficitModel=NOJDeficit(k=0.05), superpositionModel=SquaredSum()
        )
    elif model == "turbopark":
        wfm = turbopark_model(site, wt)
    else:
        wfm = configure_wake_model(site, wt)
    sim = wfm(x, y, wd=WD, ws=WS)
    pw = sim.Power.values.transpose(1, 2, 0)  # (wd, ws, turb)
    free = np.broadcast_to(np.interp(WS, ws, p)[None, :, None] * 1e3, pw.shape)
    return wake_loss(pw, free)


def floris(model: str) -> float:
    from floris import FlorisModel, TimeSeries

    ws, p, ct, d, h = _table()
    turbine = {
        "turbine_type": "iea15_app",
        "hub_height": h,
        "rotor_diameter": d,
        "TSR": 9.0,
        "operation_model": "cosine-loss",
        "power_thrust_table": {
            "ref_air_density": 1.225,
            "ref_tilt": 0.0,
            "cosine_loss_exponent_yaw": 1.88,
            "cosine_loss_exponent_tilt": 1.88,
            "wind_speed": ws.tolist(),
            "power": p.tolist(),
            "thrust_coefficient": ct.tolist(),
        },
    }
    x, y = _layout()
    cfg = {
        "name": "sb510",
        "description": "SB-510 cross-check",
        "floris_version": "v4",
        "logging": {
            "console": {"enable": False, "level": "WARNING"},
            "file": {"enable": False, "level": "WARNING"},
        },
        "solver": {"type": "turbine_grid", "turbine_grid_points": 3},  # FLORIS maximum
        "farm": {"layout_x": x.tolist(), "layout_y": y.tolist(), "turbine_type": [turbine]},
        "flow_field": {
            "air_density": 1.225,
            "reference_wind_height": h,
            "turbulence_intensities": [TI],
            "wind_directions": [270.0],
            "wind_shear": 0.0,  # uniform inflow, as PyWake's UniformSite
            "wind_speeds": [8.0],
            "wind_veer": 0.0,
        },
        "wake": {
            "model_strings": {
                # squared-sum superposition, as PyWake (Jensen) and Ørsted (TurbOPark)
                "combination_model": "sosfs",
                "deflection_model": "none",
                "turbulence_model": "crespo_hernandez",
                "velocity_model": model,
            },
            "enable_secondary_steering": False,
            "enable_yaw_added_recovery": False,
            "enable_active_wake_mixing": False,
            "enable_transverse_velocities": False,
            "wake_deflection_parameters": {"none": {}},
            "wake_velocity_parameters": {
                "jensen": {"we": 0.05},
                "turbopark": {"A": 0.04, "sigma_max_rel": 4.0},
                "turboparkgauss": {"A": 0.04, "include_mirror_wake": True},
                "gauss": {"alpha": 0.58, "beta": 0.077, "ka": 0.38, "kb": 0.004},
            },
            "wake_turbulence_parameters": {
                "crespo_hernandez": {
                    "initial": 0.1,
                    "constant": 0.5,
                    "ai": 0.8,
                    "downstream": -0.32,
                }
            },
        },
    }
    wd_g, ws_g = np.meshgrid(WD, WS, indexing="ij")
    fm = FlorisModel(cfg)
    fm.set(
        wind_data=TimeSeries(
            wind_directions=wd_g.ravel(), wind_speeds=ws_g.ravel(), turbulence_intensities=TI
        )
    )
    fm.run()
    pw = fm.get_turbine_powers().reshape(len(WD), len(WS), -1)
    fm.run_no_wake()
    free = fm.get_turbine_powers().reshape(len(WD), len(WS), -1)
    return wake_loss(pw, free)


def compare() -> dict[str, tuple[float, float]]:
    pairs = (
        ("jensen", "jensen"),
        ("turboparkgauss", "turbopark"),
        ("turbopark", "turbopark"),
        ("gauss", "gauss"),
    )
    return {f: (pywake(p), floris(f)) for f, p in pairs}


def main() -> None:
    print("SB-510 (34 × IEA 15 MW, 5 D × 8 D), TI 6 %, omnidirectional, SB-510 Weibull")
    print(f"{'FLORIS model':>15s}{'PyWake/app %':>14s}{'FLORIS %':>10s}{'Δ pp':>7s}")
    for m, (a, b) in compare().items():
        print(f"{m:>15s}{a:14.2f}{b:10.2f}{a - b:7.2f}")


if __name__ == "__main__":
    main()
