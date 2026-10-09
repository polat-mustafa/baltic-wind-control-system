"""Digital Twin API — /api/v1/digital-twin.

  GET  /config            model card: parameters, calibration, detector, fault library
  GET  /scenarios         fault scenarios with their injections
  GET  /reference-curve   twin steady-state curves vs. the legacy V236 table
  POST /analyze           farm-level run (ISO 13374-1 DA → AG)
  POST /turbine-detail    full-resolution channels of one turbine from the same run
  POST /operating-point   check one measured operating point against the twin

Runs are deterministic per (scenario, duration_days, seed) and cached, so
``/turbine-detail`` reads exactly the run ``/analyze`` summarised.
"""

from __future__ import annotations

import math

import numpy as np
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from numpy.typing import NDArray

from app.core.exceptions import NotFoundError
from app.routers.farm_spec import FarmSpecDep, FarmWindDep
from app.schemas.digital_twin import (
    AmbientSeries,
    AnalyzeRequest,
    AnalyzeResponse,
    CareBenchmarkResponse,
    ChannelCard,
    ChannelSeries,
    DiagnosisSchema,
    EventSchema,
    FarmSummary,
    FaultModeCard,
    HealthTrend,
    HypothesisSchema,
    ModelCardResponse,
    OperatingPointRequest,
    OperatingPointResponse,
    PrognosisSchema,
    ReferenceCurveResponse,
    ScenarioInfo,
    ScenarioInjection,
    SeverityPointSchema,
    StandardRef,
    TruthSeries,
    TurbineDetailRequest,
    TurbineDetailResponse,
    TurbineSummary,
    ValidationRowSchema,
    ValidationSchema,
)
from app.services.digital_twin import detection as det_mod
from app.services.digital_twin import plant_simulator as plant
from app.services.digital_twin.care_benchmark import load_results as care_results
from app.services.digital_twin.detection import (
    CHANNELS,
    detector_settings,
    phase_one_calibration,
    standardise,
    verification_false_events,
)
from app.services.digital_twin.fault_library import FAULT_KINDS, FAULT_LIBRARY
from app.services.digital_twin.pipeline import (
    DigitalTwinRun,
    TurbineResult,
    run_digital_twin,
    turbine_name,
)
from app.services.digital_twin.reference_model import (
    DEFAULT_PARAMS,
    REGION_NAMES,
    calibrate,
    evaluate,
    reference_curve,
)
from app.services.p2.network_model import FarmSpec
from app.services.p4.turbine_power_curve import get_turbine_spec

router = APIRouter(prefix="/api/v1/digital-twin", tags=["Digital Twin"])

STANDARDS: list[StandardRef] = [
    StandardRef(
        code="ISO 13374-1:2003",
        title="Condition monitoring and diagnostics of machines — Data processing, "
        "communication and presentation — Part 1: General guidelines",
        role="Pipeline structure: DA → DM → SD → HA → PA → AG",
    ),
    StandardRef(
        code="ISO 13379-1:2012",
        title="Condition monitoring and diagnostics of machines — Data interpretation "
        "and diagnostics techniques — Part 1: General guidelines",
        role="Model-based diagnosis, fault-symptom reasoning",
    ),
    StandardRef(
        code="ISO 13381-1:2015",
        title="Condition monitoring and diagnostics of machines — Prognostics — "
        "Part 1: General guidelines",
        role="RUL from a degradation descriptor, with confidence",
    ),
    StandardRef(
        code="ISO/IEC 30173:2023",
        title="Digital twin — Concepts and terminology",
        role="Vocabulary: physical entity, digital entity, data connection",
    ),
    StandardRef(
        code="DNV-RP-A204 (2020)",
        title="Qualification and assurance of digital twins",
        role="Model card: calibration and validation evidence",
    ),
    StandardRef(
        code="IEC 61400-12-1:2022",
        title="Power performance measurements of electricity producing wind turbines",
        role="0.5 m/s bins, air density from p and T",
    ),
    StandardRef(
        code="IEC 61400-25-2:2015",
        title="Communications for monitoring and control of wind power plants — Information model",
        role="Channel → logical node mapping (WTUR, WROT, WTRM, WMET)",
    ),
    StandardRef(
        code="JCGM 100:2008 (GUM)",
        title="Evaluation of measurement data — Guide to the expression of uncertainty",
        role="Propagation of wind-measurement uncertainty through the twin",
    ),
]


