"""
P1 Wind Resource & AEP API endpoints.

Provides REST endpoints for:
- Turbine specification (V236-15.0 MW constants)
- Weibull distribution fitting from synthetic wind data
- Wind rose analysis (frequency + energy rose)
- Wake analysis via PyWake BPA Gaussian model
- AEP loss cascade with P50/P75/P90 uncertainty
- Blockage estimation (Nygaard 2020)
- Layout comparison (regular / staggered / optimized)
- Layout position retrieval

All endpoints follow the convention: /api/v1/wind/{resource}

Data approach: generates synthetic ERA5-like wind data from Weibull
parameters (A, k) since no real database exists yet. Same philosophy
as P4's scada_generator.py — physics-correct synthetic data.
"""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.cache import cached
from app.core.exceptions import DomainError
from app.core.exceptions import ValidationError as DomainValidationError
from app.services.p1.aep_calculator import (
    DEFAULT_PRICE_EUR_MWH,
    MarketWeightedAEPResult,
    compute_aep_cascade,
    compute_market_weighted_aep,
)
from app.services.p1.blockage import (
    estimate_blockage_loss_percent,
)
from app.services.p1.data_processing import (
    compute_weibull_pdf,
    fit_weibull,
)
from app.services.p1.layout_optimizer import (
    LayoutResult,
    generate_regular_grid,
    generate_staggered_grid,
)
from app.services.p1.wake_model import (
    CUT_IN_SPEED_MS,
    CUT_OUT_SPEED_MS,
    HUB_HEIGHT_M,
    RATED_POWER_KW,
    RATED_SPEED_MS,
    ROTOR_DIAMETER_M,
    WakeAnalysisResult,
    create_uniform_site,
    run_wake_analysis,
)
from app.services.p1.wind_analysis import compute_wind_rose
from app.services.p1.yaw_optimizer import (
    optimize_yaw_all_directions,
    optimize_yaw_single_direction,
)
from app.services.p1.wake_models import (
    WakeDeficitModel,
    TurbulenceModel,
    SuperpositionModel,
    compare_wake_models,
    run_wake_analysis_flexible,
)
from app.services.p1.derating import optimize_derating
from app.services.p1.flowers_aep import compute_flowers_aep
from app.services.p1.layout_optimizer import (
    OptimizationAlgorithm,
    optimize_layout_multi,
)
from app.services.p1.uncertainty_quantification import (
    UncertainParameter,
    run_pce_uncertainty,
)
from app.services.p1.robust_optimization import run_robust_optimization

router = APIRouter(prefix="/api/v1/wind", tags=["P1 Wind Resource"])


# ── Pydantic Schemas ─────────────────────────────────────────────


class TurbineSpecResponse(BaseModel):
    """V236-15.0 MW turbine specification constants."""

    rotor_diameter_m: float
    hub_height_m: float
    rated_power_kw: float
    cut_in_speed_ms: float
    rated_speed_ms: float
    cut_out_speed_ms: float
    num_turbines: int


class WeibullFitRequest(BaseModel):
    """Request to fit Weibull from synthetic data."""

    weibull_a: float = Field(10.5, ge=5.0, le=20.0, description="Weibull scale A [m/s]")
    weibull_k: float = Field(2.2, ge=1.0, le=4.0, description="Weibull shape k [-]")
    num_samples: int = Field(8760, ge=1000, le=87600, description="Number of synthetic samples")


class WeibullFitResponse(BaseModel):
    """Weibull fit result with histogram data for plotting."""

    fitted_a: float
    fitted_k: float
    mean_speed_ms: float
    bin_centres: list[float]
    bin_frequencies: list[float]
    pdf_values: list[float]


class WindRoseRequest(BaseModel):
    """Request for wind rose computation from synthetic data."""

    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    num_samples: int = Field(8760, ge=1000, le=87600)
    num_sectors: int = Field(12, ge=8, le=36)


class WindRoseResponse(BaseModel):
    """Wind rose analysis result."""

    sector_centres_deg: list[float]
    frequencies: list[float]
    mean_speeds_ms: list[float]
    energy_fractions: list[float]
    dominant_direction_deg: float
    circular_std_deg: float
    num_sectors: int


class WakeAnalysisRequest(BaseModel):
    """Request for wake analysis on a layout."""

    layout: str = Field("regular", description="Layout name: regular, staggered")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)


