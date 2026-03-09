"""Pydantic schemas for Digital Twin endpoints.

Request and response models for the digital twin condition monitoring system:
- Scenario selection and analysis configuration
- Farm and turbine health summaries
- Anomaly classification results
- Twin vs actual comparison data for visualization
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Request Schemas ───────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    """Request to run digital twin analysis for a scenario."""

    scenario: str = Field(
        default="healthy",
        description=(
            "Scenario name: healthy, blade_icing, gearbox_degradation,"
            " pitch_malfunction, generator_derating, sensor_drift"
        ),
    )
    num_timesteps: int = Field(
        default=144,
        ge=10,
        le=1000,
        description="Number of 10-minute intervals (144 = 24 hours)",
    )
    num_turbines: int = Field(
        default=34,
        ge=1,
        le=34,
        description="Number of turbines to simulate",
    )
    seed: int = Field(
        default=42,
        ge=0,
        description="Random seed for reproducibility",
    )


class SingleTurbineRequest(BaseModel):
    """Request to analyze a single turbine at one operating point."""

    wind_speed_ms: float = Field(ge=0.0, le=35.0, description="Wind speed [m/s]")
    wind_dir_deg: float = Field(default=0.0, ge=0.0, le=360.0, description="Wind direction [deg]")
    actual_power_mw: float = Field(ge=0.0, le=20.0, description="Measured power output [MW]")


# ── Response Schemas ──────────────────────────────────────────────


class TurbineHealthSchema(BaseModel):
    """Health assessment for one turbine."""

    turbine_id: int = Field(description="Turbine index (0-33)")
    turbine_name: str = Field(description="Turbine name (WTG-01 to WTG-34)")
    health_power: float = Field(description="Power channel health [0-100%]")
    health_rpm: float = Field(description="Rotor speed channel health [0-100%]")
    health_pitch: float = Field(description="Pitch channel health [0-100%]")
    health_composite: float = Field(description="Weighted composite health [0-100%]")
    status: str = Field(description="Status: healthy, degraded, critical")
    anomaly_count: int = Field(description="Number of anomalies detected")


class AnomalySchema(BaseModel):
    """Single anomaly detection record."""

    turbine_id: int = Field(description="Turbine index (0-33)")
    timestep: int = Field(description="Timestep index")
    category: str = Field(description="Anomaly category")
    severity: str = Field(description="Severity: low, medium, high")
    description: str = Field(description="Human-readable description")
    power_ewma_pct: float = Field(description="Power EWMA residual [%]")
    rpm_ewma_pct: float = Field(description="RPM EWMA residual [%]")
    pitch_ewma_pct: float = Field(description="Pitch EWMA residual [%]")


class DegradationTrendSchema(BaseModel):
    """Health degradation trend for one turbine over time."""

    turbine_id: int = Field(description="Turbine index")
    turbine_name: str = Field(description="Turbine name")
    health_values: list[float] = Field(description="Health composite over time [%]")
    slope_pct_per_day: float = Field(description="Degradation rate [% per day]")
    rul_days: float | None = Field(
        default=None,
        description="Remaining useful life estimate [days] (null if healthy)",
    )


class TwinComparisonSchema(BaseModel):
    """Twin vs actual comparison data for visualization."""

    timestamps: list[int] = Field(description="Unix timestamps")
    wind_speed_ms: list[float] = Field(description="Wind speed at turbine [m/s]")
    actual_power_mw: list[float] = Field(description="Measured power [MW]")
    twin_power_mw: list[float] = Field(description="Twin predicted power [MW]")
    residual_mw: list[float] = Field(description="Power residual [MW]")
    residual_pct: list[float] = Field(description="Power residual [%]")
    power_ewma: list[float] = Field(description="EWMA-smoothed power residual [%]")


class FarmHealthSummarySchema(BaseModel):
    """Farm-level health summary."""

    farm_health_pct: float = Field(description="Average farm health [0-100%]")
    healthy_count: int = Field(description="Number of healthy turbines")
    degraded_count: int = Field(description="Number of degraded turbines")
    critical_count: int = Field(description="Number of critical turbines")
    worst_turbine_id: int = Field(description="Index of worst-performing turbine")
    worst_turbine_name: str = Field(description="Name of worst-performing turbine")
    total_anomalies: int = Field(description="Total anomalies detected across farm")


class AnalyzeResponse(BaseModel):
    """Complete digital twin analysis response."""

    scenario: str = Field(description="Scenario that was analyzed")
    num_timesteps: int = Field(description="Number of timesteps analyzed")
    num_turbines: int = Field(description="Number of turbines analyzed")
    farm_health: FarmHealthSummarySchema
    turbine_health: list[TurbineHealthSchema]
    anomalies: list[AnomalySchema]
    degradation_trends: list[DegradationTrendSchema]
    comparison_data: TwinComparisonSchema


class ScenarioInfo(BaseModel):
    """Scenario metadata for the UI."""

    name: str = Field(description="Scenario identifier")
    description: str = Field(description="Human-readable description")


class DigitalTwinConfigResponse(BaseModel):
    """Digital twin module configuration."""

    health_weights: dict[str, float] = Field(description="Channel weights for composite health")
    health_thresholds: dict[str, float] = Field(description="Status thresholds")
    sigma_baselines: dict[str, float] = Field(description="Baseline noise floors")
    ewma_span: int = Field(description="EWMA smoothing span (10-min intervals)")
    available_scenarios: list[str] = Field(description="Valid scenario names")


class SingleTurbineResponse(BaseModel):
    """Response for single turbine analysis."""

    wind_speed_ms: float
    wind_dir_deg: float
    actual_power_mw: float
    twin_power_mw: float
    residual_mw: float
    residual_pct: float
    health_composite: float
    status: str
