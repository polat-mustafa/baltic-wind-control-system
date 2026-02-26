"""
Pydantic schemas for P4 Machine Learning forecasting pipeline.

Request and response models for power curve generation, SCADA data
synthesis, quality filtering, feature engineering, and physical
constraint enforcement.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Power Curve Schemas ───────────────────────────────────────────


class TurbineSpecSchema(BaseModel):
    """Turbine specification response."""

    name: str = Field(description="Turbine model name")
    rotor_diameter_m: float = Field(description="Rotor diameter [m]")
    hub_height_m: float = Field(description="Hub height [m]")
    rated_power_mw: float = Field(description="Rated power [MW]")
    cut_in_speed_ms: float = Field(description="Cut-in wind speed [m/s]")
    rated_speed_ms: float = Field(description="Rated wind speed [m/s]")
    cut_out_speed_ms: float = Field(description="Cut-out wind speed [m/s]")
    num_blades: int = Field(description="Number of rotor blades")
    cp_max: float = Field(description="Maximum power coefficient")
    ct_rated: float = Field(description="Thrust coefficient at rated speed")


class PowerCurveRequest(BaseModel):
    """Request to generate a power curve."""

    wind_step_ms: float = Field(
        default=0.5,
        ge=0.1,
        le=2.0,
        description="Wind speed bin width [m/s]. IEC 61400-12-1 default: 0.5",
    )
    air_density_kg_m3: float | None = Field(
        default=None,
        ge=0.8,
        le=1.6,
        description="Air density [kg/m³]. Default: 1.225 (standard conditions)",
    )


class PowerCurveResponse(BaseModel):
    """Power curve generation response."""

    spec: TurbineSpecSchema
    wind_speeds_ms: list[float] = Field(description="Wind speed array [m/s]")
    power_mw: list[float] = Field(description="Power output array [MW]")
    ct: list[float] = Field(description="Thrust coefficient array [-]")
    swept_area_m2: float = Field(description="Rotor swept area [m²]")
    air_density_kg_m3: float = Field(description="Air density used [kg/m³]")
    num_points: int = Field(description="Number of data points in the curve")


# ── SCADA Generation Schemas ─────────────────────────────────────


class GenerateSCADARequest(BaseModel):
    """Request to generate synthetic SCADA data."""

    num_turbines: int = Field(
        default=34,
        ge=1,
        le=100,
        description="Number of turbines in the farm",
    )
    num_timesteps: int = Field(
        default=52_560,
        ge=100,
        le=525_600,
        description="Number of 10-minute intervals (52560 = 1 year)",
    )
    weibull_a: float = Field(
        default=10.5,
        ge=3.0,
        le=20.0,
        description="Weibull scale parameter [m/s]",
    )
    weibull_k: float = Field(
        default=2.2,
        ge=1.0,
        le=4.0,
        description="Weibull shape parameter [-]",
    )
    seed: int | None = Field(
        default=42,
        description="Random seed for reproducibility",
    )


class SCADADatasetSummary(BaseModel):
    """Summary of a generated SCADA dataset (not the full arrays)."""

    num_turbines: int = Field(description="Number of turbines")
    num_timesteps: int = Field(description="Number of 10-minute intervals")
    total_data_points: int = Field(description="Total data points (turbines x steps)")
    wind_speed_mean_ms: float = Field(description="Mean wind speed [m/s]")
    wind_speed_max_ms: float = Field(description="Max wind speed [m/s]")
    power_mean_mw: float = Field(description="Mean power output [MW]")
    power_max_mw: float = Field(description="Max power output [MW]")
    status_counts: dict[str, int] = Field(description="Count per operational status")
    start_timestamp: int = Field(description="First timestamp (Unix seconds)")
    end_timestamp: int = Field(description="Last timestamp (Unix seconds)")


# ── Quality Filter Schemas ────────────────────────────────────────


class QualityFilterRequest(BaseModel):
    """Request to run quality filters on SCADA data."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    seed: int | None = Field(default=42)


class QualityFlagSchema(BaseModel):
    """A single quality flag."""

    filter_type: str = Field(description="Filter category that flagged this point")
    turbine_index: int = Field(description="Turbine column index")
    timestep_index: int = Field(description="Timestep row index")
    reason: str = Field(description="Human-readable explanation")


class QualityFilterResponse(BaseModel):
    """Quality filter pipeline response."""

    total_points: int = Field(description="Total data points in dataset")
    total_flagged: int = Field(description="Number of flagged (excluded) points")
    availability_pct: float = Field(description="Clean data percentage (target: 85-92%)")
    counts_by_filter: dict[str, int] = Field(description="Flags per filter type")
    sample_flags: list[QualityFlagSchema] = Field(description="Sample of quality flags (first 50)")


# ── Feature Engineering Schemas ───────────────────────────────────


class FeatureEngineeringRequest(BaseModel):
    """Request to run feature engineering pipeline."""

    num_turbines: int = Field(default=34, ge=1, le=100)
    num_timesteps: int = Field(default=52_560, ge=100, le=525_600)
    turbine_index: int = Field(default=0, ge=0, description="Which turbine to process")
    seed: int | None = Field(default=42)


class FeatureEngineeringResponse(BaseModel):
    """Feature engineering pipeline response."""

    feature_names: list[str] = Field(description="Column names for feature matrix")
    num_features: int = Field(description="Number of engineered features")
    valid_timesteps: int = Field(description="Rows in final feature matrix")
    dropped_timesteps: int = Field(description="Rows dropped (NaN from lags/rolling)")
    sample_row: list[float] = Field(description="First row of the feature matrix")


# ── Constraint Check Schemas ─────────────────────────────────────


class ConstraintCheckRequest(BaseModel):
    """Request to test physical constraint enforcement."""

    predictions_mw: list[float] = Field(
        description="Raw ML power predictions [MW]",
        min_length=1,
    )
    wind_speeds_ms: list[float] | None = Field(
        default=None,
        description="Concurrent wind speed measurements [m/s]",
    )


class ConstraintViolationSchema(BaseModel):
    """A single constraint violation record."""

    constraint: str = Field(description="Constraint type violated")
    index: int = Field(description="Timestep index")
    original_value: float = Field(description="Original prediction [MW]")
    corrected_value: float = Field(description="Corrected value [MW]")


class ConstraintCheckResponse(BaseModel):
    """Constraint enforcement response."""

    corrected_mw: list[float] = Field(description="Corrected power predictions [MW]")
    total_violations: int = Field(description="Number of violations corrected")
    violations: list[ConstraintViolationSchema] = Field(description="Violation details")
    original_energy_mwh: float = Field(description="Sum of original predictions")
    corrected_energy_mwh: float = Field(description="Sum of corrected predictions")