class WakeAnalysisResponse(BaseModel):
    """Wake analysis result with per-turbine data."""

    gross_aep_gwh: float
    net_aep_gwh: float
    wake_loss_percent: float
    capacity_factor: float
    per_turbine_aep_gwh: list[float]
    per_turbine_wake_loss_percent: list[float]


class AEPCascadeRequest(BaseModel):
    """Request for full AEP loss cascade."""

    layout: str = Field("regular")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    price_eur_mwh: float = Field(DEFAULT_PRICE_EUR_MWH, ge=10.0, le=300.0)


class LossFactorSchema(BaseModel):
    """Single loss factor in the cascade."""

    name: str
    loss_percent: float
    uncertainty_percent: float


class AEPCascadeResponse(BaseModel):
    """Full AEP cascade with uncertainty and exceedance values."""

    gross_aep_gwh: float
    net_aep_gwh: float
    p50_gwh: float
    p75_gwh: float
    p90_gwh: float
    p99_gwh: float
    total_loss_percent: float
    combined_uncertainty_percent: float
    capacity_factor: float
    revenue_meur: float
    loss_factors: list[LossFactorSchema]
    price_eur_mwh: float


class BlockageRequest(BaseModel):
    """Request for blockage estimation."""

    layout: str = Field("regular")
    mean_wind_speed_ms: float = Field(10.5, ge=3.0, le=20.0)


class BlockageResponse(BaseModel):
    """Blockage estimation result."""

    blockage_loss_percent: float
    array_density: float
    mean_ct: float
    farm_area_km2: float
    method: str


class LayoutComparisonRequest(BaseModel):
    """Request to compare all 3 layouts."""

    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    price_eur_mwh: float = Field(DEFAULT_PRICE_EUR_MWH, ge=10.0, le=300.0)


class LayoutCascadeEntry(BaseModel):
    """One layout's AEP cascade result."""

    name: str
    net_aep_gwh: float
    wake_loss_percent: float
    capacity_factor: float
    revenue_meur: float
    p90_gwh: float


class LayoutComparisonResponse(BaseModel):
    """Comparison of multiple layout results."""

    layouts: list[LayoutCascadeEntry]
    best_layout: str
    improvement_percent: float


class LayoutPositionsResponse(BaseModel):
    """Turbine x/y positions for a named layout."""

    name: str
    x_positions: list[float]
    y_positions: list[float]
    num_turbines: int
    min_spacing_m: float
    area_km2: float


# ── Yaw Optimization Schemas ────────────────────────────────────


class YawOptimizationRequest(BaseModel):
    """Request for yaw optimization at a single wind direction."""

    layout: str = Field("staggered", description="Layout name: regular, staggered")
    wind_direction_deg: float = Field(240.0, ge=0.0, lt=360.0, description="Wind direction [deg]")
    wind_speed_ms: float = Field(9.5, ge=3.0, le=25.0, description="Wind speed [m/s]")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    max_yaw_deg: float = Field(30.0, ge=5.0, le=40.0, description="Max yaw angle [deg]")


class YawOptimizationResponse(BaseModel):
    """Result of yaw optimization for a single wind direction."""

    wind_direction_deg: float
    baseline_power_mw: float
    optimized_power_mw: float
    power_gain_percent: float
    optimal_yaw_angles_deg: list[float]
    per_turbine_baseline_mw: list[float]
    per_turbine_optimized_mw: list[float]


class FarmYawOptimizationRequest(BaseModel):
    """Request for yaw optimization across all wind directions."""

    layout: str = Field("staggered", description="Layout name: regular, staggered")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    wind_speed_ms: float = Field(9.5, ge=3.0, le=25.0, description="Representative wind speed [m/s]")
    max_yaw_deg: float = Field(30.0, ge=5.0, le=40.0, description="Max yaw angle [deg]")
    num_directions: int = Field(12, ge=4, le=36, description="Number of wind directions to evaluate")


class DirectionResult(BaseModel):
    """Single wind direction yaw optimization result."""

    wind_direction_deg: float
    baseline_power_mw: float
    optimized_power_mw: float
    power_gain_percent: float
    optimal_yaw_angles_deg: list[float]


