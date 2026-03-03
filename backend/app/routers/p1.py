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
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.cache import cached

from app.services.p1.aep_calculator import (
    DEFAULT_PRICE_EUR_MWH,
    compute_aep_cascade,
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
        raise HTTPException(
            status_code=400,
            detail=f"Unknown layout: '{name}'. Valid: regular, staggered",
        )


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
) -> dict:
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
        raise HTTPException(status_code=422, detail=str(e)) from e

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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Wake analysis failed: {e}",
        ) from e

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Wake analysis failed: {e}") from e

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
        raise HTTPException(status_code=500, detail="All layout analyses failed")

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
