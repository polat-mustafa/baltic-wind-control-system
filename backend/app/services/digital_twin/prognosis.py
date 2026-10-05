"""Prognosis — remaining useful life (ISO 13374-1 PA block, ISO 13381-1).

ISO 13381-1:2015 frames prognosis as projecting a degradation descriptor to
an end-of-life criterion with an explicit confidence statement. Here the
descriptor is the *identified fault parameter* (e.g. gearbox loss factor),
estimated in 12-hour windows by ``diagnosis.severity_trend``:

  1. weighted least-squares line θ(t) = a + b·t (weights 1/SE²);
  2. one-sided t-test on b (H₀: b ≤ 0 towards the limit) at α = 0.05 —
     without a significant trend no RUL is reported, because a number
     extrapolated from noise is worse than none;
  3. RUL = (θ_limit − a)/b − t_now, with a 90 % interval from the delta
     method on the joint covariance of (a, b) — both the current level and
     the rate are uncertain.

Only fault modes with a defined limit in the fault library are prognosed;
the others (icing, sensor errors, derating) are not wear processes — their
advisory is to act, not to wait.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import stats

from app.services.digital_twin.diagnosis import SeverityPoint
from app.services.digital_twin.fault_library import FAULT_LIBRARY, FaultKind
from app.services.digital_twin.plant_simulator import SAMPLES_PER_DAY

MIN_POINTS = 4
SIGNIFICANCE = 0.05


@dataclass(frozen=True)
class Prognosis:
    kind: FaultKind
    limit: float
    limit_note: str
    current: float  # fitted parameter at the end of the window
    slope_per_day: float
    slope_std_error: float
    p_value: float
    significant: bool
    rul_days: float | None
    rul_lower_days: float | None
    rul_upper_days: float | None
    points: int
    status: str  # "trend", "no_trend", "limit_exceeded", "insufficient_data"


def prognose(kind: FaultKind, trend: list[SeverityPoint], end_idx: int) -> Prognosis | None:
    mode = FAULT_LIBRARY[kind]
    if mode.prognosis_limit is None:
        return None
    limit = mode.prognosis_limit
    note = mode.prognosis_limit_note or ""
    direction = 1.0 if limit > mode.nominal else -1.0

    def result(status: str, **kw: float | bool | None) -> Prognosis:
        base: dict[str, float | bool | None] = {
            "current": float("nan"),
            "slope_per_day": 0.0,
            "slope_std_error": 0.0,
            "p_value": 1.0,
            "significant": False,
            "rul_days": None,
            "rul_lower_days": None,
            "rul_upper_days": None,
        }
        base.update(kw)
        return Prognosis(
            kind=kind,
            limit=limit,
            limit_note=note,
            points=len(trend),
            status=status,
            **base,  # type: ignore[arg-type]
        )

    if len(trend) < MIN_POINTS:
        return result("insufficient_data")

    t = np.array([p.centre_idx for p in trend], dtype=np.float64) / SAMPLES_PER_DAY
    y = np.array([p.severity for p in trend])
    w = 1.0 / np.maximum(np.array([p.std_error for p in trend]), 1e-6) ** 2
    t_now = end_idx / SAMPLES_PER_DAY

    # Weighted least squares: residual variance re-estimated from the scatter.
    sw = w.sum()
    t_bar = float((w * t).sum() / sw)
    y_bar = float((w * y).sum() / sw)
    sxx = float((w * (t - t_bar) ** 2).sum())
    if sxx <= 0.0:
        return result("insufficient_data")
    slope = float((w * (t - t_bar) * (y - y_bar)).sum() / sxx)
    intercept = y_bar - slope * t_bar
    dof = len(trend) - 2
    s2 = float((w * (y - intercept - slope * t) ** 2).sum() / dof)
    se = float(np.sqrt(s2 / sxx))
    t_stat = direction * slope / se if se > 0 else 0.0
    p_value = float(stats.t.sf(t_stat, dof))
    current = intercept + slope * t_now
    significant = p_value < SIGNIFICANCE and direction * slope > 0
    common = {
        "current": round(current, 4),
        "slope_per_day": round(slope, 5),
        "slope_std_error": round(se, 5),
        "p_value": round(p_value, 5),
        "significant": significant,
    }

    if direction * (current - limit) >= 0:
        return result(
            "limit_exceeded", rul_days=0.0, rul_lower_days=0.0, rul_upper_days=0.0, **common
        )
    if not significant:
        return result("no_trend", **common)

    # Delta method: RUL(a, b) = (L − a)/b − t_now
    rul = (limit - intercept) / slope - t_now
    grad = np.array([-1.0 / slope, -(limit - intercept) / slope**2])
    cov = s2 * np.array([[1.0 / sw + t_bar**2 / sxx, -t_bar / sxx], [-t_bar / sxx, 1.0 / sxx]])
    rul_se = float(np.sqrt(grad @ cov @ grad))
    t_crit = float(stats.t.ppf(0.95, dof))
    return result(
        "trend",
        rul_days=round(rul, 2),
        rul_lower_days=round(max(rul - t_crit * rul_se, 0.0), 2),
        rul_upper_days=round(rul + t_crit * rul_se, 2),
        **common,
    )
