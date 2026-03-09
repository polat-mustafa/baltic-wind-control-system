"""P4 sub-router: SCADA generation, quality filtering, features, and constraints."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from app.schemas.forecast import (
    ConstraintCheckRequest,
    ConstraintCheckResponse,
    ConstraintViolationSchema,
    FeatureEngineeringRequest,
    FeatureEngineeringResponse,
    GenerateSCADARequest,
    QualityFilterRequest,
    QualityFilterResponse,
    QualityFlagSchema,
    SCADADatasetSummary,
)
from app.services.p4.feature_engineering import FeatureConfig, engineer_features
from app.services.p4.physical_constraints import enforce_physical_constraints
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.scada_quality_filters import apply_all_quality_filters

router = APIRouter()


# ── SCADA Generation ─────────────────────────────────────────────


@router.post("/generate-scada", response_model=SCADADatasetSummary)
async def generate_scada(request: GenerateSCADARequest) -> SCADADatasetSummary:
    """Generate synthetic SCADA dataset for the wind farm."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        weibull_a=request.weibull_a,
        weibull_k=request.weibull_k,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    # Compute status counts
    unique, counts = np.unique(dataset.status, return_counts=True)
    status_counts = dict(zip(unique.tolist(), counts.tolist(), strict=True))

    return SCADADatasetSummary(
        num_turbines=config.num_turbines,
        num_timesteps=config.num_timesteps,
        total_data_points=config.num_turbines * config.num_timesteps,
        wind_speed_mean_ms=round(float(np.mean(dataset.wind_speed_ms)), 2),
        wind_speed_max_ms=round(float(np.max(dataset.wind_speed_ms)), 2),
        power_mean_mw=round(float(np.mean(dataset.power_mw)), 2),
        power_max_mw=round(float(np.max(dataset.power_mw)), 2),
        status_counts=status_counts,
        start_timestamp=int(dataset.timestamps[0]),
        end_timestamp=int(dataset.timestamps[-1]),
    )


# ── Quality Filtering ────────────────────────────────────────────


@router.post("/quality-filter", response_model=QualityFilterResponse)
async def run_quality_filters(
    request: QualityFilterRequest,
) -> QualityFilterResponse:
    """Run 5 quality filters on synthetic SCADA data."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    sample_flags = [
        QualityFlagSchema(
            filter_type=f.filter_type.value,
            turbine_index=f.turbine_index,
            timestep_index=f.timestep_index,
            reason=f.reason,
        )
        for f in result.flags[:50]
    ]

    return QualityFilterResponse(
        total_points=result.total_points,
        total_flagged=result.total_flagged,
        availability_pct=result.availability_pct,
        counts_by_filter=result.counts_by_filter,
        sample_flags=sample_flags,
    )


# ── Feature Engineering ──────────────────────────────────────────


@router.post("/features", response_model=FeatureEngineeringResponse)
async def run_feature_engineering(
    request: FeatureEngineeringRequest,
) -> FeatureEngineeringResponse:
    """Run feature engineering pipeline on filtered SCADA data."""
    config = SCADAConfig(
        num_turbines=request.num_turbines,
        num_timesteps=request.num_timesteps,
        seed=request.seed,
    )
    dataset = generate_scada_dataset(config)

    # Apply quality filters first
    filter_result = apply_all_quality_filters(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        status=dataset.status,
        temperature=dataset.temperature_c,
        humidity=dataset.humidity_pct,
    )

    # Run feature engineering
    turbine_idx = min(request.turbine_index, request.num_turbines - 1)
    features = engineer_features(
        wind_speed=dataset.wind_speed_ms,
        power=dataset.power_mw,
        wind_direction=dataset.wind_direction_deg,
        temperature=dataset.temperature_c,
        pressure=dataset.pressure_pa,
        humidity=dataset.humidity_pct,
        timestamps=dataset.timestamps,
        clean_mask=filter_result.clean_mask,
        turbine_index=turbine_idx,
        config=FeatureConfig(),
    )

    return FeatureEngineeringResponse(
        feature_names=features.feature_names,
        num_features=len(features.feature_names),
        valid_timesteps=features.valid_timesteps,
        dropped_timesteps=features.dropped_timesteps,
        sample_row=features.feature_matrix[0].tolist() if features.valid_timesteps > 0 else [],
    )


# ── Constraint Enforcement ───────────────────────────────────────


@router.post("/check-constraints", response_model=ConstraintCheckResponse)
async def check_constraints(
    request: ConstraintCheckRequest,
) -> ConstraintCheckResponse:
    """Test physical constraint enforcement on predictions."""
    predictions = np.array(request.predictions_mw, dtype=np.float64)
    wind_speeds = (
        np.array(request.wind_speeds_ms, dtype=np.float64)
        if request.wind_speeds_ms is not None
        else None
    )

    result = enforce_physical_constraints(
        power_mw=predictions,
        wind_speed_ms=wind_speeds,
    )

    violations = [
        ConstraintViolationSchema(
            constraint=v.constraint.value,
            index=v.index,
            original_value=round(v.original_value, 4),
            corrected_value=round(v.corrected_value, 4),
        )
        for v in result.violations
    ]

    return ConstraintCheckResponse(
        corrected_mw=[round(float(v), 4) for v in result.power_mw],
        total_violations=result.total_violations,
        violations=violations,
        original_energy_mwh=round(result.original_energy_mwh, 4),
        corrected_energy_mwh=round(result.corrected_energy_mwh, 4),
    )