# ── Helpers ───────────────────────────────────────────────────────


def _floats(x: NDArray[np.float64] | NDArray[np.bool_], digits: int = 4) -> list[float]:
    arr = np.asarray(x, dtype=np.float64)
    return [float(v) for v in np.round(np.nan_to_num(arr, nan=0.0), digits)]


def _finite(x: float) -> float | None:
    return None if math.isnan(x) or math.isinf(x) else x


def _ts(run: DigitalTwinRun, idx: int | None) -> int | None:
    return None if idx is None else int(run.data.timestamps[idx])


def _diagnosis_schema(run: DigitalTwinRun, tr: TurbineResult) -> DiagnosisSchema | None:
    d = tr.diagnosis
    if d is None:
        return None
    mode = FAULT_LIBRARY[d.kind] if d.kind is not None else None
    return DiagnosisSchema(
        kind=d.kind,
        label=mode.label if mode else "Unexplained deviation",
        category=mode.category if mode else None,
        severity=d.severity,
        unit=mode.unit if mode else None,
        posterior=d.posterior,
        explained=d.explained,
        lr_statistic=d.lr_statistic,
        cause_hint=d.cause_hint,
        advisory=mode.advisory if mode else None,
        window_start=int(run.data.timestamps[d.window_start_idx]),
        window_end=int(run.data.timestamps[d.window_end_idx]),
        samples_used=d.samples_used,
        mean_ambient_c=d.mean_ambient_c,
        mean_humidity_pct=d.mean_humidity_pct,
        hypotheses=[
            HypothesisSchema(
                kind=h.kind,
                severity=h.severity,
                cost=h.cost,
                explained=h.explained,
                posterior=h.posterior,
            )
            for h in d.hypotheses
        ],
    )


def _turbine_summary(run: DigitalTwinRun, tr: TurbineResult) -> TurbineSummary:
    p = tr.prognosis
    return TurbineSummary(
        turbine_id=tr.turbine_id,
        name=tr.name,
        status=tr.status,
        health_index=tr.health_index,
        channel_health=tr.channel_health,
        worst_channel=tr.worst_channel,
        event_count=tr.event_count,
        active_event_count=tr.active_event_count,
        first_detection=_ts(run, tr.first_detection_idx),
        last_evidence=_ts(run, tr.last_evidence_idx),
        diagnosis=_diagnosis_schema(run, tr),
        prognosis=(
            PrognosisSchema(
                kind=p.kind,
                limit=p.limit,
                limit_note=p.limit_note,
                current=_finite(p.current),
                slope_per_day=p.slope_per_day,
                slope_std_error=p.slope_std_error,
                p_value=p.p_value,
                significant=p.significant,
                rul_days=p.rul_days,
                rul_lower_days=p.rul_lower_days,
                rul_upper_days=p.rul_upper_days,
                points=p.points,
                status=p.status,
            )
            if p is not None
            else None
        ),
        actual_energy_mwh=tr.actual_energy_mwh,
        potential_energy_mwh=tr.potential_energy_mwh,
        lost_energy_mwh=tr.lost_energy_mwh,
    )


def _scenario_info(s: plant.Scenario) -> ScenarioInfo:
    return ScenarioInfo(
        name=s.name,
        title=s.title,
        description=s.description,
        injections=[
            ScenarioInjection(
                kind=inj.kind,
                label=FAULT_LIBRARY[inj.kind].label,
                turbines=[turbine_name(t) for t in inj.turbine_ids],
                severity=list(inj.severity),
                unit=FAULT_LIBRARY[inj.kind].unit,
                onset_fraction=inj.onset,
                ramp_fraction=inj.ramp,
                end_fraction=inj.end,
            )
            for inj in s.injections
        ],
        cold_spell=s.cold_spell,
    )


