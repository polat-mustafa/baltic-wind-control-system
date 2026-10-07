"""Synthetic plant — the "physical twin" that produces SCADA for the study.

Physics Layer
─────────────
A digital twin needs a physical asset to watch. Here the asset is emulated:
the same reference model (``reference_model.evaluate``) is driven by the
*true* rotor-effective wind and by fault parameters that follow a scenario
schedule; the SCADA channels are then measured with realistic sensor errors.
Because the twin later sees only the *measured* wind, healthy residual
scatter arises physically — from anemometer error amplified by the slope of
the power curve — instead of from noise added to power.

Inflow (10-min means, one sample every 600 s)
  Farm wind  Gaussian copula: z = 0.9·sin(2πt/3.5 d + φ₀) + 0.77·AR(1)
             (synoptic cycle + persistence, φ = 0.985 per step, unit variance)
             mapped to the Baltic Weibull marginal a = 10.5 m/s, k = 2.2 (the
             P4 SCADA parameters; an own project uses its site's hub-height
             Weibull) by the probability-integral transform.
  Turbine    v_i = V·(1 + δ_i), δ_i AR(1) with σ = 3 %, φ = 0.9 (local
             turbulence / wake meandering; the mean wake deficit is left out).
  Ambient    winter: T ≈ +3 °C with a ±1 K daily cycle, RH ≈ 82 %, p ≈ 1013 hPa;
             the icing scenario adds a cold spell to −4 °C at RH ≈ 96 %.
             ρ = p / (R_dry·T) (ideal gas; vapour pressure neglected).

Measurement chain (assumptions, stated in the model card)
  Nacelle anemometer  v_meas = g·v + N(0, 0.15 + 0.02·v) m/s
  Active power        + N(0, 0.03) MW         Rotor speed   + N(0, 0.02) rpm
  Pitch angle         + N(0, 0.05) °          Gearbox temp. + N(0, 0.4) K

The whole data set is reproducible from ``seed``. Ground truth (the injected
fault parameter of every turbine at every sample) is returned alongside, so
detection delay and isolation accuracy can be scored — something a real
SCADA archive cannot give.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field, replace

import numpy as np
from numpy.typing import NDArray
from scipy.special import ndtr

from app.services.digital_twin.fault_library import (
    FAULT_KINDS,
    FAULT_LIBRARY,
    FaultKind,
)
from app.services.digital_twin.reference_model import (
    FaultParams,
    evaluate,
    gearbox_temperature,
)
from app.services.p4.turbine_power_curve import R_DRY

FloatArray = NDArray[np.float64]

SAMPLE_PERIOD_S: int = 600
SAMPLES_PER_DAY: int = 86_400 // SAMPLE_PERIOD_S
NUM_TURBINES: int = 34
START_EPOCH_S: int = 1_736_726_400  # 2025-01-13 00:00 UTC — a winter week

# Inflow
WEIBULL_A: float = 10.5
WEIBULL_K: float = 2.2
SYNOPTIC_PERIOD_DAYS: float = 3.5
SYNOPTIC_AMPLITUDE: float = 0.9
FARM_AR_PHI: float = 0.985
TURBINE_SIGMA: float = 0.03
TURBINE_AR_PHI: float = 0.9

# Measurement chain
ANEMOMETER_SIGMA_BASE_MS: float = 0.15
ANEMOMETER_SIGMA_REL: float = 0.02
POWER_SIGMA_MW: float = 0.03
ROTOR_SIGMA_RPM: float = 0.02
PITCH_SIGMA_DEG: float = 0.05
GEARBOX_TEMP_SIGMA_K: float = 0.4

# Ambient (winter, Polish Baltic offshore)
AMBIENT_BASE_C: float = 3.0
AMBIENT_COLD_C: float = -4.0
HUMIDITY_BASE_PCT: float = 82.0
HUMIDITY_COLD_PCT: float = 96.0


# ── Scenarios ─────────────────────────────────────────────────────


@dataclass(frozen=True)
class FaultInjection:
    """One injected fault: which turbines, how strong, and when.

    Times are fractions of the analysis window. Severity ramps linearly from
    nominal at ``onset`` to ``severity`` at ``onset + ramp``; if ``end`` is
    set it returns to nominal over ``release``.
    """

    kind: FaultKind
    turbine_ids: tuple[int, ...]  # 0-based
    severity: tuple[float, ...]  # library units, one per turbine
    onset: float
    ramp: float = 0.0
    end: float | None = None
    release: float = 0.0


@dataclass(frozen=True)
class Scenario:
    name: str
    title: str
    description: str
    injections: tuple[FaultInjection, ...] = ()
    cold_spell: tuple[float, float] | None = None  # window fractions


_ICING = FaultInjection(
    kind="aero_efficiency",
    turbine_ids=(4, 5, 6, 7),
    severity=(20.0, 25.0, 30.0, 35.0),
    onset=0.27,
    ramp=0.08,
    end=0.70,
    release=0.03,
)
_PITCH = FaultInjection(kind="pitch_offset", turbine_ids=(19,), severity=(4.0,), onset=0.30)
_DERATE = FaultInjection(kind="power_limit", turbine_ids=(27,), severity=(12.0,), onset=0.40)
_GEARBOX = FaultInjection(
    kind="gearbox_loss", turbine_ids=(11,), severity=(1.6,), onset=0.15, ramp=0.85
)
_ANEMOMETER = FaultInjection(
    kind="anemometer_gain", turbine_ids=(14,), severity=(8.0,), onset=0.20, ramp=0.40
)

SCENARIOS: dict[str, Scenario] = {
    s.name: s
    for s in (
        Scenario(
            name="healthy",
            title="Healthy fleet",
            description=(
                "No injected faults. Measures the in-control behaviour of the "
                "detector: any event raised here is a false alarm."
            ),
        ),
        Scenario(
            name="rotor_icing",
            title="Rotor icing",
            description=(
                "Cold spell (−4 °C, RH ≈ 96 %) from 25 % to 70 % of the window. Ice "
                "accretes on WTG-05 to WTG-08 and removes 20–35 % of Cp, then sheds after "
                "the thaw. Severities are illustrative."
            ),
            injections=(_ICING,),
            cold_spell=(0.25, 0.70),
        ),
        Scenario(
            name="pitch_misalignment",
            title="Pitch misalignment",
            description=(
                "WTG-20: blades sit 4° further towards feather than the encoder reports "
                "(e.g. a zero-pitch calibration error after a blade-bearing exchange), "
                "from 30 % of the window."
            ),
            injections=(_PITCH,),
        ),
        Scenario(
            name="converter_derating",
            title="Converter derating",
            description=(
                "WTG-28: uncommanded 12 MW active-power limit (e.g. converter cooling "
                "fault) from 40 % of the window."
            ),
            injections=(_DERATE,),
        ),
        Scenario(
            name="gearbox_degradation",
            title="Gearbox degradation",
            description=(
                "WTG-12: gearbox losses rise linearly from nominal (3 % of shaft power) "
                "to 1.6× from 15 % of the window — a progressive fault for prognosis."
            ),
            injections=(_GEARBOX,),
        ),
        Scenario(
            name="anemometer_drift",
            title="Anemometer drift",
            description=(
                "WTG-15: nacelle anemometer gain drifts to +8 % between 20 % and 60 % "
                "of the window. The turbine is healthy; only its wind reading is wrong."
            ),
            injections=(_ANEMOMETER,),
        ),
        Scenario(
            name="combined",
            title="Combined faults",
            description=(
                "All five faults at once, on different turbines, during the cold spell — "
                "tests whether the twin isolates each one correctly."
            ),
            injections=(_ICING, _PITCH, _DERATE, _GEARBOX, _ANEMOMETER),
            cold_spell=(0.25, 0.70),
        ),
    )
}


# Every SB-510 turbine a scenario touches (0-based). A smaller farm gets them
# spread over its own turbines, in this order (icing stays on neighbours).
_FAULTY: tuple[int, ...] = (4, 5, 6, 7, 11, 14, 19, 27)


def _remap(tid: int, n_turbines: int) -> int:
    """SB-510 turbine index → index in a farm of n turbines (unchanged when it fits)."""
    if n_turbines > max(_FAULTY):
        return tid
    return _FAULTY.index(tid) * n_turbines // len(_FAULTY)


def scenario_for(name: str, n_turbines: int = NUM_TURBINES) -> Scenario:
    """A scenario on a farm of n turbines (SB-510: as defined above)."""
    s = SCENARIOS[name]
    if n_turbines > max(_FAULTY):
        return s
    injections = []
    for inj in s.injections:
        pairs: dict[int, float] = {}
        for tid, sev in zip(inj.turbine_ids, inj.severity, strict=True):
            pairs.setdefault(_remap(tid, n_turbines), sev)  # tiny farms: one fault per turbine
        injections.append(replace(inj, turbine_ids=tuple(pairs), severity=tuple(pairs.values())))
    description = re.sub(
        r"WTG-(\d{2})",
        lambda m: f"WTG-{_remap(int(m[1]) - 1, n_turbines) + 1:02d}",
        s.description,
    )
    return replace(s, injections=tuple(injections), description=description)


# ── Data containers ───────────────────────────────────────────────


@dataclass(frozen=True)
class PlantData:
    """Measured SCADA channels (shape T × N) plus ambient and ground truth."""

    timestamps: NDArray[np.int64]
    wind_ms: FloatArray  # nacelle anemometer
    power_mw: FloatArray
    rotor_speed_rpm: FloatArray
    pitch_deg: FloatArray
    gearbox_temp_c: FloatArray
    operating: NDArray[np.bool_]
    ambient_temp_c: FloatArray  # (T,)
    humidity_pct: FloatArray  # (T,)
    pressure_pa: FloatArray  # (T,)
    air_density: FloatArray  # (T,) from measured T and p
    true_wind_ms: FloatArray  # (T × N) — simulation only
    ground_truth: dict[FaultKind, FloatArray] = field(default_factory=dict)


# ── Generators ────────────────────────────────────────────────────


def _ar1(rng: np.random.Generator, phi: float, shape: tuple[int, ...]) -> FloatArray:
    """Stationary unit-variance AR(1) along axis 0."""
    e = rng.standard_normal(shape)
    out = np.empty(shape, dtype=np.float64)
    out[0] = e[0]
    s = math.sqrt(1.0 - phi * phi)
    for k in range(1, shape[0]):
        out[k] = phi * out[k - 1] + s * e[k]
    return out


def _farm_wind(rng: np.random.Generator, n_steps: int, weibull: tuple[float, float]) -> FloatArray:
    t_days = np.arange(n_steps) / SAMPLES_PER_DAY
    phase = rng.uniform(0.0, 2.0 * math.pi)
    b = math.sqrt(1.0 - SYNOPTIC_AMPLITUDE**2 / 2.0)
    z = SYNOPTIC_AMPLITUDE * np.sin(
        2.0 * math.pi * t_days / SYNOPTIC_PERIOD_DAYS + phase
    ) + b * _ar1(rng, FARM_AR_PHI, (n_steps,))
    u = np.clip(ndtr(z), 1e-9, 1.0 - 1e-9)
    a, k = weibull
    return np.asarray(a * (-np.log1p(-u)) ** (1.0 / k), dtype=np.float64)


def _smooth_step(x: FloatArray, edge: float, width: float) -> FloatArray:
    return np.asarray(0.5 * (1.0 + np.tanh((x - edge) / width)), dtype=np.float64)


def _ambient(
    rng: np.random.Generator, n_steps: int, cold_spell: tuple[float, float] | None
) -> tuple[FloatArray, FloatArray, FloatArray]:
    frac = np.arange(n_steps) / max(n_steps - 1, 1)
    t_days = np.arange(n_steps) / SAMPLES_PER_DAY
    cold = np.zeros(n_steps)
    if cold_spell is not None:
        width = 12.0 / max(n_steps, 1)  # ≈ 2 h transitions
        cold = _smooth_step(frac, cold_spell[0], width) * (
            1.0 - _smooth_step(frac, cold_spell[1], width)
        )
    diurnal = np.sin(2.0 * math.pi * (t_days - 0.375))  # minimum near 03 h
    temp = (
        AMBIENT_BASE_C
        + (AMBIENT_COLD_C - AMBIENT_BASE_C) * cold
        + 1.0 * diurnal
        + 0.3 * _ar1(rng, 0.95, (n_steps,))
    )
    rh = np.clip(
        HUMIDITY_BASE_PCT
        + (HUMIDITY_COLD_PCT - HUMIDITY_BASE_PCT) * cold
        + 2.0 * _ar1(rng, 0.95, (n_steps,)),
        40.0,
        100.0,
    )
    pressure = 101_300.0 + 600.0 * np.sin(2.0 * math.pi * t_days / SYNOPTIC_PERIOD_DAYS)
    return temp, rh, pressure


def _schedule(inj: FaultInjection, frac: FloatArray, value: float, nominal: float) -> FloatArray:
    """Severity time series for one turbine (library units)."""
    if inj.ramp > 0:
        level = np.clip((frac - inj.onset) / inj.ramp, 0.0, 1.0)
    else:
        level = (frac >= inj.onset).astype(np.float64)
    if inj.end is not None:
        if inj.release > 0:
            level = level * np.clip(1.0 - (frac - inj.end) / inj.release, 0.0, 1.0)
        else:
            level = level * (frac < inj.end)
    return nominal + (value - nominal) * level


def ground_truth(
    scenario: Scenario, n_steps: int, n_turbines: int = NUM_TURBINES
) -> dict[FaultKind, FloatArray]:
    """Injected fault parameter of every turbine at every sample (library units)."""
    frac = np.arange(n_steps) / max(n_steps - 1, 1)
    truth: dict[FaultKind, FloatArray] = {
        k: np.full((n_steps, n_turbines), FAULT_LIBRARY[k].nominal) for k in FAULT_KINDS
    }
    for inj in scenario.injections:
        nominal = FAULT_LIBRARY[inj.kind].nominal
        for tid, sev in zip(inj.turbine_ids, inj.severity, strict=True):
            truth[inj.kind][:, tid] = _schedule(inj, frac, sev, nominal)
    return truth


def simulate_plant(
    scenario: Scenario,
    duration_days: int,
    seed: int,
    n_turbines: int = NUM_TURBINES,
    weibull: tuple[float, float] = (WEIBULL_A, WEIBULL_K),
) -> PlantData:
    """Generate the measured SCADA set for one scenario (scenario_for(name, n_turbines))."""
    n = int(duration_days * SAMPLES_PER_DAY)
    rng = np.random.default_rng(seed)

    farm = _farm_wind(rng, n, weibull)
    delta = TURBINE_SIGMA * _ar1(rng, TURBINE_AR_PHI, (n, n_turbines))
    v_true = np.maximum(farm[:, None] * (1.0 + delta), 0.0)

    temp, rh, pressure = _ambient(rng, n, scenario.cold_spell)
    rho = pressure / (R_DRY * (temp + 273.15))

    truth = ground_truth(scenario, n, n_turbines)
    faults = FaultParams(
        aero_factor=1.0 - truth["aero_efficiency"] / 100.0,
        pitch_offset_deg=truth["pitch_offset"],
        power_limit_mw=truth["power_limit"],
        gearbox_loss_factor=truth["gearbox_loss"],
    )
    op = evaluate(v_true, rho[:, None], faults)

    gain = 1.0 + truth["anemometer_gain"] / 100.0
    sigma_a = ANEMOMETER_SIGMA_BASE_MS + ANEMOMETER_SIGMA_REL * v_true
    v_meas = np.maximum(gain * v_true + sigma_a * rng.standard_normal(v_true.shape), 0.0)

    shape = v_true.shape
    on = op.operating
    power = np.where(on, op.power_mw + POWER_SIGMA_MW * rng.standard_normal(shape), 0.0)
    rotor = np.where(on, op.rotor_speed_rpm + ROTOR_SIGMA_RPM * rng.standard_normal(shape), 0.0)
    pitch = op.pitch_deg + np.where(on, PITCH_SIGMA_DEG * rng.standard_normal(shape), 0.0)
    gb_temp = gearbox_temperature(
        op.gearbox_loss_kw, np.broadcast_to(temp[:, None], shape), SAMPLE_PERIOD_S
    ) + GEARBOX_TEMP_SIGMA_K * rng.standard_normal(shape)

    timestamps = START_EPOCH_S + SAMPLE_PERIOD_S * np.arange(n, dtype=np.int64)
    return PlantData(
        timestamps=timestamps,
        wind_ms=v_meas,
        power_mw=np.clip(power, 0.0, None),
        rotor_speed_rpm=np.clip(rotor, 0.0, None),
        pitch_deg=pitch,
        gearbox_temp_c=gb_temp,
        operating=on & (power > 0.0),
        ambient_temp_c=temp,
        humidity_pct=rh,
        pressure_pa=pressure,
        air_density=rho,
        true_wind_ms=v_true,
        ground_truth=truth,
    )
