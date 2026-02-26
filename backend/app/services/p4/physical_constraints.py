"""
Physical constraint enforcement for ML prediction post-processing.

Every ML model output passes through this module before being returned
to the SCADA system. Guarantees that predictions respect physics.

Physics — Why Constraints Are Non-Negotiable
----------------------------------------------
A wind turbine is a physical machine with hard operating limits:
  - It cannot generate negative power (no motor mode in normal operation)
  - It cannot exceed its generator rating (15.0 MW for V236)
  - Below cut-in wind speed (3.0 m/s), aerodynamic torque is insufficient
    to overcome drivetrain friction — the rotor does not turn
  - Above cut-out wind speed (31.0 m/s), the turbine shuts down via
    blade pitch to feather (90°) to prevent structural damage
  - The total farm output cannot exceed N × P_rated = 34 × 15 = 510 MW

An ML model trained on noisy SCADA data can easily predict physically
impossible values (e.g., -0.3 MW or 15.7 MW). Post-processing clamps
these to physical reality, improving both accuracy and trustworthiness.

Standard — IEC 61400-12-1 Power Performance
---------------------------------------------
The power curve defines the relationship between wind speed and power
output. Predictions outside the valid operating envelope are corrected:
  - Region 1 (v < 3.0 m/s): P must be 0 MW
  - Region 3 (v_rated ≤ v ≤ v_cut_out): P ≤ P_rated (15.0 MW)
  - Region 4 (v > 31.0 m/s): P must be 0 MW

Maths — Constraint Equations
------------------------------
For each turbine i at timestep t:
  C1: P_i(t) = max(P_i(t), 0)           — no negative generation
  C2: P_i(t) = min(P_i(t), P_rated)     — rated power cap
  C3: if v_i(t) < v_cut_in → P_i(t) = 0 — below cut-in
  C4: if v_i(t) > v_cut_out → P_i(t) = 0 — above cut-out
  C5: Σ P_i(t) ≤ N × P_rated            — farm total cap

Constraint priority: C3/C4 override C1/C2 (wind-based rules dominate).

References
----------
- IEC 61400-12-1: Power performance measurements
- IEC 61400-1: Design requirements for wind turbines
- Roadmap §5.9: Physical constraint enforcement layer
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

# ── Constants ─────────────────────────────────────────────────────

DEFAULT_RATED_POWER_MW: float = 15.0
DEFAULT_CUT_IN_MS: float = 3.0
DEFAULT_CUT_OUT_MS: float = 31.0
DEFAULT_NUM_TURBINES: int = 34
DEFAULT_FARM_CAPACITY_MW: float = DEFAULT_NUM_TURBINES * DEFAULT_RATED_POWER_MW  # 510


# ── Enums ─────────────────────────────────────────────────────────


class ConstraintType(StrEnum):
    """Types of physical constraints that can be violated."""

    NEGATIVE_POWER = "negative_power"
    ABOVE_RATED = "above_rated"
    BELOW_CUT_IN = "below_cut_in"
    ABOVE_CUT_OUT = "above_cut_out"
    FARM_TOTAL = "farm_total"


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class ConstraintViolation:
    """Record of a single constraint violation that was corrected.

    Attributes
    ----------
    constraint : ConstraintType
        Which physical constraint was violated.
    index : int
        Timestep index where the violation occurred.
    original_value : float
        The ML prediction before correction [MW].
    corrected_value : float
        The physically valid value after correction [MW].
    """

    constraint: ConstraintType
    index: int
    original_value: float
    corrected_value: float


@dataclass(frozen=True)
class ConstraintResult:
    """Result of constraint enforcement on a power prediction array.

    Attributes
    ----------
    power_mw : NDArray[np.float64]
        Corrected power values [MW].
    violations : list[ConstraintViolation]
        All violations that were detected and corrected.
    total_violations : int
        Count of corrected values.
    original_energy_mwh : float
        Sum of original predictions (for comparison).
    corrected_energy_mwh : float
        Sum of corrected predictions.
    """

    power_mw: NDArray[np.float64]
    violations: list[ConstraintViolation]
    total_violations: int
    original_energy_mwh: float
    corrected_energy_mwh: float


# ── Enforcement Functions ─────────────────────────────────────────


def enforce_physical_constraints(
    power_mw: NDArray[np.float64],
    wind_speed_ms: NDArray[np.float64] | None = None,
    rated_power_mw: float = DEFAULT_RATED_POWER_MW,
    cut_in_ms: float = DEFAULT_CUT_IN_MS,
    cut_out_ms: float = DEFAULT_CUT_OUT_MS,
) -> ConstraintResult:
    """Enforce physical constraints on a single-turbine power prediction.

    Applied in order: C1 (non-negative) → C2 (rated cap) → C3/C4 (wind-based).
    Wind-based constraints override power-based constraints.

    Parameters
    ----------
    power_mw : NDArray[np.float64]
        Raw ML predictions for one turbine [MW].
    wind_speed_ms : NDArray[np.float64], optional
        Concurrent wind speed measurements [m/s].
        If None, wind-based constraints (C3, C4) are skipped.
    rated_power_mw : float
        Maximum rated power [MW].
    cut_in_ms : float
        Cut-in wind speed [m/s].
    cut_out_ms : float
        Cut-out wind speed [m/s].

    Returns
    -------
    ConstraintResult
        Corrected predictions with violation log.
    """
    corrected = power_mw.copy().astype(np.float64)
    violations: list[ConstraintViolation] = []
    original_sum = float(np.sum(power_mw))

    # C1: No negative generation
    neg_mask = corrected < 0.0
    for idx in np.where(neg_mask)[0]:
        violations.append(
            ConstraintViolation(
                constraint=ConstraintType.NEGATIVE_POWER,
                index=int(idx),
                original_value=float(corrected[idx]),
                corrected_value=0.0,
            )
        )
    corrected[neg_mask] = 0.0

    # C2: Above rated cap
    over_mask = corrected > rated_power_mw
    for idx in np.where(over_mask)[0]:
        violations.append(
            ConstraintViolation(
                constraint=ConstraintType.ABOVE_RATED,
                index=int(idx),
                original_value=float(power_mw[idx]),
                corrected_value=rated_power_mw,
            )
        )
    corrected[over_mask] = rated_power_mw

    # C3 & C4: Wind-speed-based constraints (override C1/C2)
    if wind_speed_ms is not None:
        below_cut_in = wind_speed_ms < cut_in_ms
        above_cut_out = wind_speed_ms > cut_out_ms

        for idx in np.where(below_cut_in & (corrected > 0.0))[0]:
            violations.append(
                ConstraintViolation(
                    constraint=ConstraintType.BELOW_CUT_IN,
                    index=int(idx),
                    original_value=float(power_mw[idx]),
                    corrected_value=0.0,
                )
            )
        corrected[below_cut_in] = 0.0

        for idx in np.where(above_cut_out & (corrected > 0.0))[0]:
            violations.append(
                ConstraintViolation(
                    constraint=ConstraintType.ABOVE_CUT_OUT,
                    index=int(idx),
                    original_value=float(power_mw[idx]),
                    corrected_value=0.0,
                )
            )
        corrected[above_cut_out] = 0.0

    corrected_sum = float(np.sum(corrected))

    return ConstraintResult(
        power_mw=corrected,
        violations=violations,
        total_violations=len(violations),
        original_energy_mwh=original_sum,
        corrected_energy_mwh=corrected_sum,
    )


def enforce_farm_constraints(
    power_per_turbine_mw: NDArray[np.float64],
    wind_speeds_ms: NDArray[np.float64] | None = None,
    rated_power_mw: float = DEFAULT_RATED_POWER_MW,
    cut_in_ms: float = DEFAULT_CUT_IN_MS,
    cut_out_ms: float = DEFAULT_CUT_OUT_MS,
    num_turbines: int = DEFAULT_NUM_TURBINES,
) -> list[ConstraintResult]:
    """Enforce physical constraints across all farm turbines.

    Applies per-turbine constraints first, then validates that the
    total farm output does not exceed N × P_rated.

    Parameters
    ----------
    power_per_turbine_mw : NDArray[np.float64]
        Shape (timesteps, num_turbines). Raw ML predictions [MW].
    wind_speeds_ms : NDArray[np.float64], optional
        Shape (timesteps, num_turbines). Wind speeds [m/s].
    rated_power_mw : float
        Per-turbine rated power [MW].
    cut_in_ms : float
        Cut-in wind speed [m/s].
    cut_out_ms : float
        Cut-out wind speed [m/s].
    num_turbines : int
        Number of turbines in the farm.

    Returns
    -------
    list[ConstraintResult]
        One ConstraintResult per turbine.
    """
    farm_capacity = num_turbines * rated_power_mw
    results: list[ConstraintResult] = []

    for t in range(power_per_turbine_mw.shape[1]):
        ws = wind_speeds_ms[:, t] if wind_speeds_ms is not None else None
        result = enforce_physical_constraints(
            power_mw=power_per_turbine_mw[:, t],
            wind_speed_ms=ws,
            rated_power_mw=rated_power_mw,
            cut_in_ms=cut_in_ms,
            cut_out_ms=cut_out_ms,
        )
        results.append(result)

    # C5: Farm total constraint — scale down proportionally if exceeded
    corrected_all = np.column_stack([r.power_mw for r in results])
    farm_totals = np.sum(corrected_all, axis=1)
    over_cap = farm_totals > farm_capacity

    if np.any(over_cap):
        for t_idx in np.where(over_cap)[0]:
            scale = farm_capacity / farm_totals[t_idx]
            for turb_idx in range(corrected_all.shape[1]):
                corrected_all[t_idx, turb_idx] *= scale

        # Rebuild results with scaled values
        rebuilt: list[ConstraintResult] = []
        for t in range(corrected_all.shape[1]):
            orig = results[t]
            rebuilt.append(
                ConstraintResult(
                    power_mw=corrected_all[:, t],
                    violations=orig.violations,
                    total_violations=orig.total_violations,
                    original_energy_mwh=orig.original_energy_mwh,
                    corrected_energy_mwh=float(np.sum(corrected_all[:, t])),
                )
            )
        return rebuilt

    return results
