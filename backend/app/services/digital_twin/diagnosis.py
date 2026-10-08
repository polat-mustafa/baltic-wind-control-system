"""Diagnosis — fault isolation and identification (ISO 13374-1 HA block).

Method: parameter-estimation fault isolation (Isermann, *Fault-Diagnosis
Systems*, Springer 2006). Instead of hand-written threshold
rules, every hypothesis in the fault library is *simulated through the
reference model* over the wind and density the turbine actually saw, and its
severity θ is fitted by weighted least squares to the observed standardised
residuals of all five channels:

  J_h(θ) = Σ_c (1/κ_c)·Σ_{k∈S} [ (r_obs,c[k] − r_pred,c[k; h, θ])² / σ²_h,c[k]
                                  + ln(σ²_h,c[k] / σ²_c[k]) ]

The twin only knows the measured wind, which differs from the wind the rotor
saw by an error of σ_v(v) (estimated in Phase I). The prediction is
therefore the *expectation* over that error, not the curve itself
(JCGM 100:2008 §5.1; the curvature/Jensen term matters at every kink of the
control law):

  r_pred,c(v) = E[y_h,c(v − ε)] − E[y_twin,c(v − ε)],
  σ²_h,c(v)   = σ²_c(v) + Var[y_h,c(v − ε)] − Var[y_twin,c(v − ε)],

with σ_c the Phase I scatter of a healthy turbine. The log term is the
Gaussian normalisation, so a hypothesis cannot win simply by widening its
own error bars.

S = samples inside the turbine's detection events; κ_c is the EWMAST
autocorrelation factor, so strongly autocorrelated channels (generator
temperature, anemometer) do not count their samples as independent
evidence. The hypothesis with the lowest J wins; equal-prior posterior
weights ∝ exp(−J/2) express how clearly it beats the others; the fraction of
the no-fault cost it removes (1 − J/J₀) shows whether the deviation is
explained at all. A detection that no hypothesis explains is reported as
"unexplained" — an unmodelled fault or a false alarm — never forced into a
class.

Expectations are taken on a 0.1 m/s wind grid at the median density of S
and interpolated to every sample; the generator-temperature
residual goes through the same first-order thermal lag as the twin.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize_scalar

from app.services.digital_twin.detection import (
    ANEMOMETER,
    CHANNEL_KEYS,
    Calibration,
    Detection,
    Event,
    TwinView,
)
from app.services.digital_twin.fault_library import (
    FAULT_KINDS,
    FAULT_LIBRARY,
    FaultKind,
    severity_to_fault_value,
)
from app.services.digital_twin.plant_simulator import SAMPLE_PERIOD_S, PlantData
from app.services.digital_twin.reference_model import (
    DEFAULT_PARAMS,
    FaultParams,
    OperatingPoints,
    evaluate,
    first_order_lag,
)

FloatArray = NDArray[np.float64]

GRID_MIN_MS, GRID_MAX_MS, GRID_STEP_MS = 1.0, 28.0, 0.1
MAX_FIT_SAMPLES = 1500
COARSE_STEPS = 17
MIN_FIT_SAMPLES = 36  # 6 h of producing data before a fault is identified
MIN_EXPLAINED = 0.3  # a hypothesis must remove ≥ 30 % of the no-fault cost …
MIN_LR_STAT = 10.83  # … and pass a likelihood-ratio test, χ²₁ at p = 0.001
FIT_MIN_WIND_MS = 4.5  # keep clear of the cut-in edge, where on/off flips are not residuals
TREND_WINDOW = 72  # 12 h
TREND_STEP = 72  # non-overlapping, so window estimates are independent
TREND_MIN_SAMPLES = 18  # 3 h producing inside a window
ICING_MAX_TEMP_C = 1.0
ICING_MIN_RH_PCT = 85.0

_P, _W, _B, _T = 0, 1, 2, 3  # channel indices: power, rotor speed, pitch, temp


@dataclass(frozen=True)
class HypothesisFit:
    kind: FaultKind
    severity: float  # library units
    cost: float
    explained: float  # 1 − J/J₀
    posterior: float


@dataclass(frozen=True)
class Diagnosis:
    turbine_id: int
    kind: FaultKind | None  # None = detected but unexplained
    severity: float | None
    posterior: float
    explained: float
    lr_statistic: float  # J₀ − J_best
    cause_hint: str
    hypotheses: list[HypothesisFit]
    window_start_idx: int
    window_end_idx: int
    samples_used: int
    mean_ambient_c: float
    mean_humidity_pct: float


@dataclass
class _TurbineContext:
    """Everything the residual predictor needs for one turbine."""

    wind: FloatArray  # measured wind, full series
    operating: NDArray[np.bool_]  # twin operating, full series
    sel: NDArray[np.intp]  # samples used for the fit
    r_obs: FloatArray  # (len(sel) × C) bias-corrected residual, NaN where invalid
    sigma: FloatArray  # (len(sel) × C) Phase I scatter
    weight: FloatArray  # (C,) 1/κ
    grid: FloatArray
    kernel: FloatArray  # (grid × grid) p(v_true | v_meas) on the grid
    rho: float
    twin_mean: FloatArray  # (grid × 4) E[y_twin] for P, ω, β, loss
    twin_var: FloatArray  # (grid × 3) Var[y_twin] for P, ω, β


def _wind_kernel(grid: FloatArray, cal: Calibration) -> FloatArray:
    """Row-normalised Gaussian kernel: true wind given measured wind (σ_v from Phase I)."""
    a, b = cal.wind_sigma_coef
    sd = np.maximum(a + b * grid, 0.05)[:, None]
    k = np.exp(-0.5 * ((grid[None, :] - grid[:, None]) / sd) ** 2)
    return np.asarray(k / k.sum(axis=1, keepdims=True), dtype=np.float64)


def _moments(ctx_kernel: FloatArray, op: OperatingPoints) -> tuple[FloatArray, FloatArray]:
    ys = np.stack([op.power_mw, op.rotor_speed_rpm, op.pitch_deg, op.generator_loss_kw], axis=-1)
    mean = ctx_kernel @ ys
    var = np.maximum(ctx_kernel @ ys[:, :3] ** 2 - mean[:, :3] ** 2, 0.0)
    return mean, var


def _context(
    tid: int,
    sel: NDArray[np.intp],
    data: PlantData,
    view: TwinView,
    det: Detection,
    cal: Calibration,
) -> _TurbineContext:
    grid = np.arange(GRID_MIN_MS, GRID_MAX_MS + GRID_STEP_MS / 2, GRID_STEP_MS)
    rho = float(np.median(data.air_density[sel]))
    kernel = _wind_kernel(grid, cal)
    twin_mean, twin_var = _moments(kernel, evaluate(grid, rho))
    sigma = det.sigma[sel, tid, :]
    return _TurbineContext(
        wind=data.wind_ms[:, tid],
        operating=view.twin.operating[:, tid],
        sel=sel,
        r_obs=det.z[sel, tid, :] * sigma,
        sigma=sigma,
        weight=1.0 / cal.acf_factor,
        grid=grid,
        kernel=kernel,
        rho=rho,
        twin_mean=twin_mean,
        twin_var=twin_var,
    )


def _predicted_residuals(
    ctx: _TurbineContext, kind: FaultKind, severity: float
) -> tuple[FloatArray, FloatArray]:
    """Residuals the hypothesis predicts and their σ (both len(sel) × C, channel units)."""
    value = severity_to_fault_value(kind, severity)
    grid = ctx.grid
    if kind == "anemometer_gain":
        op = evaluate(grid / value, ctx.rho)  # the turbine responds to the true wind
    else:
        fp = FaultParams()
        if kind == "aero_efficiency":
            fp.aero_factor = value
        elif kind == "pitch_offset":
            fp.pitch_offset_deg = value
        elif kind == "power_limit":
            fp.power_limit_mw = value
        else:
            fp.generator_loss_factor = value
        op = evaluate(grid, ctx.rho, fp)
    mean, var = _moments(ctx.kernel, op)
    d_mean = mean - ctx.twin_mean
    d_var = var - ctx.twin_var

    v_sel = ctx.wind[ctx.sel]
    out = np.zeros((ctx.sel.size, len(CHANNEL_KEYS)))
    for c in (_P, _W, _B):
        out[:, c] = np.interp(v_sel, grid, d_mean[:, c])
    d_loss = np.where(ctx.operating, np.interp(ctx.wind, grid, d_mean[:, _T]), 0.0)
    d_temp = DEFAULT_PARAMS.generator_thermal_resistance_k_per_kw * first_order_lag(
        d_loss, SAMPLE_PERIOD_S, DEFAULT_PARAMS.generator_thermal_time_constant_s
    )
    out[:, _T] = d_temp[ctx.sel]
    out[:, ANEMOMETER] = 100.0 * (value - 1.0) if kind == "anemometer_gain" else 0.0

    sig = ctx.sigma.copy()
    extra = np.stack([np.interp(v_sel, grid, d_var[:, c]) for c in (_P, _W, _B)], axis=-1)
    sig[:, :3] = np.sqrt(np.maximum(sig[:, :3] ** 2 + extra, 0.25 * sig[:, :3] ** 2))
    return out, sig


def _cost(ctx: _TurbineContext, kind: FaultKind, severity: float) -> float:
    pred, sig = _predicted_residuals(ctx, kind, severity)
    terms = (ctx.r_obs - pred) ** 2 / sig**2 + np.log(sig**2 / ctx.sigma**2)
    terms = np.nan_to_num(terms)  # invalid samples contribute 0
    return float(np.sum(ctx.weight * np.sum(terms, axis=0)))


def _null_cost(ctx: _TurbineContext) -> float:
    """Cost of the no-fault hypothesis (predicted residual ≡ 0)."""
    z = np.nan_to_num(ctx.r_obs / ctx.sigma)
    return float(np.sum(ctx.weight * np.sum(z**2, axis=0)))


def _fit(ctx: _TurbineContext, kind: FaultKind) -> tuple[float, float]:
    mode = FAULT_LIBRARY[kind]
    grid = np.linspace(mode.search_min, mode.search_max, COARSE_STEPS)
    costs = np.array([_cost(ctx, kind, float(s)) for s in grid])
    i = int(np.argmin(costs))
    lo = float(grid[max(i - 1, 0)])
    hi = float(grid[min(i + 1, len(grid) - 1)])
    res = minimize_scalar(
        lambda s: _cost(ctx, kind, float(s)),
        bounds=(lo, hi),
        method="bounded",
        options={"xatol": 2e-3 * (mode.search_max - mode.search_min)},
    )
    if float(res.fun) < float(costs[i]):
        return float(res.x), float(res.fun)
    return float(grid[i]), float(costs[i])


@dataclass(frozen=True)
class SeverityPoint:
    centre_idx: int
    severity: float
    std_error: float
    samples: int


def severity_trend(
    tid: int,
    kind: FaultKind,
    severity: float,
    start: int,
    end: int,
    data: PlantData,
    view: TwinView,
    det: Detection,
    cal: Calibration,
) -> list[SeverityPoint]:
    """Windowed severity estimates (consecutive 12 h windows) for a diagnosed fault.

    One Gauss–Newton step from the episode estimate θ*: the prediction is
    linearised, r(θ) ≈ r(θ*) + (θ − θ*)·∂r/∂θ, so each window has a closed-form
    weighted least-squares estimate and standard error
    (θ̂ − θ* = Σ w·g·(r_obs − r*) / Σ w·g²,  SE = 1/√Σ w·g²).
    """
    usable = view.valid[:, tid, :4].all(axis=1) & (data.wind_ms[:, tid] >= FIT_MIN_WIND_MS)
    usable[:start] = False
    usable[end + 1 :] = False
    sel = np.flatnonzero(usable)
    if sel.size < MIN_FIT_SAMPLES:
        return []
    ctx = _context(tid, sel, data, view, det, cal)
    mode = FAULT_LIBRARY[kind]
    step = 0.01 * (mode.search_max - mode.search_min)
    r0, sig = _predicted_residuals(ctx, kind, severity)
    r1, _ = _predicted_residuals(ctx, kind, severity + step)
    grad = (r1 - r0) / step
    w = ctx.weight / sig**2
    resid = ctx.r_obs - r0
    ok = np.isfinite(resid)
    num_all = np.where(ok, w * grad * np.nan_to_num(resid), 0.0).sum(axis=1)
    den_all = np.where(ok, w * grad**2, 0.0).sum(axis=1)

    points: list[SeverityPoint] = []
    for w_start in range(start, end + 1, TREND_STEP):
        in_w = (sel >= w_start) & (sel < w_start + TREND_WINDOW)
        n = int(in_w.sum())
        den = float(den_all[in_w].sum())
        if n < TREND_MIN_SAMPLES or den <= 0.0:
            continue
        est = severity + float(num_all[in_w].sum()) / den
        points.append(
            SeverityPoint(
                centre_idx=min(w_start + TREND_WINDOW // 2, end),
                severity=round(float(np.clip(est, mode.search_min, mode.search_max)), 4),
                std_error=round(1.0 / float(np.sqrt(den)), 4),
                samples=n,
            )
        )
    return points


def _subsample(idx: NDArray[np.intp], n_max: int) -> NDArray[np.intp]:
    if idx.size <= n_max:
        return idx
    pick = np.linspace(0, idx.size - 1, n_max).round().astype(np.intp)
    return idx[pick]


def diagnose_turbine(
    tid: int,
    events: list[Event],
    data: PlantData,
    view: TwinView,
    det: Detection,
    cal: Calibration,
) -> Diagnosis:
    """Isolate and identify the fault behind a turbine's detection events."""
    t_len = data.wind_ms.shape[0]
    in_event = np.zeros(t_len, dtype=bool)
    for ev in events:
        in_event[ev.onset_idx : (ev.end_idx if ev.end_idx is not None else t_len - 1) + 1] = True
    usable = (
        in_event & view.valid[:, tid, :4].all(axis=1) & (data.wind_ms[:, tid] >= FIT_MIN_WIND_MS)
    )
    sel = _subsample(np.flatnonzero(usable), MAX_FIT_SAMPLES)
    start = int(min(ev.onset_idx for ev in events))
    end = int(max(ev.end_idx if ev.end_idx is not None else t_len - 1 for ev in events))
    t_mean = float(np.mean(data.ambient_temp_c[start : end + 1]))
    rh_mean = float(np.mean(data.humidity_pct[start : end + 1]))

    if sel.size < MIN_FIT_SAMPLES:
        return Diagnosis(
            tid, None, None, 0.0, 0.0, 0.0,
            f"Only {sel.size} producing samples in the event (< {MIN_FIT_SAMPLES} = 6 h): "
            "detected, not yet identifiable — possibly a transient or a false alarm.",
            [], start, end, int(sel.size), t_mean, rh_mean,
        )  # fmt: skip

    ctx = _context(tid, sel, data, view, det, cal)
    null_cost = _null_cost(ctx)
    fits: list[tuple[FaultKind, float, float]] = [(k, *_fit(ctx, k)) for k in FAULT_KINDS]

    costs = np.array([c for _, _, c in fits])
    weights = np.exp(-(costs - costs.min()) / 2.0)
    posterior = weights / weights.sum()
    hypotheses = sorted(
        (
            HypothesisFit(
                kind=k,
                severity=round(s, 3),
                cost=round(c, 2),
                explained=round(max(0.0, 1.0 - c / null_cost), 4) if null_cost > 0 else 0.0,
                posterior=round(float(p), 4),
            )
            for (k, s, c), p in zip(fits, posterior, strict=True)
        ),
        key=lambda h: h.cost,
    )
    best = hypotheses[0]
    lr = null_cost - best.cost
    accepted = best.explained >= MIN_EXPLAINED and lr >= MIN_LR_STAT
    kind = best.kind if accepted else None
    return Diagnosis(
        turbine_id=tid,
        kind=kind,
        severity=best.severity if accepted else None,
        posterior=best.posterior,
        explained=best.explained,
        lr_statistic=round(lr, 2),
        cause_hint=_cause_hint(kind, best.severity, t_mean, rh_mean),
        hypotheses=hypotheses,
        window_start_idx=start,
        window_end_idx=end,
        samples_used=int(sel.size),
        mean_ambient_c=round(t_mean, 2),
        mean_humidity_pct=round(rh_mean, 1),
    )