def _run(req: AnalyzeRequest, spec: FarmSpec, wind: tuple[float, float] | None) -> DigitalTwinRun:
    weibull = wind or (plant.WEIBULL_A, plant.WEIBULL_K)
    return run_digital_twin(req.scenario, req.duration_days, req.seed, spec.num_turbines, weibull)


def _weibull_text(wind: tuple[float, float] | None) -> str:
    if wind is None:
        return f"a = {plant.WEIBULL_A} m/s, k = {plant.WEIBULL_K}"
    return f"a = {wind[0]} m/s, k = {wind[1]} (own site, hub height)"


# ── Endpoints ─────────────────────────────────────────────────────


@router.get("/config", response_model=ModelCardResponse)
async def get_config(farm: FarmSpecDep, wind: FarmWindDep) -> ModelCardResponse:
    """Model card (DNV-RP-A204 style): what the twin assumes and how well it fits."""
    cal = await run_in_threadpool(phase_one_calibration)
    verification = await run_in_threadpool(verification_false_events)
    aero = calibrate()
    spec = get_turbine_spec()
    p = DEFAULT_PARAMS
    channels = [
        ChannelCard(
            key=c.key,
            label=c.label,
            unit=c.unit,
            logical_node=c.logical_node,
            sigma_floor=c.sigma_floor,
            acf_factor=round(float(cal.acf_factor[i]), 3),
            lag1_autocorr=round(float(cal.lag1_autocorr[i]), 3),
            rmse=round(float(cal.rmse[i]), 4),
            bias=round(float(cal.bias[i]), 4),
            samples=int(cal.samples[i]),
        )
        for i, c in enumerate(CHANNELS)
    ]
    return ModelCardResponse(
        turbine={
            "name": spec.name,
            "rated_power_mw": p.rated_power_mw,
            "rotor_diameter_m": 2 * p.rotor_radius_m,
            "cut_in_ms": p.cut_in_ms,
            "rated_wind_ms": p.rated_wind_ms,
            "cut_out_ms": p.cut_out_ms,
            "min_rotor_rpm": p.min_rotor_rpm,
            "rated_rotor_rpm": p.rated_rotor_rpm,
            "drivetrain": "low-speed direct drive (no gearbox), PMSG outer rotor",
            "generator_efficiency": p.generator_efficiency,
            "converter_efficiency": round(p.converter_efficiency, 5),
            "tsr_opt": p.tsr_opt,
        },
        aero_calibration={
            "lambda_opt": round(aero.lambda_opt, 3),
            "cp_max_surface": round(aero.cp_max_surface, 4),
            "k_aero": round(aero.k_aero, 4),
            "cp_max_effective": round(aero.cp_max, 4),
            "torque_gain_mnm_per_rad_s2": round(aero.torque_gain_nm_s2 / 1e6, 3),
        },
        thermal_model={
            "structure": "1st-order lag",
            "offset_k": p.generator_temp_offset_k,
            "resistance_k_per_kw": p.generator_thermal_resistance_k_per_kw,
            "time_constant_s": p.generator_thermal_time_constant_s,
            "provenance": (
                "illustrative — no public IEA 15 MW generator thermal data; rated rise ≈ 78 K "
                "(within the IEC 60034-1 class B rise on class F insulation)"
            ),
        },
        measurement_model={
            "anemometer_sigma": (
                f"{plant.ANEMOMETER_SIGMA_BASE_MS} + {plant.ANEMOMETER_SIGMA_REL}·v m/s"
            ),
            "power_sigma_mw": plant.POWER_SIGMA_MW,
            "rotor_speed_sigma_rpm": plant.ROTOR_SIGMA_RPM,
            "pitch_sigma_deg": plant.PITCH_SIGMA_DEG,
            "generator_temp_sigma_k": plant.GENERATOR_TEMP_SIGMA_K,
            "turbine_wind_sigma": plant.TURBINE_SIGMA,
            "weibull": _weibull_text(wind),
        },
        detector=detector_settings(),
        phase_one={
            "days": det_mod.CALIBRATION_DAYS,
            "turbine_days": cal.turbine_days,
            "wind_sigma_a_ms": cal.wind_sigma_coef[0],
            "wind_sigma_b": cal.wind_sigma_coef[1],
            "in_sample_false_events": cal.false_events,
            "verification_false_events": verification,
            "verification_days": det_mod.CALIBRATION_DAYS,
        },
        channels=channels,
        fault_library=[
            FaultModeCard(
                kind=m.kind,
                label=m.label,
                category=m.category,
                parameter=m.parameter,
                unit=m.unit,
                nominal=m.nominal,
                search_min=m.search_min,
                search_max=m.search_max,
                advisory=m.advisory,
                references=list(m.references),
                prognosis_limit=m.prognosis_limit,
                prognosis_limit_note=m.prognosis_limit_note,
            )
            for m in (FAULT_LIBRARY[k] for k in FAULT_KINDS)
        ],
        scenarios=[
            _scenario_info(plant.scenario_for(n, farm.num_turbines)) for n in plant.SCENARIOS
        ],
        standards=STANDARDS,
    )


