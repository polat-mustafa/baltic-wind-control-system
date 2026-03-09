"""Digital Twin API endpoints.

Provides REST endpoints for digital twin condition monitoring:
- GET  /config: Get module configuration (thresholds, weights, scenarios)
- GET  /scenarios: List available demo scenarios
- POST /analyze: Run full pipeline for a scenario (farm-wide analysis)
- POST /single-turbine: Analyze one turbine at one operating point

All endpoints follow: /api/v1/digital-twin/{resource}
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, HTTPException

from app.schemas.digital_twin import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnomalySchema,
    DegradationTrendSchema,
    DigitalTwinConfigResponse,
    FarmHealthSummarySchema,
    ScenarioInfo,
    SingleTurbineRequest,
    SingleTurbineResponse,
    TurbineHealthSchema,
    TwinComparisonSchema,
)
from app.services.digital_twin.health_scoring import (
    DEGRADED_THRESHOLD,
    HEALTHY_THRESHOLD,
    SIGMA_PITCH,
    SIGMA_POWER,
    SIGMA_RPM,
    WEIGHT_PITCH,
    WEIGHT_POWER,
    WEIGHT_RPM,
)
from app.services.digital_twin.residual_analysis import EWMA_SPAN
from app.services.digital_twin.scenario_generator import (
    SCENARIO_DESCRIPTIONS,
    VALID_SCENARIOS,
    run_digital_twin_analysis,
)
from app.services.digital_twin.twin_engine import (
    build_twin_lookup_table,
    lookup_twin_prediction,
)

router = APIRouter(
    prefix="/api/v1/digital-twin",
    tags=["Digital Twin"],
)


@router.get("/config", response_model=DigitalTwinConfigResponse)
async def get_config() -> DigitalTwinConfigResponse:
    """Get digital twin module configuration.

    Returns health scoring weights, thresholds, baseline noise floors,
    EWMA parameters, and available scenarios. Useful for UI display and
    educational transparency.
    """
    return DigitalTwinConfigResponse(
        health_weights={"power": WEIGHT_POWER, "rpm": WEIGHT_RPM, "pitch": WEIGHT_PITCH},
        health_thresholds={"healthy": HEALTHY_THRESHOLD, "degraded": DEGRADED_THRESHOLD},
        sigma_baselines={"power_pct": SIGMA_POWER, "rpm_pct": SIGMA_RPM, "pitch_pct": SIGMA_PITCH},
        ewma_span=EWMA_SPAN,
        available_scenarios=sorted(VALID_SCENARIOS),
    )


@router.get("/scenarios", response_model=list[ScenarioInfo])
async def list_scenarios() -> list[ScenarioInfo]:
    """List available demo scenarios with descriptions.

    Each scenario injects a known fault type for educational demonstration
    of how the digital twin detects and classifies anomalies.
    """
    return [
        ScenarioInfo(name=name, description=desc)
        for name, desc in sorted(SCENARIO_DESCRIPTIONS.items())
    ]


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Run complete digital twin analysis pipeline.

    Generates synthetic SCADA data, injects the selected scenario fault,
    runs the twin engine, computes residuals, scores health, and classifies
    anomalies for all turbines.

    This is the main endpoint — it produces all the data needed for the
    dashboard visualization.
    """
    if req.scenario not in VALID_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{req.scenario}'. Valid: {sorted(VALID_SCENARIOS)}",
        )

    # Run the full pipeline
    result = run_digital_twin_analysis(
        scenario=req.scenario,
        num_timesteps=req.num_timesteps,
        num_turbines=req.num_turbines,
        seed=req.seed,
    )

    # ── Build turbine health list ───────────────────────────────
    turbine_health: list[TurbineHealthSchema] = []
    all_anomalies: list[AnomalySchema] = []
    degradation_trends: list[DegradationTrendSchema] = []

    for analysis in result.turbine_analyses:
        h = analysis.final_health
        turbine_health.append(
            TurbineHealthSchema(
                turbine_id=analysis.turbine_id,
                turbine_name=analysis.turbine_name,
                health_power=h.health_power,
                health_rpm=h.health_rpm,
                health_pitch=h.health_pitch,
                health_composite=h.health_composite,
                status=h.status.value,
                anomaly_count=len(analysis.anomalies),
            )
        )

        # Anomalies
        for a in analysis.anomalies:
            all_anomalies.append(
                AnomalySchema(
                    turbine_id=a.turbine_id,
                    timestep=a.timestep,
                    category=a.category.value,
                    severity=a.severity,
                    description=a.description,
                    power_ewma_pct=a.power_ewma_pct,
                    rpm_ewma_pct=a.rpm_ewma_pct,
                    pitch_ewma_pct=a.pitch_ewma_pct,
                )
            )

        # Degradation trend
        health_values = [s.health_composite for s in analysis.health_timeseries]
        slope = _compute_degradation_slope(health_values, interval_minutes=10)
        rul = _estimate_rul(health_values[-1], slope) if slope < -0.01 else None

        degradation_trends.append(
            DegradationTrendSchema(
                turbine_id=analysis.turbine_id,
                turbine_name=analysis.turbine_name,
                health_values=health_values,
                slope_pct_per_day=round(slope, 4),
                rul_days=round(rul, 1) if rul is not None else None,
            )
        )

    # ── Farm health summary ─────────────────────────────────────
    worst_idx = min(
        range(req.num_turbines),
        key=lambda i: turbine_health[i].health_composite,
    )
    farm = result.farm_health
    farm_summary = FarmHealthSummarySchema(
        farm_health_pct=farm["farm_health_pct"],
        healthy_count=farm["healthy_count"],
        degraded_count=farm["degraded_count"],
        critical_count=farm["critical_count"],
        worst_turbine_id=worst_idx,
        worst_turbine_name=f"WTG-{worst_idx + 1:02d}",
        total_anomalies=len(all_anomalies),
    )

    # ── Comparison data (worst turbine) ─────────────────────────
    worst_analysis = result.turbine_analyses[worst_idx]
    residual_mw = (
        np.array(result.comparison_actual_power) - np.array(result.comparison_twin_power)
    ).tolist()
    residual_pct = worst_analysis.residuals.power_residual_pct.tolist()
    power_ewma = worst_analysis.residuals.power_ewma.tolist()

    comparison = TwinComparisonSchema(
        timestamps=result.comparison_timestamps,
        wind_speed_ms=result.comparison_wind,
        actual_power_mw=result.comparison_actual_power,
        twin_power_mw=result.comparison_twin_power,
        residual_mw=residual_mw,
        residual_pct=residual_pct,
        power_ewma=power_ewma,
    )

    return AnalyzeResponse(
        scenario=result.scenario,
        num_timesteps=result.num_timesteps,
        num_turbines=result.num_turbines,
        farm_health=farm_summary,
        turbine_health=turbine_health,
        anomalies=all_anomalies,
        degradation_trends=degradation_trends,
        comparison_data=comparison,
    )


