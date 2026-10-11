"""
AEP-chain validation against a real farm's measured output (evidence programme A1).

The P1 chain — reanalysis wind → hub-height shear → turbine power curve → production
wake model (BPA Gaussian, ``configure_wake_model``) → the AEP cascade's loss factors —
is run hour by hour for Rødsand II (90 × Siemens SWT-2.3-93, 207 MW, Danish Baltic Sea)
through 2025 and compared with what the farm actually delivered (ENTSO-E 16.1.A unit
generation, bundled for P4).

Inputs (``validation_data/roedsand2``, see SOURCES.md):
- turbine positions: OpenStreetMap (ODbL), 90 nodes, model tag SWT-2.3-93;
- wind: ERA5 hourly 100 m speed / direction at the farm (Open-Meteo archive, CC BY 4.0),
  shifted to the 68.5 m hub with the power law, α = 0.14 (IEC 61400-3-1, as everywhere else);
- turbine: PyWake's SWT-2.3-93 power / Ct curves (``py_wake.validation.lillgrund``, the
  same turbine type as Lillgrund, MIT);
- losses: the cascade defaults (electrical 2 %, availability 5 %, environmental 1 %).

Not modelled: global blockage, curtailment, grid outages, air density (standard 1.225
kg/m³). The measured output includes all of them, so a small positive bias is expected.
Only hours present in both series are compared (the ENTSO-E file drops hours without NWP).
"""

from __future__ import annotations

import csv
import gzip
import math
from dataclasses import dataclass
from functools import cache
from pathlib import Path

import numpy as np

from app.services.lifecycle.weather import SHEAR_ALPHA
from app.services.p1.aep_calculator import (
    DEFAULT_AVAILABILITY_LOSS,
    DEFAULT_ELECTRICAL_LOSS,
    DEFAULT_ENVIRONMENTAL_LOSS,
)

DATA_DIR = Path(__file__).parent / "validation_data" / "roedsand2"
CAPACITY_MW = 207.0  # 90 × 2.3 MW
HUB_HEIGHT_M = 68.5  # Rødsand II hub height (E.ON); ERA5 wind is at 100 m
YEAR = 2025
TI = 0.06  # ambient turbulence intensity offshore at the hub
LOSS_FACTOR = (
    (1 - DEFAULT_ELECTRICAL_LOSS)
    * (1 - DEFAULT_AVAILABILITY_LOSS)
    * (1 - DEFAULT_ENVIRONMENTAL_LOSS)
)


@dataclass(frozen=True)
class AepValidation:
    hours: int  # hours compared
    measured_gwh: float
    free_gwh: float  # no wakes, no losses
    waked_gwh: float  # after wakes
    net_gwh: float  # after wakes and the cascade losses
    wake_loss_pct: float
    bias_pct: float  # net model vs measured energy [%]
    monthly_r2: float  # R² of monthly energies [-]
    hourly_nrmse_pct: float  # RMSE of hourly net power, % of capacity
    cf_measured_pct: float
    cf_model_pct: float
    monthly_gwh: list[tuple[int, float, float]]  # (month, measured, model net)


def _layout_m() -> tuple[np.ndarray, np.ndarray]:
    """Turbine positions [m], local east / north about the centroid (equirectangular)."""
    with (DATA_DIR / "layout.csv").open(encoding="utf-8") as f:
        rows = [(float(r["lat"]), float(r["lon"])) for r in csv.DictReader(f)]
    lat = np.array([r[0] for r in rows])
    lon = np.array([r[1] for r in rows])
    lat0, lon0 = lat.mean(), lon.mean()
    x = (lon - lon0) * 111_320.0 * math.cos(math.radians(lat0))
    y = (lat - lat0) * 110_574.0
    return x, y


def _era5() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(time [h], hub wind [m/s], direction [deg]) for YEAR."""
    with gzip.open(DATA_DIR / f"era5_{YEAR}.csv.gz", "rt", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    t = np.array([r["time_utc"] for r in rows], dtype="datetime64[h]")
    ws100 = np.array([float(r["ws100"]) for r in rows])
    wd = np.array([float(r["wd100"]) for r in rows])
    return t, ws100 * (HUB_HEIGHT_M / 100.0) ** SHEAR_ALPHA, wd


@cache
def validate_aep_chain() -> AepValidation:
    """Run the chain for every hour of YEAR and score it against the metered output (≈ 20 s)."""
    from py_wake.site import UniformSite
    from py_wake.validation.lillgrund import SWT2p3_93_65

    from app.services.p1.wake_model import configure_wake_model
    from app.services.p4.real_data import load_dataset

    x, y = _layout_m()
    t, ws, wd = _era5()
    turbine = SWT2p3_93_65()
    sim = configure_wake_model(UniformSite(ti=TI), turbine)(x, y, wd=wd, ws=ws, time=True)
    waked = np.asarray(sim.Power.values, dtype=float).sum(axis=0) / 1e6  # MW per hour
    free = np.asarray(turbine.power(ws), dtype=float) * len(x) / 1e6

    meas = load_dataset("roedsand2")
    in_year = meas.time_utc.astype("datetime64[Y]").astype(int) + 1970 == YEAR
    m_t, m_p = meas.time_utc[in_year], meas.power_mw[in_year]
    common, i_model, i_meas = np.intersect1d(t, m_t, return_indices=True)
    p_meas = m_p[i_meas]
    p_waked, p_free = waked[i_model], free[i_model]
    p_net = p_waked * LOSS_FACTOR

    months = common.astype("datetime64[M]").astype(int) % 12 + 1
    monthly = [
        (mo, float(p_meas[months == mo].sum() / 1e3), float(p_net[months == mo].sum() / 1e3))
        for mo in range(1, 13)
    ]
    mm = np.array([m[1] for m in monthly])
    mn = np.array([m[2] for m in monthly])
    e_meas, e_net = p_meas.sum() / 1e3, p_net.sum() / 1e3
    return AepValidation(
        hours=len(common),
        measured_gwh=float(e_meas),
        free_gwh=float(p_free.sum() / 1e3),
        waked_gwh=float(p_waked.sum() / 1e3),
        net_gwh=float(e_net),
        wake_loss_pct=float(100 * (1 - p_waked.sum() / p_free.sum())),
        bias_pct=float(100 * (e_net / e_meas - 1)),
        monthly_r2=float(np.corrcoef(mm, mn)[0, 1] ** 2),
        hourly_nrmse_pct=float(100 * np.sqrt(np.mean((p_net - p_meas) ** 2)) / CAPACITY_MW),
        cf_measured_pct=float(100 * p_meas.mean() / CAPACITY_MW),
        cf_model_pct=float(100 * p_net.mean() / CAPACITY_MW),
        monthly_gwh=monthly,
    )


if __name__ == "__main__":
    v = validate_aep_chain()
    print(
        f"Rødsand II {YEAR}: {v.hours} h · measured {v.measured_gwh:.1f} GWh · model net "
        f"{v.net_gwh:.1f} GWh (free {v.free_gwh:.1f}, wake loss {v.wake_loss_pct:.1f} %) · "
        f"bias {v.bias_pct:+.1f} % · monthly R² {v.monthly_r2:.3f} · hourly nRMSE "
        f"{v.hourly_nrmse_pct:.1f} % · CF {v.cf_measured_pct:.1f} vs {v.cf_model_pct:.1f} %"
    )
