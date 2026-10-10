"""
Pydantic schemas for P4 forecasting: the turbine power curve and the day-ahead
forecast trained and scored on real Baltic offshore data.
"""

from __future__ import annotations

from typing import Any

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
    cp_max: float = Field(description="Maximum electrical power coefficient of the table")
    ct_rated: float = Field(description="Thrust coefficient at rated speed")
    drivetrain: str = Field(description='Drivetrain, e.g. "Low speed, Direct drive"')
    min_rotor_rpm: float = Field(description="Minimum rotor speed [rpm]")
    max_rotor_rpm: float = Field(description="Maximum (rated) rotor speed [rpm]")
    source: str = Field(description="Data source of the curve")


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


# ── Real-data day-ahead forecast ─────────────────────────────────


class RealModelScoreSchema(BaseModel):
    """One forecast (or baseline) scored over all TimeSeriesSplit test folds."""

    name: str
    nrmse_pct: float = Field(description="RMSE / installed capacity [%]")
    nmae_pct: float = Field(description="MAE / installed capacity [%]")
    bias_pct: float = Field(description="mean(forecast − actual) / capacity [%]")
    skill_vs_persistence: float = Field(description="1 − MSE / MSE(persistence 24 h)")
    skill_vs_climatology: float = Field(description="1 − MSE / MSE(climatology)")
    crps_pct: float = Field(
        description="CRPS ≈ (2/9)·Σ pinball over P10…P90, / capacity [%]; MAE for a point forecast"
    )
    crpss_vs_climatology: float = Field(description="1 − CRPS / CRPS(climatology quantiles)")
    probabilistic: bool = Field(description="True when the forecast has P10 … P90")
    fold_nrmse_pct: list[float] = Field(description="nRMSE per test fold, oldest first [%]")


class RealReliabilitySchema(BaseModel):
    """Calibration of a quantile forecast on the scored hours."""

    name: str
    observed_below: list[float] = Field(
        description="Share of hours at or below each quantile P10 … P90 (ideal 0.1 … 0.9)"
    )
    p10_p90_coverage_pct: float = Field(description="Actuals inside P10–P90 (ideal 80) [%]")


class RealDataSourceSchema(BaseModel):
    """Provenance of the real data set."""

    site: str
    title: str
    production: str
    nwp: str
    farms: list[str]
    capacity_mw: float
    period_start_utc: str
    period_end_utc: str
    hours: int
    folds: int
    scored_hours: int = Field(description="Test hours on which every forecast is scored")


class RealForecastResponse(BaseModel):
    """Day-ahead forecast of real Baltic offshore production (Energinet DK2 + archived NWP)."""

    source: RealDataSourceSchema
    scores: list[RealModelScoreSchema]
    reliability: list[RealReliabilitySchema]
    p10_p90_coverage_pct: float = Field(description="XGBoost actuals inside P10–P90 [%]")
    feature_importance: list[dict[str, Any]] = Field(
        description="Top features, share of mean |SHAP| of the XGBoost P50"
    )
    series: dict[str, list[Any]] = Field(
        description="Last 14 days of the last test fold: time_utc, actual/p10/p50/p90/"
        "persistence/tso/ensemble [MW] (null = missing), nwp_wind_ms [m/s]"
    )