@router.post("/single-turbine", response_model=SingleTurbineResponse)
async def single_turbine(req: SingleTurbineRequest) -> SingleTurbineResponse:
    """Analyze a single turbine at one operating point.

    Compares actual power against twin prediction and returns health score.
    Useful for quick spot-checks without running full farm analysis.
    """
    table = build_twin_lookup_table()
    pred = lookup_twin_prediction(table, req.wind_speed_ms, req.wind_dir_deg)

    residual_mw = req.actual_power_mw - pred.power_mw
    safe_ref = max(abs(pred.power_mw), 0.1)
    residual_pct = (residual_mw / safe_ref) * 100.0

    from app.services.digital_twin.health_scoring import compute_health_score

    health = compute_health_score(residual_pct, 0.0, 0.0)

    return SingleTurbineResponse(
        wind_speed_ms=req.wind_speed_ms,
        wind_dir_deg=req.wind_dir_deg,
        actual_power_mw=req.actual_power_mw,
        twin_power_mw=round(pred.power_mw, 4),
        residual_mw=round(residual_mw, 4),
        residual_pct=round(residual_pct, 2),
        health_composite=health.health_composite,
        status=health.status.value,
    )


# ── Helper functions ──────────────────────────────────────────────


def _compute_degradation_slope(
    health_values: list[float],
    interval_minutes: int = 10,
) -> float:
    """Compute degradation rate as % per day using linear regression.

    Fits a line to the health timeseries and returns the slope in
    units of % health per day.
    """
    if len(health_values) < 2:
        return 0.0

    n = len(health_values)
    # Time in days
    x = np.arange(n) * interval_minutes / (60.0 * 24.0)
    y = np.array(health_values)

    # Simple linear regression: slope = cov(x,y) / var(x)
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    slope = float(np.sum((x - x_mean) * (y - y_mean)) / np.sum((x - x_mean) ** 2))

    return slope


def _estimate_rul(
    current_health: float,
    slope_pct_per_day: float,
    failure_threshold: float = 40.0,
) -> float | None:
    """Estimate Remaining Useful Life in days.

    RUL = (current_health - failure_threshold) / |slope|

    Returns None if health is improving or slope is near zero.
    """
    if slope_pct_per_day >= -0.01:
        return None  # Not degrading

    rul = (current_health - failure_threshold) / abs(slope_pct_per_day)
    return max(0.0, rul)
