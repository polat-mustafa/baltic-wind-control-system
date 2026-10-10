"""
Wake-model validation against measured row power ratios (evidence programme B1).

Our three wake set-ups — NOJ (``configure_wake_model_flexible``), the production BPA
Gaussian (``configure_wake_model``, Niayifar & Porté-Agel 2016) and TurbOPark
(``turbopark_model``, Nygaard et al. 2022) — are run on the real Horns Rev 1 (80 × V80)
and Lillgrund (48 × SWT-2.3-93) layouts and scored against SCADA power ratios P_i/P_1
along wind-aligned rows (``validation_data/pywake``, PyWake v2.6.7, MIT; see SOURCES.md).

Method (as PyWake's own validation, van der Laan et al. 2015, DOI 10.1002/we.1804):
- Uniform inflow at the measured bin centre (Horns Rev 1: 8 m/s, TI 5.6 %;
  Lillgrund: 9 m/s, TI 4.8 %), every 1° wind direction.
- Measured bins are ±2.5° wide → model power is averaged over wd ± 3°.
- The measured direction comes from one reference turbine's yaw, so the true direction
  at each turbine scatters around it (Gaumond et al. 2014, DOI 10.1002/we.1625). The
  "direction-averaged" result convolves model power with a Gaussian of σ: Lillgrund 3.3°;
  Horns Rev 1 σ = hypot(0.00035·d + 2.1, 2.5) with d [m] the distance to reference WT G2.
- Horns Rev 1 rows = the 10 turbines along 270°, summed over the six inner rows.
- Score = RMSE of P_i/P_1 over turbines 2…n with a measurement [-].
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

DATA_DIR = Path(__file__).parent / "validation_data" / "pywake"
MODELS = ("NOJ", "BPA", "TurbOPark")


@dataclass(frozen=True)
class RowCase:
    farm: str  # "Hornsrev1" | "Lillgrund"
    row: str
    wd_deg: float
    wts: tuple[int | None, ...]  # turbine index along the row, upstream first; None = no data


_LG_B = (14, 13, 12, 11, 10, 9, 8, 7)
_LG_D = (29, 28, 27, None, 26, 25, 24, 23)  # D4 position is empty (no turbine)
_LG_6 = (2, 9, 17, 25, 32, 37, 42, 46)
_LG_4 = (4, 11, 19, None, None, 39, 44)  # sub-station and a gap in row 4

#: PyWake's row definitions (``py_wake/validation/validation.py``).
CASES = (
    RowCase("Hornsrev1", "InnerRowMean", 270.0, tuple(range(10))),
    RowCase("Lillgrund", "RowB", 222.0, _LG_B),
    RowCase("Lillgrund", "RowD", 222.0, _LG_D),
    RowCase("Lillgrund", "RowB", 207.0, _LG_B),
    RowCase("Lillgrund", "RowD", 207.0, _LG_D),
    RowCase("Lillgrund", "Row6", 120.0, _LG_6),
    RowCase("Lillgrund", "Row4", 120.0, _LG_4),
    RowCase("Lillgrund", "Row6", 105.0, _LG_6),
    RowCase("Lillgrund", "Row4", 105.0, _LG_4),
)


@dataclass(frozen=True)
class RowScore:
    farm: str
    row: str
    wd_deg: float
    model: str
    measured: list[float]  # P_i/P_1 [-], NaN = no measurement
    predicted: list[float]  # P_i/P_1 [-], bin mean
    predicted_averaged: list[float]  # P_i/P_1 [-], bin mean after direction averaging
    rmse: float
    rmse_averaged: float


def measured_ratios(case: RowCase) -> NDArray[np.float64]:
    """Measured P_i/P_1 [-] along the row (Horns Rev 1 is stored as P_i/P_G2)."""
    path = DATA_DIR / f"{case.farm}_WFdata_wd{int(case.wd_deg)}_{case.row}.dat"
    p = np.genfromtxt(path, comments="#")[:, 1]
    return np.asarray(p / p[0], dtype=np.float64)


def _farm(name: str) -> tuple[Any, NDArray[np.float64], NDArray[np.float64], float, float, Any]:
    """(turbine, x [m], y [m], ws [m/s], ti [-], σ per turbine [deg])."""
    if name == "Hornsrev1":
        from py_wake.examples.data.hornsrev1 import HornsrevV80, wt_x, wt_y

        x, y = np.asarray(wt_x, float), np.asarray(wt_y, float)
        d_g2 = np.hypot(x - x[6], y - y[6])  # WT G2 = 7th turbine of column 1
        return HornsrevV80(), x, y, 8.0, 0.056, np.hypot(0.00035 * d_g2 + 2.1, 2.5)
    from py_wake.validation.lillgrund import SWT2p3_93_65, wt_x, wt_y

    x, y = np.asarray(wt_x, float), np.asarray(wt_y, float)
    return SWT2p3_93_65(), x, y, 9.0, 0.048, np.full(len(x), 3.3)


def _model(name: str, site: Any, turbine: Any) -> Any:
    from app.services.p1.wake_model import configure_wake_model, turbopark_model
    from app.services.p1.wake_models import WakeDeficitModel, configure_wake_model_flexible

    if name == "NOJ":
        return configure_wake_model_flexible(site, turbine, deficit_model=WakeDeficitModel.NOJ)
    if name == "BPA":
        return configure_wake_model(site, turbine)
    return turbopark_model(site, turbine)


def direction_average(power: NDArray[np.float64], sigma_deg: NDArray[np.float64]) -> Any:
    """Circular Gaussian average over wind direction; power (n_wt, 360) at 1° steps,
    one σ [deg] per turbine; weights cut at ±30° (≥ 6σ for every σ used here)."""
    off = np.arange(-30, 31)
    w = np.exp(-0.5 * (off[None, :] / sigma_deg[:, None]) ** 2)
    w /= w.sum(axis=1, keepdims=True)
    idx = (np.arange(360)[:, None] + off[None, :]) % 360
    return np.einsum("tdk,tk->td", power[:, idx], w)


def _row_ratios(case: RowCase, power: Any) -> NDArray[np.float64]:
    wd = (int(case.wd_deg) + np.arange(-3, 4)) % 360  # ±2.5° bin on the 1° grid
    p = power[:, wd].mean(axis=1)
    if case.farm == "Hornsrev1":
        row = p.reshape(10, 8)[:, 1:7].sum(axis=1)  # 10 columns W→E, inner six rows
    else:
        row = np.array([np.nan if i is None else p[i] for i in case.wts])
    return np.asarray(row / row[0], dtype=np.float64)


def _rmse(pred: NDArray[np.float64], meas: NDArray[np.float64]) -> float:
    ok = np.isfinite(pred) & np.isfinite(meas)
    ok[0] = False  # P_1/P_1 = 1 by construction
    return float(np.sqrt(np.mean((pred[ok] - meas[ok]) ** 2)))


@cache
def _power(farm: str, model: str) -> tuple[Any, Any]:
    """Power [W] (n_wt, 360) at the bin wind speed: plain and direction-averaged."""
    from py_wake.site import UniformSite

    turbine, x, y, ws, ti, sigma = _farm(farm)
    sim = _model(model, UniformSite(ti=ti), turbine)(x, y, wd=np.arange(360.0), ws=[ws])
    p = np.asarray(sim.Power.values[:, :, 0], dtype=np.float64)
    return p, direction_average(p, sigma)


def validate_wake_models() -> list[RowScore]:
    """Score NOJ / BPA / TurbOPark on every measured row (≈ 10 s, cached per process)."""
    scores = []
    for case in CASES:
        meas = measured_ratios(case)
        for model in MODELS:
            p, p_avg = _power(case.farm, model)
            pred, pred_avg = _row_ratios(case, p), _row_ratios(case, p_avg)
            scores.append(
                RowScore(
                    farm=case.farm,
                    row=case.row,
                    wd_deg=case.wd_deg,
                    model=model,
                    measured=meas.tolist(),
                    predicted=pred.tolist(),
                    predicted_averaged=pred_avg.tolist(),
                    rmse=_rmse(pred, meas),
                    rmse_averaged=_rmse(pred_avg, meas),
                )
            )
    return scores


if __name__ == "__main__":
    for s in validate_wake_models():
        print(
            f"{s.farm:9} {s.row:12} {s.wd_deg:5.0f}° {s.model:9}"
            f" RMSE {s.rmse:.3f}  averaged {s.rmse_averaged:.3f}"
        )
