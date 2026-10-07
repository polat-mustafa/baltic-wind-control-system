"""State detection and health assessment (ISO 13374-1 blocks DM, SD, HA).

Data manipulation (DM)
──────────────────────
The twin is evaluated at the *measured* wind and air density; five residual
channels are formed, each mapped to its IEC 61400-25-2 logical node:

  power         P_meas − P_twin                       [MW]   WTUR
  rotor_speed   ω_meas − ω_twin                       [rpm]  WROT
  pitch         β_meas − β_twin                       [deg]  WROT
  gearbox_temp  T_meas − T_twin (thermal NBM)         [K]    WTRM
  anemometer    v_meas / median(v_meas of others) − 1 [%]    WMET

Samples where the turbine (or the twin) is not producing are excluded — the
validity flag of IEC 61400-25 data.

Phase I calibration (Montgomery, *Introduction to Statistical Quality
Control*: a control chart is set up on in-control data first)
─────────────────────────────────────────────────────────────────────────
A separate fault-free 30-day run of the plant gives, per channel and per
0.5 m/s bin of measured wind (the IEC 61400-12-1 bin width), the residual
mean μ and standard deviation σ (floored at the sensor resolution). Residual scatter is strongly
heteroscedastic — large where the power curve is steep, tiny at rated — so a
single σ would be either blind at rated or noisy at partial load.

State detection (SD): EWMA control chart, exact limits
──────────────────────────────────────────────────────
  z_k = (r_k − μ(v_k)) / σ(v_k)
  e_k = λ·z_k + (1 − λ)·e_{k−1},  e_0 = 0
  UCL_k = L·√(λ/(2 − λ)·[1 − (1 − λ)^{2k}])
(Lucas & Saccucci 1990, Technometrics 32(1); Montgomery, EWMA chapter). The
time-varying limit is the exact variance of e_k, so the cold start neither
hides nor invents a deviation.

10-min residuals are autocorrelated (thermal lag, turbulence persistence),
which would make the iid limits fire constantly. Following the EWMAST chart
(Zhang 1998, Technometrics 40(1)) the limit is widened by the variance
factor of an EWMA of a stationary process,

  κ = 1 + 2·Σ_{k≥1} (1 − λ)^k·ρ_k,

with the autocorrelation ρ_k of each channel measured on the Phase I data.
An event needs ``PERSISTENCE`` consecutive valid samples beyond the limit
(1 h) and clears after as many inside it.

Health assessment (HA)
──────────────────────
u = |e| / UCL is the normalised deviation. The health index maps it onto
zones in the spirit of the ISO 20816/10816 A–D evaluation zones:

  u ≤ 1  normal  HI 100 → 70    1 < u ≤ 2  alert  HI 70 → 40
  u > 2  alarm   HI 40 → 0 (0 at u = 4)

Turbine HI = minimum over channels (weakest link) — an average would let a
healthy power channel hide a gearbox in alarm.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from app.services.digital_twin.plant_simulator import (
    NUM_TURBINES,
    SAMPLE_PERIOD_S,
    SCENARIOS,
    PlantData,
    simulate_plant,
)
from app.services.digital_twin.reference_model import (
    DEFAULT_PARAMS,
    OperatingPoints,
    evaluate,
    gearbox_temperature,
)

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]

ChannelKey = Literal["power", "rotor_speed", "pitch", "gearbox_temp", "anemometer"]
Level = Literal["alert", "alarm"]


@dataclass(frozen=True)
class ChannelSpec:
    key: ChannelKey
    label: str
    unit: str
    logical_node: str  # IEC 61400-25-2
    sigma_floor: float  # sensor resolution — σ never drops below this


CHANNELS: tuple[ChannelSpec, ...] = (
    ChannelSpec("power", "Active power", "MW", "WTUR", 0.03),
    ChannelSpec("rotor_speed", "Rotor speed", "rpm", "WROT", 0.02),
    ChannelSpec("pitch", "Pitch angle", "deg", "WROT", 0.05),
    ChannelSpec("gearbox_temp", "Gearbox bearing temperature", "°C", "WTRM", 0.4),
    ChannelSpec("anemometer", "Nacelle wind vs. neighbours", "%", "WMET", 0.5),
)
ANEMOMETER = 4  # index of the relative channel
CHANNEL_KEYS: tuple[ChannelKey, ...] = tuple(c.key for c in CHANNELS)
N_CHANNELS = len(CHANNELS)

# Detector settings. 34 turbines × 5 channels = 170 charts run in parallel, so
# L is set for the *fleet*: textbook L ≈ 3 would raise several false events a
# day. L = 5 keeps the measured fleet-wide rate on independent fault-free data
# at about one per week (reported in the model card as verification).
EWMA_LAMBDA: float = 0.05
EWMA_L: float = 5.0
PERSISTENCE: int = 6  # 6 × 10 min = 1 h
ALARM_U: float = 2.0
HI_NORMAL: float = 70.0
HI_ALARM: float = 40.0

# Phase I
CALIBRATION_SEED: int = 20_250_113
CALIBRATION_DAYS: int = 30
WIND_BIN_EDGES: FloatArray = np.arange(0.0, 26.5, 0.5)  # IEC 61400-12-1 bin width
MIN_BIN_COUNT: int = 200
ANEMOMETER_MIN_WIND_MS: float = 4.0


# ── Twin expectation (DM) ────────────────────────────────────────


@dataclass(frozen=True)
class TwinView:
    """Measured vs. expected for every channel (arrays T × N × C)."""

    measured: FloatArray
    expected: FloatArray
    valid: BoolArray
    twin: OperatingPoints  # nominal twin at measured wind
    wind_ref_ms: FloatArray  # neighbour reference wind (T × N)


def _neighbour_reference(wind: FloatArray) -> FloatArray:
    """Leave-one-out median of the measured wind of all other turbines."""
    n = wind.shape[1]
    if n == 1:  # a lone turbine has no neighbours: its anemometer cannot be cross-checked
        return wind.copy()
    ref = np.empty_like(wind)
    for i in range(n):
        ref[:, i] = np.median(np.delete(wind, i, axis=1), axis=1)
    return ref


def twin_view(data: PlantData) -> TwinView:
    rho = data.air_density[:, None]
    twin = evaluate(data.wind_ms, rho)
    t_amb = np.broadcast_to(data.ambient_temp_c[:, None], data.wind_ms.shape)
    twin_temp = gearbox_temperature(twin.gearbox_loss_kw, t_amb, SAMPLE_PERIOD_S)
    wind_ref = _neighbour_reference(data.wind_ms)

    measured = np.stack(
        [data.power_mw, data.rotor_speed_rpm, data.pitch_deg, data.gearbox_temp_c, data.wind_ms],
        axis=-1,
    )
    expected = np.stack(
        [twin.power_mw, twin.rotor_speed_rpm, twin.pitch_deg, twin_temp, wind_ref], axis=-1
    )
    producing = data.operating & twin.operating
    valid = np.stack(
        [producing, producing, producing, producing, wind_ref >= ANEMOMETER_MIN_WIND_MS],
        axis=-1,
    )
    return TwinView(measured, expected, valid, twin, wind_ref)


def residuals(view: TwinView) -> FloatArray:
    """Channel residuals; the anemometer one is relative (a gain error is multiplicative)."""
    r = view.measured - view.expected
    ref = np.maximum(view.expected[..., ANEMOMETER], ANEMOMETER_MIN_WIND_MS)
    r[..., ANEMOMETER] = 100.0 * r[..., ANEMOMETER] / ref
    return r


# ── Phase I calibration ───────────────────────────────────────────


@dataclass(frozen=True)
class Calibration:
    """Per-channel, per-wind-bin residual mean and σ from fault-free data."""

    bin_edges: FloatArray
    mean: FloatArray  # (bins × C)
    sigma: FloatArray  # (bins × C)
    acf_factor: FloatArray  # (C,) EWMAST variance factor κ
    lag1_autocorr: FloatArray  # (C,)
    rmse: FloatArray  # (C,) twin fidelity on fault-free data
    bias: FloatArray  # (C,)
    samples: NDArray[np.int64]  # (C,)
    wind_sigma_coef: tuple[float, float]  # effective wind uncertainty σ_v = a + b·v [m/s]
    false_events: int  # events raised on the calibration set itself
    turbine_days: int


def wind_bin(wind: FloatArray, edges: FloatArray = WIND_BIN_EDGES) -> NDArray[np.intp]:
    return np.clip(np.digitize(wind, edges) - 1, 0, len(edges) - 1)


def standardise(
    residual: FloatArray, wind: FloatArray, cal: Calibration
) -> tuple[FloatArray, FloatArray]:
    """z-scores and per-sample σ for residuals (T × N × C) at wind (T × N)."""
    return _standardise(residual, wind, cal.bin_edges, cal.mean, cal.sigma)


def _standardise(
    residual: FloatArray, wind: FloatArray, edges: FloatArray, mean: FloatArray, sigma: FloatArray
) -> tuple[FloatArray, FloatArray]:
    b = wind_bin(wind, edges)
    return (residual - mean[b]) / sigma[b], sigma[b]


@lru_cache(maxsize=1)
def phase_one_calibration() -> Calibration:
    data = simulate_plant(SCENARIOS["healthy"], CALIBRATION_DAYS, CALIBRATION_SEED)
    view = twin_view(data)
    resid = residuals(view)
    bins = wind_bin(data.wind_ms)
    nb = len(WIND_BIN_EDGES)
    mean = np.zeros((nb, N_CHANNELS))
    sigma = np.zeros((nb, N_CHANNELS))
    rmse = np.zeros(N_CHANNELS)
    bias = np.zeros(N_CHANNELS)
    samples = np.zeros(N_CHANNELS, dtype=np.int64)
    for c, spec in enumerate(CHANNELS):
        ok = view.valid[..., c]
        r_all = resid[..., c][ok]
        samples[c] = r_all.size
        rmse[c] = float(np.sqrt(np.mean(r_all**2)))
        bias[c] = float(np.mean(r_all))
        filled = np.zeros(nb, dtype=bool)
        for k in range(nb):
            r = resid[..., c][ok & (bins == k)]
            if r.size >= MIN_BIN_COUNT:
                mean[k, c], sigma[k, c], filled[k] = float(np.mean(r)), float(np.std(r)), True
        # Sparse bins (storm winds) borrow from the nearest populated bin; where
        # both sides exist the larger σ is taken (conservative).
        have = np.flatnonzero(filled)
        for gap in np.flatnonzero(~filled):
            left, right = have[have < gap], have[have > gap]
            cand = [int(x[0]) for x in (left[-1:], right[:1]) if x.size]
            src = max(cand, key=lambda j: float(sigma[j, c]))
            mean[gap, c], sigma[gap, c] = 0.0, sigma[src, c]
        sigma[:, c] = np.maximum(sigma[:, c], spec.sigma_floor)

    z_cal, _ = _standardise(resid, data.wind_ms, WIND_BIN_EDGES, mean, sigma)
    rho_k = np.stack([_pooled_acf(z_cal[..., c], view.valid[..., c]) for c in range(N_CHANNELS)])
    a = 1.0 - EWMA_LAMBDA
    lags = np.arange(1, rho_k.shape[1] + 1)
    acf_factor = np.maximum(1.0 + 2.0 * np.sum(a**lags * rho_k, axis=1), 1.0)

    cal = Calibration(
        bin_edges=WIND_BIN_EDGES,
        mean=mean,
        sigma=sigma,
        acf_factor=acf_factor,
        lag1_autocorr=rho_k[:, 0],
        rmse=rmse,
        bias=bias,
        samples=samples,
        wind_sigma_coef=_wind_uncertainty(mean, sigma),
        false_events=0,
        turbine_days=CALIBRATION_DAYS * NUM_TURBINES,
    )
    det = detect(view, data.wind_ms, cal)
    return Calibration(**{**cal.__dict__, "false_events": len(det.events)})


def _wind_uncertainty(mean: FloatArray, sigma: FloatArray) -> tuple[float, float]:
    """Effective wind-measurement uncertainty σ_v(v) = a + b·v, inverted from Phase I.

    In partial load the power residual scatter is the wind error propagated
    through the slope of the power curve (JCGM 100:2008 §5.1):
    σ_P² ≈ (dP/dv)²·σ_v² + σ_n². Solving for σ_v in the 5–10 m/s bins and fitting
    a line gives the input uncertainty the diagnosis needs to propagate through
    each fault hypothesis — learned from data, not assumed.
    """
    del mean
    centres = WIND_BIN_EDGES + 0.25
    slope = np.gradient(evaluate(centres).power_mw, centres)
    pick = (centres >= 5.0) & (centres <= 10.0) & (slope > 0.3)
    noise = CHANNELS[0].sigma_floor
    sv = np.sqrt(np.maximum(sigma[pick, 0] ** 2 - noise**2, 0.0)) / slope[pick]
    b, a = np.polyfit(centres[pick], sv, 1)
    return round(float(a), 4), round(float(b), 4)


def _pooled_acf(z: FloatArray, valid: BoolArray, max_lag: int = 144) -> FloatArray:
    """Autocorrelation ρ_1..ρ_max of z (T × N), pooled over turbines, valid pairs only."""
    zc = np.where(valid, z, 0.0)
    var = float(np.sum(zc**2) / max(int(np.sum(valid)), 1))
    out = np.zeros(max_lag)
    for k in range(1, max_lag + 1):
        pair = valid[k:] & valid[:-k]
        if pair.any():
            out[k - 1] = float(np.sum((zc[k:] * zc[:-k])[pair]) / pair.sum() / var)
    return out


# ── EWMA chart and events (SD) ────────────────────────────────────


@dataclass(frozen=True)
class Event:
    turbine_id: int
    channel: ChannelKey
    onset_idx: int  # first sample beyond the limit
    confirmed_idx: int  # sample at which persistence was satisfied
    end_idx: int | None  # last sample beyond the limit (None = still active)
    level: Level
    peak_u: float
    direction: Literal["high", "low"]


@dataclass(frozen=True)
class Detection:
    z: FloatArray  # T × N × C (NaN where invalid)
    sigma: FloatArray  # T × N × C
    ewma: FloatArray  # T × N × C
    ucl: FloatArray  # T × N × C
    u: FloatArray  # T × N × C
    health: FloatArray  # T × N × C
    health_turbine: FloatArray  # T × N
    events: list[Event]


def ewma_limit(
    n_valid: FloatArray, lam: float | None = None, width: float | None = None
) -> FloatArray:
    """Exact EWMA control limit after ``n_valid`` observations (iid shape)."""
    lam = EWMA_LAMBDA if lam is None else lam
    width = EWMA_L if width is None else width
    var = lam / (2.0 - lam) * (1.0 - (1.0 - lam) ** (2.0 * n_valid))
    return np.asarray(width * np.sqrt(var), dtype=np.float64)


def health_from_u(u: FloatArray) -> FloatArray:
    """Zone mapping of the normalised deviation to a 0–100 health index."""
    return np.asarray(
        np.where(
            u <= 1.0,
            100.0 - (100.0 - HI_NORMAL) * u,
            np.where(
                u <= ALARM_U,
                HI_NORMAL - (HI_NORMAL - HI_ALARM) * (u - 1.0),
                np.maximum(0.0, HI_ALARM - HI_ALARM / 2.0 * (u - ALARM_U)),
            ),
        ),
        dtype=np.float64,
    )


def _extract_events(
    u: FloatArray, e: FloatArray, valid: BoolArray, tid: int, ch: int
) -> list[Event]:
    events: list[Event] = []
    idx = np.flatnonzero(valid)
    if idx.size == 0:
        return events
    above = u[idx] >= 1.0
    in_event = False
    run_in = run_out = 0
    onset = confirmed = last_above = 0
    peak = 0.0
    sign = 1.0
    for j, k in enumerate(idx):
        if not in_event:
            if above[j]:
                if run_in == 0:
                    onset = int(k)
                run_in += 1
                if run_in >= PERSISTENCE:
                    in_event, confirmed, last_above, run_out = True, int(k), int(k), 0
                    peak, sign = float(u[k]), float(np.sign(e[k]))
            else:
                run_in = 0
        else:
            if above[j]:
                run_out, last_above = 0, int(k)
                if u[k] > peak:
                    peak, sign = float(u[k]), float(np.sign(e[k]))
            else:
                run_out += 1
                if run_out >= PERSISTENCE:
                    events.append(_event(tid, ch, onset, confirmed, last_above, peak, sign))
                    in_event, run_in = False, 0
    if in_event:
        events.append(_event(tid, ch, onset, confirmed, None, peak, sign))
    return events


def _event(
    tid: int, ch: int, onset: int, confirmed: int, end: int | None, peak: float, sign: float
) -> Event:
    return Event(
        turbine_id=tid,
        channel=CHANNEL_KEYS[ch],
        onset_idx=onset,
        confirmed_idx=confirmed,
        end_idx=end,
        level="alarm" if peak >= ALARM_U else "alert",
        peak_u=round(peak, 3),
        direction="high" if sign >= 0 else "low",
    )


def detect(view: TwinView, wind: FloatArray, cal: Calibration) -> Detection:
    resid = residuals(view)
    z, sigma = standardise(resid, wind, cal)
    z = np.where(view.valid, z, np.nan)
    t_len = z.shape[0]

    ewma = np.zeros_like(z)
    count = np.zeros_like(z)
    e = np.zeros(z.shape[1:])
    n = np.zeros(z.shape[1:])
    lam = EWMA_LAMBDA
    for k in range(t_len):
        ok = view.valid[k]
        e = np.where(ok, lam * np.nan_to_num(z[k]) + (1.0 - lam) * e, e)
        n = n + ok
        ewma[k] = e
        count[k] = n
    ucl = ewma_limit(count) * np.sqrt(cal.acf_factor)
    u = np.where(count > 0, np.abs(ewma) / np.where(ucl > 0, ucl, 1.0), 0.0)
    health = health_from_u(u)
    health_turbine = np.min(health, axis=-1)

    events: list[Event] = []
    for tid in range(z.shape[1]):
        for c in range(N_CHANNELS):
            events.extend(
                _extract_events(u[:, tid, c], ewma[:, tid, c], view.valid[:, tid, c], tid, c)
            )
    events.sort(key=lambda ev: (ev.confirmed_idx, ev.turbine_id))
    return Detection(z, sigma, ewma, ucl, u, health, health_turbine, events)


def detector_settings() -> dict[str, float | int | str]:
    """Settings reported in the model card."""
    return {
        "ewma_lambda": EWMA_LAMBDA,
        "ewma_l": EWMA_L,
        "persistence_samples": PERSISTENCE,
        "persistence_minutes": PERSISTENCE * SAMPLE_PERIOD_S // 60,
        "alarm_u": ALARM_U,
        "hi_normal": HI_NORMAL,
        "hi_alarm": HI_ALARM,
        "steady_state_ucl_iid": round(float(ewma_limit(np.array([math.inf]))[0]), 4),
        "calibration_days": CALIBRATION_DAYS,
        "wind_bin_width_ms": float(WIND_BIN_EDGES[1] - WIND_BIN_EDGES[0]),
        "thermal_time_constant_s": DEFAULT_PARAMS.gearbox_thermal_time_constant_s,
    }


@lru_cache(maxsize=1)
def verification_false_events() -> int:
    """False events on an independent fault-free run (different seed, same length)."""
    data = simulate_plant(SCENARIOS["healthy"], CALIBRATION_DAYS, CALIBRATION_SEED + 1)
    return len(detect(twin_view(data), data.wind_ms, phase_one_calibration()).events)
