"""
Helix control — active wake mixing via individual pitch cycling.

Physics
-------
Helix control (also called "dynamic wake mixing" or "helix wake steering")
uses periodic individual pitch control (IPC) to deliberately excite helical
wake structures. By cycling the blade pitch sinusoidally at a frequency
related to the rotational speed, the wake develops a helical instability
that enhances mixing with the ambient flow, recovering wake velocity faster
than natural turbulent mixing alone.

The helix excitation signal for blade j (of 3 blades) at time t:
    Δβ_j(t) = A_helix × sin(Ω_rotor × t + 2πj/3 + φ_helix)

where:
    A_helix = pitch amplitude [deg], typically 1-3°
    Ω_rotor = rotor angular velocity [rad/s]
    φ_helix = phase offset for clockwise/counter-clockwise helix

The helix mode excites the m=1 wake instability mode, which is the most
energetic mixing mode. Counter-rotating helical modes (CW and CCW) can
be combined for even faster mixing.

Power Impact
-------------
- Upstream turbine: small power loss (~1-3%) from non-optimal pitch
- Downstream turbines: power gain (5-15%) from faster wake recovery
- Net farm gain: typically 1-5% depending on spacing and wind conditions

Comparison with Yaw Steering
------------------------------
- Yaw steering: deflects wake laterally, no mixing enhancement
- Helix control: doesn't deflect, but accelerates wake recovery
- Combined: potential for complementary effects

References
----------
- Frederik, J.A. et al. (2020). Helix approach: wake mixing via dynamic
  individual pitch control. Wind Energy Science, 5, 1065-1088.
- Taschner, E. et al. (2023). Dynamic individual pitch control for enhanced
  wake mixing — experiments and validation.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    RATED_SPEED_MS,
    ROTOR_DIAMETER_M,
)

# ── Helix Constants ─────────────────────────────────────────────

DEFAULT_HELIX_AMPLITUDE_DEG: float = 2.0
"""Default helix pitch amplitude [degrees]."""

DEFAULT_ROTOR_RPM: float = 7.5
"""Nominal rotor speed for V236-15.0 MW [RPM]."""

WAKE_RECOVERY_ENHANCEMENT: float = 1.5
"""Factor by which helix control enhances wake recovery rate [-]."""

UPSTREAM_POWER_PENALTY_FRACTION: float = 0.02
"""Power loss on helix-active turbine as fraction of rated [-]."""


@dataclass(frozen=True)
class HelixPitchSignal:
    """Individual pitch signal for helix control on a single blade.

    Attributes
    ----------
    blade_index : int
        Blade number (0, 1, 2).
    time_s : NDArray
        Time vector [seconds].
    pitch_offset_deg : NDArray
        Pitch offset signal [degrees]. Added to nominal collective pitch.
    """

    blade_index: int
    time_s: NDArray[np.floating]
    pitch_offset_deg: NDArray[np.floating]


@dataclass(frozen=True)
class HelixControlResult:
    """Result of helix control analysis for a wind farm.

    Attributes
    ----------
    baseline_farm_power_mw : float
        Farm power without helix control [MW].
    helix_farm_power_mw : float
        Farm power with helix control [MW].
    power_gain_percent : float
        Net farm power gain [%].
    helix_amplitude_deg : float
        Applied pitch amplitude [degrees].
    helix_frequency_hz : float
        Helix excitation frequency [Hz].
    upstream_power_loss_mw : float
        Power lost by helix-active turbines [MW].
    downstream_power_gain_mw : float
        Power gained by downstream turbines [MW].
    n_helix_active_turbines : int
        Number of turbines running helix control.
    per_turbine_baseline_mw : NDArray
        Per-turbine power without helix [MW].
    per_turbine_helix_mw : NDArray
        Per-turbine power with helix [MW].
    pitch_signals : list[HelixPitchSignal]
        Pitch signals for one helix-active turbine (3 blades).
    wake_recovery_distance_d : float
        Wake recovery distance with helix [rotor diameters].
    natural_recovery_distance_d : float
        Natural wake recovery distance [rotor diameters].
    """

    baseline_farm_power_mw: float
    helix_farm_power_mw: float
    power_gain_percent: float
    helix_amplitude_deg: float
    helix_frequency_hz: float
    upstream_power_loss_mw: float
    downstream_power_gain_mw: float
    n_helix_active_turbines: int
    per_turbine_baseline_mw: NDArray[np.floating]
    per_turbine_helix_mw: NDArray[np.floating]
    pitch_signals: list[HelixPitchSignal] = field(default_factory=list)
    wake_recovery_distance_d: float = 0.0
    natural_recovery_distance_d: float = 0.0


def generate_helix_pitch_signal(
    duration_s: float = 60.0,
    dt_s: float = 0.1,
    amplitude_deg: float = DEFAULT_HELIX_AMPLITUDE_DEG,
    rotor_rpm: float = DEFAULT_ROTOR_RPM,
    clockwise: bool = True,
) -> list[HelixPitchSignal]:
    """Generate 3-blade helix pitch signals.

    Parameters
    ----------
    duration_s : float
        Signal duration [seconds]. Default: 60.
    dt_s : float
        Time step [seconds]. Default: 0.1.
    amplitude_deg : float
        Pitch amplitude [degrees]. Default: 2.0.
    rotor_rpm : float
        Rotor speed [RPM]. Default: 7.5.
    clockwise : bool
        True for clockwise helix, False for counter-clockwise.

    Returns
    -------
    list[HelixPitchSignal]
        Pitch signals for 3 blades.
    """
    omega = rotor_rpm * 2.0 * math.pi / 60.0  # rad/s (1P frequency)
    t = np.arange(0, duration_s, dt_s)
    direction = 1.0 if clockwise else -1.0

    signals = []
    for blade in range(3):
        phase = direction * 2.0 * math.pi * blade / 3.0
        pitch = amplitude_deg * np.sin(omega * t + phase)
        signals.append(
            HelixPitchSignal(
                blade_index=blade,
                time_s=t.astype(np.float64),
                pitch_offset_deg=np.round(pitch, 3).astype(np.float64),
            )
        )

    return signals


def _compute_wake_recovery_distance(
    turbulence_intensity: float,
    helix_active: bool,
) -> float:
    """Estimate wake recovery distance in rotor diameters.

    Natural recovery: x_95 ≈ 10-15D depending on TI
    With helix: recovery enhanced by factor ~1.5

    Parameters
    ----------
    turbulence_intensity : float
        Ambient TI [-].
    helix_active : bool
        Whether helix control is active.

    Returns
    -------
    float
        Distance to 95% velocity recovery [rotor diameters].
    """
    # Higher TI = faster natural recovery
    base_recovery_d = 15.0 - 50.0 * turbulence_intensity  # 15D at TI=0, 10D at TI=0.10
    base_recovery_d = max(8.0, min(15.0, base_recovery_d))

    if helix_active:
        return base_recovery_d / WAKE_RECOVERY_ENHANCEMENT

    return base_recovery_d


def simulate_helix_control(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_direction_deg: float = 240.0,
    wind_speed_ms: float = 10.0,
    turbulence_intensity: float = 0.06,
    helix_amplitude_deg: float = DEFAULT_HELIX_AMPLITUDE_DEG,
    baseline_wake_loss_per_row_pct: float | None = None,
) -> HelixControlResult:
    """Simulate helix control effect on farm power.

    Uses a simplified analytical model: helix control on upstream turbines
    reduces wake deficit on downstream turbines by enhancing mixing.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    wind_direction_deg : float
        Wind direction [degrees]. Default: 240.
    wind_speed_ms : float
        Wind speed [m/s]. Default: 10.0.
    turbulence_intensity : float
        Ambient TI [-]. Default: 0.06.
    helix_amplitude_deg : float
        Helix pitch amplitude [degrees]. Default: 2.0.
    baseline_wake_loss_per_row_pct : float, optional
        Wake loss per row [%]. Default: estimated from spacing.

    Returns
    -------
    HelixControlResult
        Baseline vs helix-enhanced power comparison.
    """
    n = len(x_positions_m)

    # Identify upstream/downstream rows based on wind direction
    wind_rad = np.radians(wind_direction_deg)
    projected = x_positions_m * np.sin(wind_rad) + y_positions_m * np.cos(wind_rad)

    # Sort turbines by position along wind direction
    order = np.argsort(projected)
    sorted_proj = projected[order]

    # Assign row indices (turbines within 0.5D are same row)
    row_idx = np.zeros(n, dtype=int)
    current_row = 0
    for i in range(1, n):
        if sorted_proj[i] - sorted_proj[i - 1] > 0.5 * ROTOR_DIAMETER_M:
            current_row += 1
        row_idx[i] = current_row
    n_rows = current_row + 1

    # Map back to original indices
    turbine_rows = np.zeros(n, dtype=int)
    turbine_rows[order] = row_idx

    # Baseline wake loss model: each row downstream loses more
    if baseline_wake_loss_per_row_pct is None:
        # Typical: ~3-5% additional loss per row at 5D spacing
        avg_spacing = np.mean(np.diff(np.sort(np.unique(sorted_proj))))
        spacing_d = avg_spacing / ROTOR_DIAMETER_M if avg_spacing > 0 else 5.0
        baseline_wake_loss_per_row_pct = max(1.0, 8.0 - 0.8 * spacing_d)

    # Compute per-turbine power (rated at given wind speed)
    from app.services.p1.wake_model import get_v236_power_curve_kw

    ws = np.array([wind_speed_ms])
    rated_kw = float(get_v236_power_curve_kw(ws)[0])
    rated_mw = rated_kw / 1000.0

    # Baseline power: each row has cumulative wake loss
    baseline_mw = np.zeros(n)
    for i in range(n):
        row = turbine_rows[i]
        loss_frac = 1.0 - (baseline_wake_loss_per_row_pct / 100.0) * row
        loss_frac = max(0.3, loss_frac)
        baseline_mw[i] = rated_mw * loss_frac

    # Helix control: activate on front half of rows
    helix_rows = set(range(n_rows // 2))
    is_helix_active = np.array([turbine_rows[i] in helix_rows for i in range(n)])
    n_helix = int(np.sum(is_helix_active))

    # Helix effect: upstream turbines lose power, downstream gain
    helix_mw = baseline_mw.copy()

    # Upstream penalty — above rated speed, blade pitch is already active
    # for power limiting, so helix IPC perturbation has less relative impact
    pitch_activity_factor = min(1.0, wind_speed_ms / RATED_SPEED_MS)
    penalty_mw = rated_mw * UPSTREAM_POWER_PENALTY_FRACTION * pitch_activity_factor
    helix_mw[is_helix_active] -= penalty_mw

    # Downstream benefit: wake recovery enhanced by WAKE_RECOVERY_ENHANCEMENT
    # This means downstream turbines see less wake deficit
    downstream_mask = ~is_helix_active
    enhancement_factor = 1.0 - 1.0 / WAKE_RECOVERY_ENHANCEMENT
    for i in range(n):
        if downstream_mask[i]:
            row = turbine_rows[i]
            wake_loss = rated_mw - baseline_mw[i]
            recovery = wake_loss * enhancement_factor * 0.5
            helix_mw[i] += recovery

    baseline_total = float(np.sum(baseline_mw))
    helix_total = float(np.sum(helix_mw))
    gain_pct = (
        (helix_total - baseline_total) / baseline_total * 100.0 if baseline_total > 0 else 0.0
    )

    upstream_loss = float(np.sum(baseline_mw[is_helix_active] - helix_mw[is_helix_active]))
    downstream_gain = float(np.sum(helix_mw[downstream_mask] - baseline_mw[downstream_mask]))

    # Generate pitch signals for visualization
    omega_rpm = DEFAULT_ROTOR_RPM
    helix_freq = omega_rpm / 60.0  # 1P frequency
    pitch_signals = generate_helix_pitch_signal(
        amplitude_deg=helix_amplitude_deg,
        rotor_rpm=omega_rpm,
    )

    natural_recovery = _compute_wake_recovery_distance(turbulence_intensity, False)
    helix_recovery = _compute_wake_recovery_distance(turbulence_intensity, True)

    return HelixControlResult(
        baseline_farm_power_mw=round(baseline_total, 3),
        helix_farm_power_mw=round(helix_total, 3),
        power_gain_percent=round(gain_pct, 2),
        helix_amplitude_deg=helix_amplitude_deg,
        helix_frequency_hz=round(helix_freq, 3),
        upstream_power_loss_mw=round(upstream_loss, 3),
        downstream_power_gain_mw=round(downstream_gain, 3),
        n_helix_active_turbines=n_helix,
        per_turbine_baseline_mw=np.round(baseline_mw, 3),
        per_turbine_helix_mw=np.round(helix_mw, 3),
        pitch_signals=pitch_signals,
        wake_recovery_distance_d=round(helix_recovery, 1),
        natural_recovery_distance_d=round(natural_recovery, 1),
    )