@router.get("/scenarios", response_model=list[ScenarioInfo])
async def list_scenarios(spec: FarmSpecDep) -> list[ScenarioInfo]:
    return [_scenario_info(plant.scenario_for(n, spec.num_turbines)) for n in plant.SCENARIOS]


@router.get("/reference-curve", response_model=ReferenceCurveResponse)
async def get_reference_curve() -> ReferenceCurveResponse:
    """Twin steady state at ρ = 1.225 kg/m³, with the legacy V236 table for validation."""
    rc = reference_curve()
    dev = np.abs(rc.power_mw - rc.p1_table_power_mw)
    in_range = (rc.wind_ms >= 6.0) & (rc.wind_ms <= 25.0)
    return ReferenceCurveResponse(
        wind_ms=_floats(rc.wind_ms, 2),
        power_mw=_floats(rc.power_mw),
        rotor_speed_rpm=_floats(rc.rotor_speed_rpm),
        pitch_deg=_floats(rc.pitch_deg, 3),
        tip_speed_ratio=_floats(rc.tip_speed_ratio, 3),
        cp=_floats(rc.cp),
        generator_loss_kw=_floats(rc.generator_loss_kw, 1),
        region=[int(r) for r in rc.region],
        region_names=REGION_NAMES,
        p1_table_power_mw=_floats(rc.p1_table_power_mw),
        max_deviation_vs_p1_mw=round(float(dev[rc.wind_ms <= 25.0].max()), 3),
        max_deviation_vs_p1_above_6ms_mw=round(float(dev[in_range].max()), 3),
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, spec: FarmSpecDep, wind: FarmWindDep) -> AnalyzeResponse:
    """Farm overview: health, events, diagnoses, prognoses, validation vs. ground truth."""
    run = await run_in_threadpool(_run, req, spec, wind)
    data = run.data
    turbines = [_turbine_summary(run, tr) for tr in run.turbines]
    kind_of = {tr.turbine_id: (tr.diagnosis.kind if tr.diagnosis else None) for tr in run.turbines}

    events = [
        EventSchema(
            turbine_id=e.turbine_id,
            turbine_name=turbine_name(e.turbine_id),
            channel=e.channel,
            level=e.level,
            direction=e.direction,
            onset=int(data.timestamps[e.onset_idx]),
            confirmed=int(data.timestamps[e.confirmed_idx]),
            end=_ts(run, e.end_idx),
            peak_u=e.peak_u,
            diagnosis=kind_of[e.turbine_id],
        )
        for e in run.events
    ]

    rows = [
        ValidationRowSchema(
            turbine_id=v.turbine_id,
            turbine_name=turbine_name(v.turbine_id),
            injected_kind=v.injected_kind,
            injected_severity=v.injected_severity,
            final_severity=v.final_severity,
            unit=FAULT_LIBRARY[v.injected_kind].unit,
            onset=int(data.timestamps[v.onset_idx]),
            detected=v.detected,
            detection=_ts(run, v.detection_idx),
            delay_hours=v.delay_hours,
            diagnosed_kind=v.diagnosed_kind,
            isolation_correct=v.isolation_correct,
            estimated_severity=v.estimated_severity,
        )
        for v in run.validation
    ]
    delays = [r.delay_hours for r in rows if r.delay_hours is not None]

    hi = np.array([t.health_index for t in run.turbines])
    actual = sum(t.actual_energy_mwh for t in run.turbines)
    potential = sum(t.potential_energy_mwh for t in run.turbines)
    lost = sum(
        t.lost_energy_mwh
        for t in run.turbines
        if t.diagnosis is not None and t.diagnosis.kind not in (None, "anemometer_gain")
    )
    farm = FarmSummary(
        fleet_health_index=round(float(hi.mean()), 2),
        min_health_index=round(float(hi.min()), 2),
        normal_count=sum(t.status == "normal" for t in run.turbines),
        alert_count=sum(t.status == "alert" for t in run.turbines),
        alarm_count=sum(t.status == "alarm" for t in run.turbines),
        diagnosed_count=sum(
            t.diagnosis is not None and t.diagnosis.kind is not None for t in run.turbines
        ),
        active_events=sum(e.end_idx is None for e in run.events),
        total_events=len(run.events),
        actual_energy_mwh=round(actual, 1),
        potential_energy_mwh=round(potential, 1),
        lost_energy_mwh=round(lost, 1),
        energy_performance_pct=round(100.0 * actual / potential, 2) if potential > 0 else 0.0,
    )

    hours = run.health_hourly.shape[0]
    hour_ts = [int(data.timestamps[0] + (h + 1) * 3600) for h in range(hours)]
    n_hour = hours * 6
    farm_wind = np.median(data.wind_ms[:n_hour], axis=1).reshape(hours, 6).mean(axis=1)

    return AnalyzeResponse(
        scenario=req.scenario,
        title=plant.SCENARIOS[req.scenario].title,
        duration_days=run.duration_days,
        seed=run.seed,
        start=int(data.timestamps[0]),
        sample_period_s=plant.SAMPLE_PERIOD_S,
        num_samples=run.num_samples,
        farm=farm,
        turbines=turbines,
        events=events,
        health_trend=HealthTrend(
            timestamps=hour_ts,
            health=[_floats(run.health_hourly[:, i], 1) for i in range(spec.num_turbines)],
        ),
        ambient=AmbientSeries(
            timestamps=hour_ts,
            temperature_c=_floats(data.ambient_temp_c[:n_hour].reshape(hours, 6).mean(axis=1), 2),
            humidity_pct=_floats(data.humidity_pct[:n_hour].reshape(hours, 6).mean(axis=1), 1),
            farm_wind_ms=_floats(farm_wind, 2),
        ),
        validation=ValidationSchema(
            rows=rows,
            injected=len(rows),
            detected=sum(r.detected for r in rows),
            isolated=sum(r.isolation_correct for r in rows),
            false_events=run.false_event_count,
            mean_delay_hours=round(float(np.mean(delays)), 2) if delays else None,
        ),
    )


