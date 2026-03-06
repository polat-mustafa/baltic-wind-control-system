"""Scenario generator — 6 educational demo scenarios + orchestrator pipeline.

Physics Layer
─────────────
Each scenario injects a known fault into the synthetic SCADA data, allowing
students to see how the digital twin detects and classifies it:

1. healthy — baseline with no faults (residuals ≈ 0, health ≈ 100%)
2. blade_icing — WTG-05..08 lose 20-40% power (aerodynamic)
3. gearbox_degradation — WTG-12 loses 5% efficiency over 30 days (mechanical)
4. pitch_malfunction — WTG-20 pitch stuck at 5° (control)
5. generator_derating — WTG-28 capped at 12 MW (electrical)
6. sensor_drift — WTG-15 anemometer reads 8% high (sensor)

Standards Layer
───────────────
- ISO 13374-1: Full Level 1-5 pipeline (data → detection → assessment → prognosis)
- IEC 61400-25: SCADA data model defines the channels we monitor

Maths Layer
───────────
The pipeline runs:
1. Generate SCADA data (SCADAConfig → generate_scada_dataset)
2. Inject scenario-specific faults
3. Build twin lookup table for fast prediction
4. For each turbine: compute residuals → health scores → classify anomalies
5. Aggregate into farm-level summary

Code Layer
──────────
Imports from existing modules — zero physics duplication:
- turbine_physics/simulator.py → run_simulation (via twin_engine)
- p4/scada_generator.py → generate_scada_dataset
- p4/turbine_power_curve.py → get_v236_spec
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.digital_twin.anomaly_classification import (
    AnomalyRecord,
    classify_anomalies,
)
from app.services.digital_twin.health_scoring import (
    TurbineHealthScore,
    compute_farm_health,
    compute_health_score,
    compute_health_timeseries,
)
from app.services.digital_twin.residual_analysis import (
    ResidualResult,
    compute_residuals,
)
from app.services.digital_twin.twin_engine import (
    build_twin_lookup_table,
    lookup_twin_prediction,
)
from app.services.p4.scada_generator import SCADAConfig, generate_scada_dataset
from app.services.p4.turbine_power_curve import get_v236_spec

# ── Scenario Registry ────────────────────────────────────────────

SCENARIO_DESCRIPTIONS: dict[str, str] = {
    "healthy": "Baseline — no injected faults. All turbines healthy (residuals ≈ 0%).",
    "blade_icing": "WTG-05 to WTG-08 experience 20-40% power loss from blade icing.",
    "gearbox_degradation": "WTG-12 progressive 5% efficiency loss (simulating 30-day wear).",
    "pitch_malfunction": "WTG-20 pitch stuck at 5° — can't feather above rated wind.",
    "generator_derating": "WTG-28 generator capped at 12 MW (80% of rated).",
    "sensor_drift": "WTG-15 anemometer reading 8% high — apparent overperformance.",
}

VALID_SCENARIOS = set(SCENARIO_DESCRIPTIONS.keys())


# ── Data containers ──────────────────────────────────────────────


@dataclass
class TurbineAnalysis:
    """Complete digital twin analysis for one turbine."""

    turbine_id: int
    turbine_name: str
    residuals: ResidualResult
    health_timeseries: list[TurbineHealthScore]
    final_health: TurbineHealthScore
    anomalies: list[AnomalyRecord]


@dataclass
class DigitalTwinResult:
    """Complete digital twin analysis for the whole farm."""

    scenario: str
    num_timesteps: int
    num_turbines: int
    farm_health: dict[str, int | float]
    turbine_analyses: list[TurbineAnalysis]
    # Comparison data for the selected/worst turbine
    comparison_wind: list[float]
    comparison_actual_power: list[float]
    comparison_twin_power: list[float]
    comparison_timestamps: list[int]


# ── Fault injection ──────────────────────────────────────────────


def _inject_blade_icing(
    power: NDArray[np.float64],
    rng: np.random.Generator,
) -> None:
    """Inject blade icing on WTG-05 to WTG-08 (indices 4-7).

    Icing reduces aerodynamic efficiency by 20-40% — ice accumulation
    on blade leading edges disrupts the airfoil profile.
    """
    for turb_idx in range(4, 8):
        loss_factor = rng.uniform(0.6, 0.8)  # 20-40% loss
        power[:, turb_idx] *= loss_factor


def _inject_gearbox_degradation(
    power: NDArray[np.float64],
    num_timesteps: int,
    rng: np.random.Generator,
) -> None:
    """Inject progressive gearbox degradation on WTG-12 (index 11).

    Efficiency drops linearly from 100% to 95% over the analysis period,
    simulating bearing wear or gear tooth damage.
    """
    turb_idx = 11
    degradation = np.linspace(1.0, 0.95, num_timesteps)
    # Add some noise to the degradation
    noise = rng.normal(1.0, 0.005, num_timesteps)
    power[:, turb_idx] *= degradation * noise


def _inject_pitch_malfunction(
    power: NDArray[np.float64],
    wind_speed: NDArray[np.float64],
) -> None:
    """Inject pitch stuck at 5° on WTG-20 (index 19).

    When pitch is stuck, the turbine can't feather blades above rated
    wind → power drops because the controller can't regulate properly.
    Above rated wind: power loss of ~15-25% because blade angle is wrong.
    """
    turb_idx = 19
    spec = get_v236_spec()

    # Above rated wind, pitch should increase. If stuck at 5°, power drops.
    above_rated = wind_speed[:, turb_idx] > spec.rated_speed_ms
    # Power penalty proportional to how far above rated
    excess_wind = np.maximum(wind_speed[:, turb_idx] - spec.rated_speed_ms, 0.0)
    penalty = 1.0 - 0.02 * excess_wind  # ~2% per m/s above rated
    penalty = np.clip(penalty, 0.6, 1.0)
    power[above_rated, turb_idx] *= penalty[above_rated]


def _inject_generator_derating(
    power: NDArray[np.float64],
) -> None:
    """Inject generator derating on WTG-28 (index 27).

    Generator output capped at 12 MW (80% of rated 15 MW).
    This simulates a generator winding fault or thermal protection.
    """
    turb_idx = 27
    power[:, turb_idx] = np.minimum(power[:, turb_idx], 12.0)


def _inject_sensor_drift(
    wind_speed: NDArray[np.float64],
) -> None:
    """Inject anemometer drift on WTG-15 (index 14).

    Anemometer reads 8% high. Since the SCADA reports this inflated wind
    speed, the twin predicts more power than actual → positive power residual
    (actual appears to outperform because wind is lower than reported).
    """
    turb_idx = 14
    wind_speed[:, turb_idx] *= 1.08


# ── Orchestrator pipeline ────────────────────────────────────────


def run_digital_twin_analysis(
    scenario: str = "healthy",
    num_timesteps: int = 144,
    num_turbines: int = 34,
    seed: int = 42,
) -> DigitalTwinResult:
    """Run the complete digital twin analysis pipeline.

    Pipeline:
    1. Generate synthetic SCADA data (baseline)
    2. Inject scenario-specific faults
    3. Build twin lookup table for fast prediction
    4. For each turbine: twin prediction → residual → health → classify
    5. Aggregate farm-level health
    6. Identify worst turbine for detailed comparison

    Args:
        scenario: One of VALID_SCENARIOS.
        num_timesteps: Number of 10-minute intervals (default 144 = 24 hours).
        num_turbines: Number of turbines (default 34).
        seed: Random seed for reproducibility.

    Returns:
        DigitalTwinResult with complete analysis for all turbines.
    """
    if scenario not in VALID_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Valid: {sorted(VALID_SCENARIOS)}")

    rng = np.random.default_rng(seed)

    # ── Step 1: Generate baseline SCADA data ────────────────────
    scada_config = SCADAConfig(
        num_turbines=num_turbines,
        num_timesteps=num_timesteps,
        curtailment_rate=0.0,  # No random anomalies for clean demo
        maintenance_rate=0.0,
        frozen_anemometer_rate=0.0,
        overpower_rate=0.0,
        icing_rate=0.0,
        seed=seed,
    )
    scada = generate_scada_dataset(scada_config)

    # Make mutable copies for fault injection
    actual_power = scada.power_mw.copy()
    actual_wind = scada.wind_speed_ms.copy()

    # ── Step 2: Inject scenario faults ──────────────────────────
    if scenario == "blade_icing":
        _inject_blade_icing(actual_power, rng)
    elif scenario == "gearbox_degradation":
        _inject_gearbox_degradation(actual_power, num_timesteps, rng)
    elif scenario == "pitch_malfunction":
        _inject_pitch_malfunction(actual_power, actual_wind)
    elif scenario == "generator_derating":
        _inject_generator_derating(actual_power)
    elif scenario == "sensor_drift":
        _inject_sensor_drift(actual_wind)
    # "healthy" → no injection

    # ── Step 3: Build twin lookup table ─────────────────────────
    # Use a simplified approach: run twin at each wind speed
    # (direction doesn't matter much for power prediction)
    table = build_twin_lookup_table()

    # ── Step 4: Per-turbine analysis ────────────────────────────
    turbine_analyses: list[TurbineAnalysis] = []
    final_scores: list[TurbineHealthScore] = []

    for turb_idx in range(num_turbines):
        turb_name = f"WTG-{turb_idx + 1:02d}"

        # Get twin predictions for this turbine's wind conditions
        twin_power = np.zeros(num_timesteps, dtype=np.float64)
        twin_rpm = np.zeros(num_timesteps, dtype=np.float64)
        twin_pitch = np.zeros(num_timesteps, dtype=np.float64)

        for t in range(num_timesteps):
            pred = lookup_twin_prediction(
                table,
                float(actual_wind[t, turb_idx]),
                float(scada.wind_direction_deg[t, turb_idx]),
            )
            twin_power[t] = pred.power_mw
            twin_rpm[t] = pred.rotor_speed_rpm
            twin_pitch[t] = pred.pitch_angle_deg

        # Estimate actual rpm/pitch from power ratio (simplified)
        # In a real system these come from SCADA; here we derive them
        safe_twin = np.where(twin_power > 0.1, twin_power, 1.0)
        power_ratio = np.where(
            twin_power > 0.1,
            actual_power[:, turb_idx] / safe_twin,
            1.0,
        )
        actual_rpm = twin_rpm * np.sqrt(np.clip(power_ratio, 0.1, 2.0))
        actual_pitch = twin_pitch * (1.0 + rng.normal(0, 0.02, num_timesteps))

        # Compute residuals
        residuals = compute_residuals(
            actual_power_mw=actual_power[:, turb_idx],
            actual_rpm=actual_rpm,
            actual_pitch_deg=actual_pitch,
            twin_power_mw=twin_power,
            twin_rpm=twin_rpm,
            twin_pitch_deg=twin_pitch,
        )

        # Health timeseries
        health_ts = compute_health_timeseries(residuals)
        final_health = health_ts[-1] if health_ts else compute_health_score(0, 0, 0)

        # Anomaly classification
        anomalies = classify_anomalies(
            turbine_id=turb_idx,
            power_ewma=residuals.power_ewma,
            rpm_ewma=residuals.rpm_ewma,
            pitch_ewma=residuals.pitch_ewma,
        )

        analysis = TurbineAnalysis(
            turbine_id=turb_idx,
            turbine_name=turb_name,
            residuals=residuals,
            health_timeseries=health_ts,
            final_health=final_health,
            anomalies=anomalies,
        )
        turbine_analyses.append(analysis)
        final_scores.append(final_health)

    # ── Step 5: Farm-level summary ──────────────────────────────
    farm_health = compute_farm_health(final_scores)

    # ── Step 6: Comparison data for worst turbine ───────────────
    worst_idx = min(range(num_turbines), key=lambda i: final_scores[i].health_composite)

    comparison_wind = actual_wind[:, worst_idx].tolist()
    comparison_actual = actual_power[:, worst_idx].tolist()

    # Twin predictions for the worst turbine
    comp_twin: list[float] = []
    for t in range(num_timesteps):
        pred = lookup_twin_prediction(
            table,
            float(actual_wind[t, worst_idx]),
            float(scada.wind_direction_deg[t, worst_idx]),
        )
        comp_twin.append(pred.power_mw)

    return DigitalTwinResult(
        scenario=scenario,
        num_timesteps=num_timesteps,
        num_turbines=num_turbines,
        farm_health=farm_health,
        turbine_analyses=turbine_analyses,
        comparison_wind=comparison_wind,
        comparison_actual_power=comparison_actual,
        comparison_twin_power=comp_twin,
        comparison_timestamps=scada.timestamps[:num_timesteps].tolist(),
    )
