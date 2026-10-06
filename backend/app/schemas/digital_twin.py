"""Pydantic schemas for the Digital Twin endpoints (/api/v1/digital-twin).

Units are part of every field name or description. Time is Unix seconds (UTC).
Channel order everywhere: power, rotor_speed, pitch, gearbox_temp, anemometer.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ScenarioName = Literal[
    "healthy",
    "rotor_icing",
    "pitch_misalignment",
    "converter_derating",
    "gearbox_degradation",
    "anemometer_drift",
    "combined",
]
FaultKindName = Literal[
    "aero_efficiency", "pitch_offset", "power_limit", "gearbox_loss", "anemometer_gain"
]
ChannelName = Literal["power", "rotor_speed", "pitch", "gearbox_temp", "anemometer"]
StatusName = Literal["normal", "alert", "alarm"]


# ── Requests ──────────────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    scenario: ScenarioName = Field(default="combined", description="Fault scenario")
    duration_days: int = Field(default=7, ge=1, le=30, description="Analysis window [days]")
    seed: int = Field(default=42, ge=0, le=2**31 - 1, description="Random seed")


class TurbineDetailRequest(AnalyzeRequest):
    turbine_id: int = Field(ge=0, le=33, description="Turbine index (0 = WTG-01)")


class OperatingPointRequest(BaseModel):
    wind_speed_ms: float = Field(ge=0.0, le=40.0, description="Measured wind speed [m/s]")
    air_density: float = Field(default=1.225, ge=1.0, le=1.5, description="Air density [kg/m³]")
    power_mw: float = Field(ge=0.0, le=16.0, description="Measured active power [MW]")
    rotor_speed_rpm: float | None = Field(default=None, ge=0.0, le=12.0)
    pitch_deg: float | None = Field(default=None, ge=-5.0, le=95.0)


# ── Model card ────────────────────────────────────────────────────


class ChannelCard(BaseModel):
    key: ChannelName
    label: str
    unit: str
    logical_node: str = Field(description="IEC 61400-25-2 logical node class")
    sigma_floor: float = Field(description="Minimum σ (sensor resolution) [unit]")
    acf_factor: float = Field(description="EWMAST autocorrelation variance factor κ [-]")
    lag1_autocorr: float = Field(description="Lag-1 autocorrelation of z on Phase I data [-]")
    rmse: float = Field(description="Twin RMSE on fault-free data [unit]")
    bias: float = Field(description="Twin mean residual on fault-free data [unit]")
    samples: int


class FaultModeCard(BaseModel):
    kind: FaultKindName
    label: str
    category: str
    parameter: str
    unit: str
    nominal: float
    search_min: float
    search_max: float
    advisory: str
    references: list[str]
    prognosis_limit: float | None
    prognosis_limit_note: str | None


class ScenarioInjection(BaseModel):
    kind: FaultKindName
    label: str
    turbines: list[str]
    severity: list[float]
    unit: str
    onset_fraction: float
    ramp_fraction: float
    end_fraction: float | None


class ScenarioInfo(BaseModel):
    name: ScenarioName
    title: str
    description: str
    injections: list[ScenarioInjection]
    cold_spell: tuple[float, float] | None


class StandardRef(BaseModel):
    code: str
    title: str
    role: str


class ModelCardResponse(BaseModel):
    turbine: dict[str, float | str]
    aero_calibration: dict[str, float]
    thermal_model: dict[str, float | str]
    measurement_model: dict[str, float | str] = Field(
        description="Assumptions of the synthetic plant (simulation only)"
    )
    detector: dict[str, float | int | str]
    phase_one: dict[str, float | int]
    channels: list[ChannelCard]
    fault_library: list[FaultModeCard]
    scenarios: list[ScenarioInfo]
    standards: list[StandardRef]


class ReferenceCurveResponse(BaseModel):
    wind_ms: list[float]
    power_mw: list[float]
    rotor_speed_rpm: list[float]
    pitch_deg: list[float]
    tip_speed_ratio: list[float]
    cp: list[float]
    gearbox_loss_kw: list[float]
    region: list[int]
    region_names: dict[int, str]
    p1_table_power_mw: list[float] = Field(
        description="Legacy V236 approximate table (former P1 curve), for validation"
    )
    max_deviation_vs_p1_mw: float
    max_deviation_vs_p1_above_6ms_mw: float


# ── Analysis ──────────────────────────────────────────────────────


class HypothesisSchema(BaseModel):
    kind: FaultKindName
    severity: float
    cost: float
    explained: float = Field(description="Fraction of no-fault cost removed [0-1]")
    posterior: float = Field(description="Equal-prior posterior weight [0-1]")


class DiagnosisSchema(BaseModel):
    kind: FaultKindName | None = Field(description="null = detected but unexplained")
    label: str
    category: str | None
    severity: float | None
    unit: str | None
    posterior: float
    explained: float
    lr_statistic: float
    cause_hint: str
    advisory: str | None
    window_start: int
    window_end: int
    samples_used: int
    mean_ambient_c: float
    mean_humidity_pct: float
    hypotheses: list[HypothesisSchema]


class PrognosisSchema(BaseModel):
    kind: FaultKindName
    limit: float
    limit_note: str
    current: float | None
    slope_per_day: float
    slope_std_error: float
    p_value: float
    significant: bool
    rul_days: float | None
    rul_lower_days: float | None
    rul_upper_days: float | None
    points: int
    status: Literal["trend", "no_trend", "limit_exceeded", "insufficient_data"]


class TurbineSummary(BaseModel):
    turbine_id: int
    name: str
    status: StatusName
    health_index: float = Field(description="Health index at the last sample [0-100]")
    channel_health: dict[str, float]
    worst_channel: ChannelName
    event_count: int
    active_event_count: int
    first_detection: int | None = Field(description="Unix time of first confirmed event")
    last_evidence: int | None = Field(description="Unix time the latest event ended (or now)")
    diagnosis: DiagnosisSchema | None
    prognosis: PrognosisSchema | None
    actual_energy_mwh: float
    potential_energy_mwh: float
    lost_energy_mwh: float = Field(description="Potential − actual if a fault was identified")


class EventSchema(BaseModel):
    turbine_id: int
    turbine_name: str
    channel: ChannelName
    level: Literal["alert", "alarm"]
    direction: Literal["high", "low"]
    onset: int
    confirmed: int
    end: int | None
    peak_u: float = Field(description="Peak |EWMA| / control limit [-]")
    diagnosis: FaultKindName | None


class ValidationRowSchema(BaseModel):
    turbine_id: int
    turbine_name: str
    injected_kind: FaultKindName
    injected_severity: float
    final_severity: float
    unit: str
    onset: int
    detected: bool
    detection: int | None
    delay_hours: float | None
    diagnosed_kind: FaultKindName | None
    isolation_correct: bool
    estimated_severity: float | None


class ValidationSchema(BaseModel):
    rows: list[ValidationRowSchema]
    injected: int
    detected: int
    isolated: int
    false_events: int
    mean_delay_hours: float | None


class FarmSummary(BaseModel):
    fleet_health_index: float = Field(description="Mean turbine health index [0-100]")
    min_health_index: float
    normal_count: int
    alert_count: int
    alarm_count: int
    diagnosed_count: int
    active_events: int
    total_events: int
    actual_energy_mwh: float
    potential_energy_mwh: float
    lost_energy_mwh: float = Field(description="Lost to identified (non-sensor) faults")
    energy_performance_pct: float = Field(description="Actual / twin-potential energy [%]")


class HealthTrend(BaseModel):
    timestamps: list[int] = Field(description="Hourly, end of hour")
    health: list[list[float]] = Field(description="Per turbine: worst HI inside each hour")


class AmbientSeries(BaseModel):
    timestamps: list[int]
    temperature_c: list[float]
    humidity_pct: list[float]
    farm_wind_ms: list[float] = Field(description="Median measured wind across turbines")


class AnalyzeResponse(BaseModel):
    scenario: ScenarioName
    title: str
    duration_days: int
    seed: int
    start: int
    sample_period_s: int
    num_samples: int
    farm: FarmSummary
    turbines: list[TurbineSummary]
    events: list[EventSchema]
    health_trend: HealthTrend
    ambient: AmbientSeries
    validation: ValidationSchema


class ChannelSeries(BaseModel):
    key: ChannelName
    label: str
    unit: str
    logical_node: str
    measured: list[float]
    expected: list[float]
    ewma: list[float] = Field(description="EWMA of standardised residual [σ units]")
    limit: list[float] = Field(description="Control limit [σ units]")
    valid: list[bool]


class SeverityPointSchema(BaseModel):
    time: int
    severity: float
    std_error: float
    samples: int


class TruthSeries(BaseModel):
    kind: FaultKindName
    unit: str
    values: list[float]


class TurbineDetailResponse(BaseModel):
    turbine: TurbineSummary
    timestamps: list[int]
    wind_ms: list[float]
    channels: list[ChannelSeries]
    health: list[float]
    in_event: list[bool]
    severity_trend: list[SeverityPointSchema]
    truth: list[TruthSeries] = Field(description="Injected fault parameter (simulation only)")
    power_curve_wind_ms: list[float]
    power_curve_mw: list[float]


class OperatingPointResponse(BaseModel):
    region: str
    expected_power_mw: float
    expected_rotor_speed_rpm: float
    expected_pitch_deg: float
    power_residual_mw: float
    power_z: float | None
    rotor_speed_residual_rpm: float | None
    rotor_speed_z: float | None
    pitch_residual_deg: float | None
    pitch_z: float | None