@router.post("/turbine-detail", response_model=TurbineDetailResponse)
async def turbine_detail(
    req: TurbineDetailRequest, spec: FarmSpecDep, wind: FarmWindDep
) -> TurbineDetailResponse:
    """All five channels of one turbine at full resolution, from the cached run."""
    tid = req.turbine_id
    if tid >= spec.num_turbines:
        raise NotFoundError(f"Turbine index {tid} not in a farm of {spec.num_turbines} turbines")
    run = await run_in_threadpool(_run, req, spec, wind)
    data, view, det = run.data, run.view, run.detection
    tr = run.turbines[tid]

    channels = [
        ChannelSeries(
            key=c.key,
            label=c.label,
            unit=c.unit,
            logical_node=c.logical_node,
            measured=_floats(view.measured[:, tid, i], 3),
            expected=_floats(view.expected[:, tid, i], 3),
            ewma=_floats(det.ewma[:, tid, i], 3),
            limit=_floats(det.ucl[:, tid, i], 3),
            valid=[bool(v) for v in view.valid[:, tid, i]],
        )
        for i, c in enumerate(CHANNELS)
    ]
    in_event = np.zeros(data.timestamps.size, dtype=bool)
    for e in run.events:
        if e.turbine_id == tid:
            stop = e.end_idx + 1 if e.end_idx is not None else data.timestamps.size
            in_event[e.onset_idx : stop] = True

    truth = [
        TruthSeries(
            kind=k, unit=FAULT_LIBRARY[k].unit, values=_floats(data.ground_truth[k][:, tid], 3)
        )
        for k in FAULT_KINDS
        if np.any(data.ground_truth[k][:, tid] != FAULT_LIBRARY[k].nominal)
    ]
    rc = reference_curve()
    return TurbineDetailResponse(
        turbine=_turbine_summary(run, tr),
        timestamps=[int(t) for t in data.timestamps],
        wind_ms=_floats(data.wind_ms[:, tid], 3),
        channels=channels,
        health=_floats(det.health_turbine[:, tid], 1),
        in_event=[bool(v) for v in in_event],
        severity_trend=[
            SeverityPointSchema(
                time=int(data.timestamps[p.centre_idx]),
                severity=p.severity,
                std_error=p.std_error,
                samples=p.samples,
            )
            for p in tr.severity_trend
        ],
        truth=truth,
        power_curve_wind_ms=_floats(rc.wind_ms, 2),
        power_curve_mw=_floats(rc.power_mw),
    )


