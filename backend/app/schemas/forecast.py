"""
Pydantic schemas for P4 forecasting: the day-ahead forecast trained and scored on
real Baltic offshore data.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


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