class FarmYawOptimizationResponse(BaseModel):
    """Aggregated yaw optimization result across all directions."""

    baseline_aep_gwh: float
    optimized_aep_gwh: float
    aep_gain_percent: float
    mean_power_gain_percent: float
    max_power_gain_percent: float
    best_direction_deg: float
    per_direction_results: list[DirectionResult]


# ── Helpers ──────────────────────────────────────────────────────


def _generate_synthetic_wind(
    weibull_a: float,
    weibull_k: float,
    n_samples: int,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic wind speed and direction arrays.

    Speeds follow a Weibull(a, k) distribution.
    Directions follow a wrapped-normal distribution centered on 240 deg (WSW)
    with 60 deg circular std — typical Polish Baltic Sea.
    """
    rng = np.random.default_rng(seed)

    # Weibull samples: scipy parameterisation → scale=a, shape=k
    speeds = weibull_a * rng.weibull(weibull_k, size=n_samples)
    speeds = np.clip(speeds, 0.0, 40.0)

    # Directional distribution: dominant WSW (240 deg) with moderate spread
    directions = rng.normal(loc=240.0, scale=60.0, size=n_samples) % 360.0

    return speeds.astype(np.float64), directions.astype(np.float64)


def _get_layout(name: str) -> LayoutResult:
    """Retrieve a pre-computed layout by name."""
    if name == "regular":
        return generate_regular_grid()
    elif name == "staggered":
        return generate_staggered_grid()
    else:
        raise DomainValidationError(f"Unknown layout: '{name}'. Valid: regular, staggered")


def _run_wake_for_layout(
    layout: LayoutResult,
    weibull_a: float,
    weibull_k: float,
    ti: float,
) -> WakeAnalysisResult:
    """Run PyWake wake analysis for a layout with given wind parameters."""
    site = create_uniform_site(weibull_a, weibull_k, ti)
    return run_wake_analysis(layout.x_positions, layout.y_positions, site)


@cached(prefix="wake", ttl=300)
def _cached_wake_analysis(
    layout_name: str,
    weibull_a: float,
    weibull_k: float,
    ti: float,
) -> dict[str, object]:
    """Cached wrapper — returns wake result as a dict for Redis storage."""
    layout = _get_layout(layout_name)
    result = _run_wake_for_layout(layout, weibull_a, weibull_k, ti)
    return {
        "gross_aep_gwh": result.gross_aep_gwh,
        "net_aep_gwh": result.net_aep_gwh,
        "wake_loss_percent": result.wake_loss_percent,
        "capacity_factor": result.capacity_factor,
        "per_turbine_aep_gwh": [float(v) for v in result.per_turbine_aep_gwh],
        "per_turbine_wake_loss_percent": [float(v) for v in result.per_turbine_wake_loss_percent],
    }


# ── Endpoints ────────────────────────────────────────────────────


@router.get("/turbine-spec", response_model=TurbineSpecResponse)
async def get_turbine_spec() -> TurbineSpecResponse:
    """Return V236-15.0 MW turbine specification constants."""
    return TurbineSpecResponse(
        rotor_diameter_m=ROTOR_DIAMETER_M,
        hub_height_m=HUB_HEIGHT_M,
        rated_power_kw=RATED_POWER_KW,
        cut_in_speed_ms=CUT_IN_SPEED_MS,
        rated_speed_ms=RATED_SPEED_MS,
        cut_out_speed_ms=CUT_OUT_SPEED_MS,
        num_turbines=34,
    )


@router.post("/weibull-fit", response_model=WeibullFitResponse)
async def weibull_fit(request: WeibullFitRequest) -> WeibullFitResponse:
    """Generate synthetic wind data from Weibull parameters and re-fit.

    Returns histogram bin data and fitted PDF for overlay plotting.
    """
    speeds, _ = _generate_synthetic_wind(request.weibull_a, request.weibull_k, request.num_samples)

    try:
        params = fit_weibull(speeds)
    except ValueError as e:
        raise DomainValidationError(str(e)) from e

    # Histogram for plotting
    bin_edges = np.linspace(0, 30, 31)
    counts, _ = np.histogram(speeds, bins=bin_edges, density=True)
    bin_centres = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    # Fitted PDF overlay
    pdf_values = compute_weibull_pdf(bin_centres, params)

    return WeibullFitResponse(
        fitted_a=round(params.scale_a_ms, 3),
        fitted_k=round(params.shape_k, 3),
        mean_speed_ms=round(params.mean_wind_speed_ms, 2),
        bin_centres=bin_centres.tolist(),
        bin_frequencies=counts.tolist(),
        pdf_values=pdf_values.tolist(),
    )


@router.post("/wind-rose", response_model=WindRoseResponse)
async def wind_rose(request: WindRoseRequest) -> WindRoseResponse:
    """Compute wind rose from synthetic wind data."""
    speeds, directions = _generate_synthetic_wind(
        request.weibull_a, request.weibull_k, request.num_samples
    )

    result = compute_wind_rose(speeds, directions, request.num_sectors)

    # Replace NaN with 0 for JSON serialisation
    mean_speeds = np.nan_to_num(result.mean_speeds_ms, nan=0.0)

    return WindRoseResponse(
        sector_centres_deg=result.sector_centres_deg.tolist(),
        frequencies=result.frequencies.tolist(),
        mean_speeds_ms=mean_speeds.tolist(),
        energy_fractions=result.energy_fractions.tolist(),
        dominant_direction_deg=result.dominant_direction_deg,
        circular_std_deg=round(result.circular_std_deg, 1),
        num_sectors=result.num_sectors,
    )


@router.post("/wake-analysis", response_model=WakeAnalysisResponse)
async def wake_analysis(request: WakeAnalysisRequest) -> WakeAnalysisResponse:
    """Run PyWake BPA Gaussian wake analysis on a layout.

    Returns gross/net AEP with per-turbine breakdown.
    Uses Redis cache (TTL 300s) to avoid recomputing identical requests.
    """
    try:
        result = await _cached_wake_analysis(
            request.layout, request.weibull_a, request.weibull_k, request.turbulence_intensity
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Wake analysis failed: {e}") from e

    return WakeAnalysisResponse(
        gross_aep_gwh=round(result["gross_aep_gwh"], 2),
        net_aep_gwh=round(result["net_aep_gwh"], 2),
        wake_loss_percent=round(result["wake_loss_percent"], 2),
        capacity_factor=round(result["capacity_factor"], 4),
        per_turbine_aep_gwh=[round(float(v), 3) for v in result["per_turbine_aep_gwh"]],
        per_turbine_wake_loss_percent=[
            round(float(v), 2) for v in result["per_turbine_wake_loss_percent"]
        ],
    )


@router.post("/aep-cascade", response_model=AEPCascadeResponse)
async def aep_cascade(request: AEPCascadeRequest) -> AEPCascadeResponse:
    """Compute full gross-to-net AEP cascade with uncertainty.

    Runs wake analysis + blockage estimation, then applies the
    multiplicative loss cascade (wake → blockage → electrical →
    availability → environmental) with P50/P75/P90/P99 exceedance.
    """
    layout = _get_layout(request.layout)

    # Wake analysis
    try:
        wake_result = _run_wake_for_layout(
            layout, request.weibull_a, request.weibull_k, request.turbulence_intensity
        )
    except DomainError:
        raise
    except Exception as e:
        raise DomainError(f"Wake analysis failed: {e}") from e

    # Blockage
    blockage = estimate_blockage_loss_percent(
        num_turbines=layout.num_turbines,
        x_positions=layout.x_positions,
        y_positions=layout.y_positions,
        mean_wind_speed_ms=request.weibull_a * 0.886,  # Approx mean from Weibull A
    )

    # AEP cascade
    cascade = compute_aep_cascade(
        gross_aep_gwh=wake_result.gross_aep_gwh,
        wake_loss_fraction=wake_result.wake_loss_percent / 100.0,
        blockage_loss_fraction=blockage.blockage_loss_percent / 100.0,
        price_eur_mwh=request.price_eur_mwh,
    )

    return AEPCascadeResponse(
        gross_aep_gwh=round(cascade.gross_aep_gwh, 2),
        net_aep_gwh=round(cascade.net_aep_gwh, 2),
        p50_gwh=round(cascade.p50_gwh, 2),
        p75_gwh=round(cascade.p75_gwh, 2),
        p90_gwh=round(cascade.p90_gwh, 2),
        p99_gwh=round(cascade.p99_gwh, 2),
        total_loss_percent=round(cascade.total_loss_percent, 2),
        combined_uncertainty_percent=round(cascade.combined_uncertainty_percent, 2),
        capacity_factor=round(cascade.capacity_factor, 4),
        revenue_meur=round(cascade.revenue_meur, 2),
        loss_factors=[
            LossFactorSchema(
                name=lf.name,
                loss_percent=round(lf.loss_percent, 2),
                uncertainty_percent=round(lf.uncertainty_percent, 2),
            )
            for lf in cascade.loss_factors
        ],
        price_eur_mwh=cascade.price_eur_mwh,
    )


@router.post("/blockage", response_model=BlockageResponse)
async def blockage_estimate(request: BlockageRequest) -> BlockageResponse:
    """Estimate wind farm blockage loss using Nygaard (2020) model."""
    layout = _get_layout(request.layout)

    result = estimate_blockage_loss_percent(
        num_turbines=layout.num_turbines,
        x_positions=layout.x_positions,
        y_positions=layout.y_positions,
        mean_wind_speed_ms=request.mean_wind_speed_ms,
    )

    return BlockageResponse(
        blockage_loss_percent=round(result.blockage_loss_percent, 3),
        array_density=round(result.array_density, 6),
        mean_ct=round(result.mean_ct, 4),
        farm_area_km2=round(result.farm_area_km2, 3),
        method=result.method,
    )


@router.post("/layout-comparison", response_model=LayoutComparisonResponse)
async def layout_comparison(request: LayoutComparisonRequest) -> LayoutComparisonResponse:
    """Compare regular and staggered layouts via full AEP cascade.

    Runs wake analysis + blockage + cascade for each layout and
    identifies the best performer.
    """
    layouts_to_compare = [
        ("regular", generate_regular_grid()),
        ("staggered", generate_staggered_grid()),
    ]

    entries: list[LayoutCascadeEntry] = []

    for name, layout in layouts_to_compare:
        try:
            wake = _run_wake_for_layout(
                layout, request.weibull_a, request.weibull_k, request.turbulence_intensity
            )
        except Exception:
            continue

        blockage = estimate_blockage_loss_percent(
            num_turbines=layout.num_turbines,
            x_positions=layout.x_positions,
            y_positions=layout.y_positions,
            mean_wind_speed_ms=request.weibull_a * 0.886,
        )

        cascade = compute_aep_cascade(
            gross_aep_gwh=wake.gross_aep_gwh,
            wake_loss_fraction=wake.wake_loss_percent / 100.0,
            blockage_loss_fraction=blockage.blockage_loss_percent / 100.0,
            price_eur_mwh=request.price_eur_mwh,
        )

        entries.append(
            LayoutCascadeEntry(
                name=name,
                net_aep_gwh=round(cascade.net_aep_gwh, 2),
                wake_loss_percent=round(wake.wake_loss_percent, 2),
                capacity_factor=round(cascade.capacity_factor, 4),
                revenue_meur=round(cascade.revenue_meur, 2),
                p90_gwh=round(cascade.p90_gwh, 2),
            )
        )

    if not entries:
        raise DomainError("All layout analyses failed")

    best = max(entries, key=lambda e: e.net_aep_gwh)
    worst = min(entries, key=lambda e: e.net_aep_gwh)
    improvement = (
        (best.net_aep_gwh - worst.net_aep_gwh) / worst.net_aep_gwh * 100.0
        if worst.net_aep_gwh > 0
        else 0.0
    )

    return LayoutComparisonResponse(
        layouts=entries,
        best_layout=best.name,
        improvement_percent=round(improvement, 2),
    )


@router.get("/layouts/{name}/positions", response_model=LayoutPositionsResponse)
async def get_layout_positions(name: str) -> LayoutPositionsResponse:
    """Get turbine x/y positions for a named layout."""
    layout = _get_layout(name)

    return LayoutPositionsResponse(
        name=layout.name,
        x_positions=[round(float(v), 1) for v in layout.x_positions],
        y_positions=[round(float(v), 1) for v in layout.y_positions],
        num_turbines=layout.num_turbines,
        min_spacing_m=round(layout.min_spacing_m, 1),
        area_km2=round(layout.area_km2, 3),
    )


# ── Yaw Optimization Endpoints ──────────────────────────────────


@router.post("/yaw-optimization", response_model=YawOptimizationResponse)
async def yaw_optimization(request: YawOptimizationRequest) -> YawOptimizationResponse:
    """Optimize per-turbine yaw angles for wake steering at a single wind direction.

    Wake steering deflects upstream wakes by yawing turbines, increasing
    total farm power by 5-15%. Uses Jiménez deflection model + L-BFGS-B
    optimization to find optimal yaw angles within [-max_yaw, +max_yaw].

    Physics: P_yaw = P_aligned × cos^1.88(γ) — upstream loss is offset by
    downstream wake deflection gain.
    """
    layout = _get_layout(request.layout)
    site = create_uniform_site(request.weibull_a, request.weibull_k, request.turbulence_intensity)

    try:
        result = optimize_yaw_single_direction(
            x_positions_m=layout.x_positions,
            y_positions_m=layout.y_positions,
            wind_direction_deg=request.wind_direction_deg,
            wind_speed_ms=request.wind_speed_ms,
            site=site,
            max_yaw_deg=request.max_yaw_deg,
        )
    except Exception as e:
        raise DomainError(f"Yaw optimization failed: {e}") from e

    return YawOptimizationResponse(
        wind_direction_deg=result.wind_direction_deg,
        baseline_power_mw=result.baseline_power_mw,
        optimized_power_mw=result.optimized_power_mw,
        power_gain_percent=result.power_gain_percent,
        optimal_yaw_angles_deg=[round(float(v), 1) for v in result.optimal_yaw_angles_deg],
        per_turbine_baseline_mw=[round(float(v), 3) for v in result.per_turbine_baseline_mw],
        per_turbine_optimized_mw=[round(float(v), 3) for v in result.per_turbine_optimized_mw],
    )


@router.post("/yaw-optimization-farm", response_model=FarmYawOptimizationResponse)
async def yaw_optimization_farm(
    request: FarmYawOptimizationRequest,
) -> FarmYawOptimizationResponse:
    """Optimize yaw angles across all wind directions and estimate AEP gain.

    Runs per-direction yaw optimization and aggregates results to estimate
    annual energy production improvement from wake steering. This is the
    primary farm-level control optimization — the single most impactful
    operational improvement for offshore wind farms.
    """
    layout = _get_layout(request.layout)
    site = create_uniform_site(request.weibull_a, request.weibull_k, request.turbulence_intensity)
    directions = np.linspace(0, 360 - 360 / request.num_directions, request.num_directions)

    try:
        result = optimize_yaw_all_directions(
            x_positions_m=layout.x_positions,
            y_positions_m=layout.y_positions,
            site=site,
            wind_directions_deg=directions.astype(np.float64),
            wind_speed_ms=request.wind_speed_ms,
            max_yaw_deg=request.max_yaw_deg,
        )
    except Exception as e:
        raise DomainError(f"Farm yaw optimization failed: {e}") from e

    per_dir = [
        DirectionResult(
            wind_direction_deg=r.wind_direction_deg,
            baseline_power_mw=r.baseline_power_mw,
            optimized_power_mw=r.optimized_power_mw,
            power_gain_percent=r.power_gain_percent,
            optimal_yaw_angles_deg=[round(float(v), 1) for v in r.optimal_yaw_angles_deg],
        )
        for r in result.per_direction_results
    ]

    return FarmYawOptimizationResponse(
        baseline_aep_gwh=result.baseline_aep_gwh,
        optimized_aep_gwh=result.optimized_aep_gwh,
        aep_gain_percent=result.aep_gain_percent,
        mean_power_gain_percent=result.mean_power_gain_percent,
        max_power_gain_percent=result.max_power_gain_percent,
        best_direction_deg=result.best_direction_deg,
        per_direction_results=per_dir,
    )


# ── Tier 2 Schemas ────────────────────────────────────────────


class WakeModelComparisonRequest(BaseModel):
    """Request to compare multiple wake deficit models."""

    layout: str = Field("staggered")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    models: list[str] = Field(
        default=["jensen", "bpa_gaussian", "noj", "zong_gaussian"],
        description="Wake deficit models to compare",
    )


class WakeModelResultEntry(BaseModel):
    model_name: str
    net_aep_gwh: float
    wake_loss_percent: float
    capacity_factor: float


class WakeModelComparisonResponse(BaseModel):
    results: list[WakeModelResultEntry]
    aep_range_gwh: float
    wake_loss_range_percent: float


class DeratingRequest(BaseModel):
    layout: str = Field("staggered")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    wind_direction_deg: float = Field(240.0, ge=0.0, lt=360.0)


class DeratingResponse(BaseModel):
    baseline_power_mw: float
    derated_power_mw: float
    power_gain_percent: float
    optimal_derating_fraction: float
    upstream_loss_mw: float
    downstream_gain_mw: float


class FLOWERSRequest(BaseModel):
    layout: str = Field("staggered")
    mean_wind_speed_ms: float = Field(10.5, ge=5.0, le=20.0)
    n_fourier_modes: int = Field(12, ge=4, le=24)


class FLOWERSResponse(BaseModel):
    aep_gwh: float
    gross_aep_gwh: float
    wake_loss_percent: float
    computation_time_ms: float
    capacity_factor: float
    n_fourier_modes: int


class MarketWeightedAEPRequest(BaseModel):
    layout: str = Field("staggered")
    weibull_a: float = Field(10.5, ge=5.0, le=20.0)
    weibull_k: float = Field(2.2, ge=1.0, le=4.0)
    turbulence_intensity: float = Field(0.06, ge=0.02, le=0.20)
    flat_price_eur_mwh: float = Field(72.0, ge=10.0, le=300.0)


class MarketWeightedAEPResponse(BaseModel):
    flat_aep_gwh: float
    market_weighted_aep_gwh: float
    market_value_factor: float
    flat_revenue_meur: float
    market_revenue_meur: float
    revenue_uplift_percent: float
    average_capture_price_eur_mwh: float
    peak_generation_fraction: float


class PCEUQRequest(BaseModel):
    layout: str = Field("staggered")
    pce_order: int = Field(3, ge=1, le=5)
    n_samples: int = Field(30, ge=10, le=100)


class SobolIndexSchema(BaseModel):
    parameter: str
    first_order: float


class PCEUQResponse(BaseModel):
    mean_aep_gwh: float
    std_aep_gwh: float
    cov_percent: float
    p50_gwh: float
    p75_gwh: float
    p90_gwh: float
    dominant_parameter: str
    sobol_indices: list[SobolIndexSchema]
    r_squared: float
    pce_order: int
    num_samples: int


# ── Tier 2 Endpoints ──────────────────────────────────────────


@router.post("/wake-model-comparison", response_model=WakeModelComparisonResponse)
async def wake_model_comparison(request: WakeModelComparisonRequest) -> WakeModelComparisonResponse:
    """Compare multiple wake deficit models on the same layout.

    Models available: jensen (NOJ top-hat), bpa_gaussian (Bastankhah),
    noj (same as Jensen), zong_gaussian (Zong & Porté-Agel LES-based).
    """
    layout = _get_layout(request.layout)
    site = create_uniform_site(request.weibull_a, request.weibull_k, request.turbulence_intensity)
    models = [WakeDeficitModel(m) for m in request.models]

    try:
        result = compare_wake_models(
            layout.x_positions, layout.y_positions, site, models,
        )
    except Exception as e:
        raise DomainError(f"Wake model comparison failed: {e}") from e

    entries = [
        WakeModelResultEntry(
            model_name=name,
            net_aep_gwh=round(r.net_aep_gwh, 2),
            wake_loss_percent=round(r.wake_loss_percent, 2),
            capacity_factor=round(r.capacity_factor, 4),
        )
        for name, r in result.results
    ]

    return WakeModelComparisonResponse(
        results=entries,
        aep_range_gwh=result.aep_range_gwh,
        wake_loss_range_percent=result.wake_loss_range_percent,
    )


@router.post("/derating", response_model=DeratingResponse)
async def derating_analysis(request: DeratingRequest) -> DeratingResponse:
    """Optimize turbine derating for wake mitigation.

    Finds the optimal upstream power reduction that maximizes total farm
    power by weakening wakes for downstream turbines.
    """
    layout = _get_layout(request.layout)
    site = create_uniform_site(request.weibull_a, request.weibull_k, request.turbulence_intensity)

    try:
        result = optimize_derating(
            layout.x_positions, layout.y_positions, site,
            wind_direction_deg=request.wind_direction_deg,
        )
    except Exception as e:
        raise DomainError(f"Derating analysis failed: {e}") from e

    return DeratingResponse(
        baseline_power_mw=result.baseline_power_mw,
        derated_power_mw=result.derated_power_mw,
        power_gain_percent=result.power_gain_percent,
        optimal_derating_fraction=result.optimal_derating_fraction,
        upstream_loss_mw=result.upstream_loss_mw,
        downstream_gain_mw=result.downstream_gain_mw,
    )


@router.post("/flowers-aep", response_model=FLOWERSResponse)
async def flowers_aep(request: FLOWERSRequest) -> FLOWERSResponse:
    """Compute AEP using FLOWERS fast analytical method.

    FLOWERS uses Fourier decomposition of the wind rose to analytically
    integrate wake losses, providing 100-1000× speedup over directional sweeps.
    """
    layout = _get_layout(request.layout)

    try:
        result = compute_flowers_aep(
            layout.x_positions, layout.y_positions,
            mean_wind_speed_ms=request.mean_wind_speed_ms,
            n_fourier_modes=request.n_fourier_modes,
        )
    except Exception as e:
        raise DomainError(f"FLOWERS AEP failed: {e}") from e

    return FLOWERSResponse(
        aep_gwh=result.aep_gwh,
        gross_aep_gwh=result.gross_aep_gwh,
        wake_loss_percent=result.wake_loss_percent,
        computation_time_ms=result.computation_time_ms,
        capacity_factor=result.capacity_factor,
        n_fourier_modes=result.n_fourier_modes,
    )


@router.post("/market-weighted-aep", response_model=MarketWeightedAEPResponse)
async def market_weighted_aep(request: MarketWeightedAEPRequest) -> MarketWeightedAEPResponse:
    """Compute market value-weighted AEP accounting for price-generation correlation.

    Captures the 'cannibalization' effect where wind generation can depress
    spot prices, reducing the effective value of each MWh produced.
    """
    layout = _get_layout(request.layout)
    wake = _run_wake_for_layout(layout, request.weibull_a, request.weibull_k, request.turbulence_intensity)

    # Generate synthetic 8760 hourly profile from average power
    avg_power_mw = wake.net_aep_gwh * 1000.0 / 8760.0
    rng = np.random.default_rng(42)
    hours = np.arange(8760)
    diurnal = 1.0 + 0.1 * np.cos(2 * np.pi * (hours % 24 - 4) / 24.0)
    noise = 1.0 + 0.3 * rng.standard_normal(8760)
    hourly_gen = np.clip(avg_power_mw * diurnal * noise, 0.0, 510.0)

    try:
        result = compute_market_weighted_aep(
            hourly_gen, flat_price_eur_mwh=request.flat_price_eur_mwh,
        )
    except Exception as e:
        raise DomainError(f"Market-weighted AEP failed: {e}") from e

    return MarketWeightedAEPResponse(
        flat_aep_gwh=result.flat_aep_gwh,
        market_weighted_aep_gwh=result.market_weighted_aep_gwh,
        market_value_factor=result.market_value_factor,
        flat_revenue_meur=result.flat_revenue_meur,
        market_revenue_meur=result.market_revenue_meur,
        revenue_uplift_percent=result.revenue_uplift_percent,
        average_capture_price_eur_mwh=result.average_capture_price_eur_mwh,
        peak_generation_fraction=result.peak_generation_fraction,
    )


@router.post("/pce-uncertainty", response_model=PCEUQResponse)
async def pce_uncertainty(request: PCEUQRequest) -> PCEUQResponse:
    """Run Polynomial Chaos Expansion uncertainty quantification on AEP.

    Builds a polynomial surrogate from sampled wake analyses to extract
    statistics (mean, std, Sobol indices) without Monte Carlo sampling.
    """
    layout = _get_layout(request.layout)

    try:
        result = run_pce_uncertainty(
            layout.x_positions, layout.y_positions,
            pce_order=request.pce_order, n_samples=request.n_samples,
        )
    except Exception as e:
        raise DomainError(f"PCE UQ failed: {e}") from e

    return PCEUQResponse(
        mean_aep_gwh=result.mean_aep_gwh,
        std_aep_gwh=result.std_aep_gwh,
        cov_percent=result.cov_percent,
        p50_gwh=result.p50_gwh,
        p75_gwh=result.p75_gwh,
        p90_gwh=result.p90_gwh,
        dominant_parameter=result.dominant_parameter,
        sobol_indices=[
            SobolIndexSchema(parameter=s.parameter, first_order=s.first_order)
            for s in result.sobol_indices
        ],
        r_squared=result.r_squared,
        pce_order=result.pce_order,
        num_samples=result.num_samples,
    )
