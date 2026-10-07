"""Digital-twin pipeline — ISO 13374-1 processing blocks end to end.

  DA  Data acquisition      plant_simulator.simulate_plant   (synthetic SCADA)
  DM  Data manipulation     detection.twin_view               (twin at measured wind)
  SD  State detection       detection.detect                  (EWMA charts, events)
  HA  Health assessment     detection (health index) + diagnosis (isolation, identification)
  PA  Prognostic assessment prognosis.prognose                (ISO 13381-1 RUL)
  AG  Advisory generation   fault_library advisories + cause hints

Results are cached per (scenario, duration, seed): the run is deterministic,
and the turbine-detail endpoint reads the same run as the farm overview.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from app.services.digital_twin.detection import (
    CHANNEL_KEYS,
    HI_ALARM,
    HI_NORMAL,
    Calibration,
    Detection,
    Event,
    TwinView,
    detect,
    phase_one_calibration,
    twin_view,
)
from app.services.digital_twin.diagnosis import (
    Diagnosis,
    SeverityPoint,
    diagnose_turbine,
    severity_trend,
)
from app.services.digital_twin.fault_library import FAULT_KINDS, FAULT_LIBRARY, FaultKind
from app.services.digital_twin.plant_simulator import (
    NUM_TURBINES,
    SAMPLE_PERIOD_S,
    SCENARIOS,
    WEIBULL_A,
    WEIBULL_K,
    PlantData,
    scenario_for,
    simulate_plant,
)
from app.services.digital_twin.prognosis import Prognosis, prognose
from app.services.digital_twin.reference_model import evaluate

FloatArray = NDArray[np.float64]
Status = Literal["normal", "alert", "alarm"]

HOURS_PER_SAMPLE = SAMPLE_PERIOD_S / 3600.0
MAX_DURATION_DAYS = 30


@dataclass(frozen=True)
class TurbineResult:
    turbine_id: int
    name: str
    status: Status
    health_index: float  # at the last sample
    channel_health: dict[str, float]
    worst_channel: str
    event_count: int
    active_event_count: int
    first_detection_idx: int | None
    last_evidence_idx: int | None  # end of the latest event (last sample if still active)
    diagnosis: Diagnosis | None
    prognosis: Prognosis | None
    severity_trend: list[SeverityPoint]
    actual_energy_mwh: float
    potential_energy_mwh: float  # twin-predicted (anemometer-corrected if diagnosed)
    lost_energy_mwh: float  # potential − actual since the identified fault began


@dataclass(frozen=True)
class ValidationRow:
    turbine_id: int
    injected_kind: FaultKind
    injected_severity: float  # mean over the diagnosis window (library units)
    final_severity: float
    onset_idx: int
    detected: bool
    detection_idx: int | None
    delay_hours: float | None
    diagnosed_kind: FaultKind | None
    isolation_correct: bool
    estimated_severity: float | None


@dataclass(frozen=True)
class DigitalTwinRun:
    scenario: str
    duration_days: int
    seed: int
    data: PlantData
    view: TwinView
    detection: Detection
    calibration: Calibration
    turbines: list[TurbineResult]
    events: list[Event]
    validation: list[ValidationRow]
    false_event_count: int
    health_hourly: FloatArray  # (hours × N) — worst health inside each hour

    @property
    def num_samples(self) -> int:
        return int(self.data.timestamps.size)


def turbine_name(tid: int) -> str:
    return f"WTG-{tid + 1:02d}"


def _status(events: list[Event], health: float) -> Status:
    """Worst of the active events and the current health-index zone."""
    active = [e for e in events if e.end_idx is None]
    if health < HI_ALARM or any(e.level == "alarm" for e in active):
        return "alarm"
    return "alert" if active or health < HI_NORMAL else "normal"


def _injected(data: PlantData, tid: int) -> list[tuple[FaultKind, int]]:
    """Faults injected on a turbine and the first sample they are present."""
    out: list[tuple[FaultKind, int]] = []
    for kind in FAULT_KINDS:
        truth = data.ground_truth[kind][:, tid]
        hit = np.flatnonzero(truth != FAULT_LIBRARY[kind].nominal)
        if hit.size:
            out.append((kind, int(hit[0])))
    return out


@lru_cache(maxsize=8)
def run_digital_twin(
    scenario: str,
    duration_days: int = 7,
    seed: int = 42,
    n_turbines: int = NUM_TURBINES,
    weibull: tuple[float, float] = (WEIBULL_A, WEIBULL_K),
) -> DigitalTwinRun:
    """Run DA → DM → SD → HA → PA on one scenario of a farm (SB-510: 34 turbines).

    The detector keeps its phase-one calibration on the SB-510 reference fleet
    (healthy, same turbine model): its limits are per wind bin, not per farm.
    """
    if scenario not in SCENARIOS:
        msg = f"Unknown scenario '{scenario}'. Valid: {sorted(SCENARIOS)}"
        raise ValueError(msg)
    if not 1 <= duration_days <= MAX_DURATION_DAYS:
        msg = f"duration_days must be 1–{MAX_DURATION_DAYS}, got {duration_days}"
        raise ValueError(msg)

    cal = phase_one_calibration()
    data = simulate_plant(
        scenario_for(scenario, n_turbines), duration_days, seed, n_turbines, weibull
    )  # DA
    view = twin_view(data)  # DM
    det = detect(view, data.wind_ms, cal)  # SD + HA (health index)
    n_t = data.timestamps.size
    last = n_t - 1

    by_turbine: dict[int, list[Event]] = {}
    for ev in det.events:
        by_turbine.setdefault(ev.turbine_id, []).append(ev)

    turbines: list[TurbineResult] = []
    for tid in range(n_turbines):
        evs = by_turbine.get(tid, [])
        diag = diagnose_turbine(tid, evs, data, view, det, cal) if evs else None  # HA
        trend: list[SeverityPoint] = []
        prog: Prognosis | None = None
        if diag is not None and diag.kind is not None and diag.severity is not None:
            trend = severity_trend(
                tid, diag.kind, diag.severity, diag.window_start_idx, last,
                data, view, det, cal,
            )  # fmt: skip
            prog = prognose(diag.kind, trend, last)  # PA

        potential = view.twin.power_mw[:, tid]
        if diag is not None and diag.kind == "anemometer_gain" and diag.severity is not None:
            gain = 1.0 + diag.severity / 100.0
            potential = evaluate(data.wind_ms[:, tid] / gain, data.air_density).power_mw

        lost = 0.0
        if diag is not None and diag.kind is not None:
            ws = diag.window_start_idx
            gap = potential[ws:] - data.power_mw[ws:, tid]
            lost = max(0.0, float(gap.sum() * HOURS_PER_SAMPLE))

        ch_health = det.health[last, tid, :]
        worst = int(np.argmin(ch_health))
        turbines.append(
            TurbineResult(
                turbine_id=tid,
                name=turbine_name(tid),
                status=_status(evs, float(det.health_turbine[last, tid])),
                health_index=round(float(det.health_turbine[last, tid]), 2),
                channel_health={
                    k: round(float(h), 2) for k, h in zip(CHANNEL_KEYS, ch_health, strict=True)
                },
                worst_channel=CHANNEL_KEYS[worst],
                event_count=len(evs),
                active_event_count=sum(1 for e in evs if e.end_idx is None),
                first_detection_idx=min((e.confirmed_idx for e in evs), default=None),
                last_evidence_idx=max(
                    (e.end_idx if e.end_idx is not None else last for e in evs), default=None
                ),
                diagnosis=diag,
                prognosis=prog,
                severity_trend=trend,
                actual_energy_mwh=round(float(data.power_mw[:, tid].sum() * HOURS_PER_SAMPLE), 2),
                potential_energy_mwh=round(float(potential.sum() * HOURS_PER_SAMPLE), 2),
                lost_energy_mwh=round(lost, 2),
            )
        )

    validation: list[ValidationRow] = []
    first_onset: dict[int, int] = {}
    for tr in turbines:
        for kind, onset in _injected(data, tr.turbine_id):
            first_onset[tr.turbine_id] = min(onset, first_onset.get(tr.turbine_id, onset))
            evs = [e for e in by_turbine.get(tr.turbine_id, []) if e.confirmed_idx >= onset]
            det_idx = min((e.confirmed_idx for e in evs), default=None)
            diag = tr.diagnosis
            truth = data.ground_truth[kind][:, tr.turbine_id]
            if diag is not None:
                window = truth[diag.window_start_idx : diag.window_end_idx + 1]
                injected = float(np.mean(window))
            else:
                injected = float(truth[-1])
            validation.append(
                ValidationRow(
                    turbine_id=tr.turbine_id,
                    injected_kind=kind,
                    injected_severity=round(injected, 3),
                    final_severity=round(float(truth[-1]), 3),
                    onset_idx=onset,
                    detected=det_idx is not None,
                    detection_idx=det_idx,
                    delay_hours=(
                        round((det_idx - onset) * HOURS_PER_SAMPLE, 2)
                        if det_idx is not None
                        else None
                    ),
                    diagnosed_kind=diag.kind if diag is not None else None,
                    isolation_correct=diag is not None and diag.kind == kind,
                    estimated_severity=diag.severity if diag is not None else None,
                )
            )

    n_hours = n_t // 6
    health_hourly = det.health_turbine[: n_hours * 6].reshape(n_hours, 6, n_turbines).min(axis=1)
    return DigitalTwinRun(
        scenario=scenario,
        duration_days=duration_days,
        seed=seed,
        data=data,
        view=view,
        detection=det,
        calibration=cal,
        turbines=turbines,
        events=det.events,
        validation=validation,
        # an event is false if its turbine had no fault yet when it was confirmed
        false_event_count=sum(
            1 for e in det.events if e.confirmed_idx < first_onset.get(e.turbine_id, n_t)
        ),
        health_hourly=health_hourly,
    )