def _cause_hint(kind: FaultKind | None, severity: float, t_mean: float, rh_mean: float) -> str:
    if kind is None:
        return (
            "Deviation detected but no modelled fault explains it — possible false alarm "
            "or an unmodelled fault; review the raw channels."
        )
    if kind == "aero_efficiency":
        if t_mean <= ICING_MAX_TEMP_C and rh_mean >= ICING_MIN_RH_PCT:
            return (
                f"Rotor icing likely: mean ambient {t_mean:.1f} °C at {rh_mean:.0f} % RH "
                "during the event."
            )
        return (
            f"Ambient {t_mean:.1f} °C rules icing out — blade soiling or leading-edge "
            "erosion more likely."
        )
    if kind == "pitch_offset":
        side = "feather" if severity > 0 else "stall"
        return f"Blades sit {abs(severity):.1f}° towards {side} relative to the reported angle."
    if kind == "power_limit":
        return f"Output capped at {severity:.1f} MW without a park set-point."
    if kind == "generator_loss":
        nominal_pct = (1.0 - DEFAULT_PARAMS.generator_efficiency) * 100.0
        return (
            f"Generator losses ≈ {severity:.2f}× nominal ({severity * nominal_pct:.1f} % of shaft "
            "power instead of "
            f"{nominal_pct:.2f} %)."
        )
    return f"Anemometer reads {severity:+.1f} % against its neighbours."