@router.post("/operating-point", response_model=OperatingPointResponse)
async def operating_point(req: OperatingPointRequest) -> OperatingPointResponse:
    """Compare one measured 10-min operating point with the twin (z-scores from Phase I)."""
    op = evaluate(np.array([req.wind_speed_ms]), req.air_density)
    cal = await run_in_threadpool(phase_one_calibration)
    exp = np.array(
        [float(op.power_mw[0]), float(op.rotor_speed_rpm[0]), float(op.pitch_deg[0]), 0.0, 0.0]
    )
    meas = np.array(
        [
            req.power_mw,
            req.rotor_speed_rpm if req.rotor_speed_rpm is not None else np.nan,
            req.pitch_deg if req.pitch_deg is not None else np.nan,
            0.0,
            0.0,
        ]
    )
    z, _ = standardise((meas - exp)[None, None, :], np.array([[req.wind_speed_ms]]), cal)
    zz = z[0, 0]
    operating = bool(op.operating[0])

    def opt(x: float) -> float | None:
        return None if not operating or math.isnan(x) else round(x, 3)

    return OperatingPointResponse(
        region=REGION_NAMES[int(op.region[0])],
        expected_power_mw=round(exp[0], 4),
        expected_rotor_speed_rpm=round(exp[1], 3),
        expected_pitch_deg=round(exp[2], 3),
        power_residual_mw=round(float(meas[0] - exp[0]), 4),
        power_z=opt(float(zz[0])),
        rotor_speed_residual_rpm=opt(float(meas[1] - exp[1])),
        rotor_speed_z=opt(float(zz[1])),
        pitch_residual_deg=opt(float(meas[2] - exp[2])),
        pitch_z=opt(float(zz[2])),
    )


@router.get("/real-data/care", response_model=CareBenchmarkResponse)
async def care_benchmark() -> CareBenchmarkResponse:
    """The twin's detector on CARE to Compare Wind Farm B (real offshore SCADA, CC BY-SA 4.0).

    Built offline by ``scripts/build_care_benchmark.py``; this endpoint serves the bundled result.
    """
    return CareBenchmarkResponse(**care_results())
