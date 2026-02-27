"""Ramp event detection and grid stability alerting for P4 forecasting.

Detects rapid power changes (ramp events) that threaten grid stability
using three complementary methods:
1. Threshold: ΔP/Δt > configurable MW/hr (simple, primary)
2. Wavelet: scipy CWT multi-scale ramp extraction
3. Regime: gradient-based state classifier {calm, ramp_up, ramp_down}

Grid alerts connect P4 forecasting to P2 (STATCOM) and P3 (SCADA)
by flagging FRT risk when large ramp-downs approach the farm's
reactive compensation limits.

References:
    - Roadmap §5.7–5.12: Ramp detection and grid alerts
    - IEC 61400-26-3: Power variability assessment
    - PSE IRiESP: Grid code ramp rate limits
    - Cutler et al. (2007): Wind power ramp event detection methods
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────

# SCADA resolution
TIMESTEP_MINUTES: int = 10
STEPS_PER_HOUR: int = 60 // TIMESTEP_MINUTES  # 6

# Default ramp threshold: 50 MW change per hour (farm-level)
DEFAULT_RAMP_THRESHOLD_MW_HR: float = 50.0

# Wavelet scales for multi-resolution analysis
# Scale 1 = ~10 min, scale 6 = ~1 hr, scale 36 = ~6 hr
DEFAULT_WAVELET_SCALES: tuple[int, ...] = (3, 6, 12, 24)

# Grid alert thresholds (% of farm capacity = 510 MW)
FARM_CAPACITY_MW: float = 510.0
ALERT_WARNING_PCT: float = 0.10  # 10% = 51 MW
ALERT_CRITICAL_PCT: float = 0.20  # 20% = 102 MW
ALERT_EMERGENCY_PCT: float = 0.40  # 40% = 204 MW

# Regime detection: minimum gradient for ramp classification
DEFAULT_CALM_THRESHOLD_MW_HR: float = 10.0


# ── Enums ─────────────────────────────────────────────────────────


class RampDirection(StrEnum):
    """Direction of a ramp event."""

    UP = "ramp_up"
    DOWN = "ramp_down"


class RampSeverity(StrEnum):
    """Severity classification for ramp events."""

    MINOR = "minor"  # < 10% capacity
    MODERATE = "moderate"  # 10–20% capacity
    SEVERE = "severe"  # 20–40% capacity
    EXTREME = "extreme"  # > 40% capacity


class RegimeState(StrEnum):
    """Operating regime classification."""

    CALM = "calm"
    RAMP_UP = "ramp_up"
    RAMP_DOWN = "ramp_down"


class AlertLevel(StrEnum):
    """Grid stability alert level."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


# ── Dataclasses ───────────────────────────────────────────────────


@dataclass(frozen=True)
class RampConfig:
    """Configuration for ramp detection.

    Attributes:
        threshold_mw_hr: power change rate threshold [MW/hr]
        wavelet_scales: CWT scales for multi-resolution analysis
        calm_threshold_mw_hr: gradient below this → calm regime
        min_ramp_duration_steps: minimum steps for a ramp event
    """

    threshold_mw_hr: float = DEFAULT_RAMP_THRESHOLD_MW_HR
    wavelet_scales: tuple[int, ...] = DEFAULT_WAVELET_SCALES
    calm_threshold_mw_hr: float = DEFAULT_CALM_THRESHOLD_MW_HR
    min_ramp_duration_steps: int = 2


@dataclass(frozen=True)
class RampEvent:
    """A detected ramp event.

    Attributes:
        start_index: first timestep index of the ramp
        end_index: last timestep index (inclusive)
        direction: up or down
        magnitude_mw: total power change [MW]
        rate_mw_hr: power change rate [MW/hr]
        duration_minutes: event duration [min]
        severity: classified severity level
        detection_method: which method detected it
    """

    start_index: int
    end_index: int
    direction: RampDirection
    magnitude_mw: float
    rate_mw_hr: float
    duration_minutes: int
    severity: RampSeverity
    detection_method: str


@dataclass(frozen=True)
class RampDetectionResult:
    """Result of ramp detection analysis.

    Attributes:
        events: list of detected ramp events
        num_ramp_up: count of upward ramps
        num_ramp_down: count of downward ramps
        max_ramp_rate_mw_hr: peak ramp rate observed
        regime_states: per-step regime classification
    """

    events: list[RampEvent]
    num_ramp_up: int
    num_ramp_down: int
    max_ramp_rate_mw_hr: float
    regime_states: list[str]


@dataclass(frozen=True)
class GridStabilityAlert:
    """Grid stability alert triggered by a ramp event.

    Connects P4 forecasting to P2 (STATCOM/reactive) and P3 (SCADA/control).

    Attributes:
        alert_level: severity (info/warning/critical/emergency)
        ramp_event: the triggering ramp event
        message: human-readable alert description
        recommended_action: suggested operator/automated response
        statcom_action: recommended STATCOM mode change
        pse_notification: whether PSE TSO must be notified
    """

    alert_level: AlertLevel
    ramp_event: RampEvent
    message: str
    recommended_action: str
    statcom_action: str
    pse_notification: bool


# ── Helper Functions ──────────────────────────────────────────────


def _classify_severity(magnitude_mw: float) -> RampSeverity:
    """Classify ramp severity based on magnitude relative to farm capacity."""
    pct = abs(magnitude_mw) / FARM_CAPACITY_MW
    if pct >= ALERT_EMERGENCY_PCT:
        return RampSeverity.EXTREME
    if pct >= ALERT_CRITICAL_PCT:
        return RampSeverity.SEVERE
    if pct >= ALERT_WARNING_PCT:
        return RampSeverity.MODERATE
    return RampSeverity.MINOR


def _compute_gradient_mw_hr(
    power_mw: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Compute power gradient in MW/hr using central differences.

    Uses numpy gradient which applies central differences in the interior
    and one-sided differences at boundaries.

    Returns array of same length as input.
    """
    # np.gradient returns rate of change per step; multiply by steps/hour
    grad_per_step = np.gradient(power_mw)
    return grad_per_step * STEPS_PER_HOUR


# ── Detection Method 1: Threshold ─────────────────────────────────


def detect_ramps_threshold(
    power_mw: NDArray[np.float64],
    config: RampConfig | None = None,
) -> list[RampEvent]:
    """Detect ramp events using a simple rate-of-change threshold.

    Primary detection method. Flags any window where |ΔP/Δt| exceeds
    the configured MW/hr threshold. Consecutive above-threshold steps
    are merged into single events.

    Args:
        power_mw: farm total power forecast [MW], shape (n_steps,)
        config: ramp detection configuration

    Returns:
        List of detected RampEvent objects.
    """
    if config is None:
        config = RampConfig()

    power_mw = np.asarray(power_mw, dtype=np.float64)
    gradient = _compute_gradient_mw_hr(power_mw)

    events: list[RampEvent] = []
    n = len(power_mw)
    i = 0

    while i < n:
        if abs(gradient[i]) >= config.threshold_mw_hr:
            # Start of potential ramp — find the end
            start = i
            while i < n and abs(gradient[i]) >= config.threshold_mw_hr:
                i += 1
            end = i - 1

            # Check minimum duration
            duration_steps = end - start + 1
            if duration_steps >= config.min_ramp_duration_steps:
                magnitude = float(power_mw[end] - power_mw[start])
                direction = RampDirection.UP if magnitude > 0 else RampDirection.DOWN
                duration_min = duration_steps * TIMESTEP_MINUTES
                rate = abs(magnitude) / (duration_min / 60.0) if duration_min > 0 else 0.0

                events.append(
                    RampEvent(
                        start_index=start,
                        end_index=end,
                        direction=direction,
                        magnitude_mw=round(abs(magnitude), 2),
                        rate_mw_hr=round(rate, 2),
                        duration_minutes=duration_min,
                        severity=_classify_severity(magnitude),
                        detection_method="threshold",
                    )
                )
        else:
            i += 1

    logger.info(
        "Threshold detection: %d ramps found (threshold=%.1f MW/hr)",
        len(events),
        config.threshold_mw_hr,
    )
    return events


# ── Wavelet Helpers (no scipy.signal.cwt dependency) ──────────────


def _ricker_wavelet(points: int, scale: float) -> NDArray[np.float64]:
    """Ricker (Mexican hat) wavelet.

    ψ(t) = (2 / (√3σ π^(1/4))) × (1 - (t/σ)²) × exp(-t²/(2σ²))

    Simplified normalised form for CWT convolution.
    """
    a = float(scale)
    vec = np.arange(-points // 2, points // 2 + 1, dtype=np.float64)
    tsq = (vec / a) ** 2
    mod = 1.0 - tsq
    gauss = np.exp(-tsq / 2.0)
    total = mod * gauss
    # Normalise to unit energy
    norm = np.sqrt(a)
    return total / norm


def _cwt_ricker(
    data: NDArray[np.float64],
    scales: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Continuous Wavelet Transform using Ricker wavelet.

    Replaces deprecated scipy.signal.cwt (removed in scipy ≥ 1.15).
    Uses convolution in time domain for each scale.

    Returns:
        Coefficient matrix of shape (len(scales), len(data)).
    """
    n = len(data)
    output = np.empty((len(scales), n), dtype=np.float64)
    for idx, scale in enumerate(scales):
        # Wavelet width: 10× scale (matches scipy convention)
        width = int(10.0 * scale + 0.5)
        if width < 1:
            width = 1
        wavelet = _ricker_wavelet(width, scale)
        # Full convolution, then center-crop to data length
        conv_full = np.convolve(data, wavelet, mode="full")
        # Center crop: skip (len(wavelet)-1)//2 from start
        start = (len(wavelet) - 1) // 2
        output[idx] = conv_full[start : start + n]
    return output


# ── Detection Method 2: Wavelet ───────────────────────────────────


def detect_ramps_wavelet(
    power_mw: NDArray[np.float64],
    config: RampConfig | None = None,
) -> list[RampEvent]:
    """Detect ramp events using Continuous Wavelet Transform.

    Uses the Ricker (Mexican hat) wavelet at multiple scales to identify
    sharp transitions at different temporal resolutions. CWT coefficients
    exceeding a scale-dependent threshold indicate ramps.

    This method captures ramps that threshold detection might miss
    when the gradient is spread across multiple timesteps.

    Args:
        power_mw: farm total power forecast [MW], shape (n_steps,)
        config: ramp detection configuration

    Returns:
        List of detected RampEvent objects.
    """
    if config is None:
        config = RampConfig()

    power_mw = np.asarray(power_mw, dtype=np.float64)
    n = len(power_mw)

    if n < 4:
        return []

    # Compute CWT with Ricker wavelet at configured scales
    # Manual implementation: scipy.signal.cwt/ricker removed in scipy ≥ 1.15
    scales = np.array(config.wavelet_scales, dtype=np.float64)
    coefficients = _cwt_ricker(power_mw, scales)

    # Threshold: scale-dependent, based on farm capacity fraction
    # Larger scales need higher thresholds
    events: list[RampEvent] = []

    # Use the finest scale for ramp detection (most sensitive)
    finest_coeffs = coefficients[0]

    # Adaptive threshold: 2σ of the wavelet coefficients
    coeff_std = float(np.std(finest_coeffs))
    if coeff_std < 1e-6:
        return []

    threshold = 2.0 * coeff_std

    # Find groups of above-threshold coefficients
    raw_groups: list[tuple[int, int]] = []
    i = 0
    while i < n:
        if abs(finest_coeffs[i]) >= threshold:
            start = i
            while i < n and abs(finest_coeffs[i]) >= threshold:
                i += 1
            raw_groups.append((start, i - 1))
        else:
            i += 1

    # Merge nearby groups: Ricker wavelet produces positive and negative
    # lobes that split a single transition into two adjacent groups.
    merge_gap = int(scales[0]) + 1
    merged: list[tuple[int, int]] = []
    for grp in raw_groups:
        if merged and grp[0] - merged[-1][1] <= merge_gap:
            merged[-1] = (merged[-1][0], grp[1])
        else:
            merged.append(grp)

    for grp_start, grp_end in merged:
        duration_steps = grp_end - grp_start + 1
        if duration_steps >= config.min_ramp_duration_steps:
            segment = power_mw[grp_start : min(grp_end + 1, n)]
            magnitude = float(np.max(segment) - np.min(segment))

            # Skip boundary artifacts (near-zero magnitude)
            if magnitude < 0.01:
                continue

            end_vs_start = float(power_mw[min(grp_end, n - 1)] - power_mw[grp_start])
            direction = RampDirection.UP if end_vs_start > 0 else RampDirection.DOWN
            duration_min = duration_steps * TIMESTEP_MINUTES
            rate = abs(magnitude) / (duration_min / 60.0) if duration_min > 0 else 0.0

            events.append(
                RampEvent(
                    start_index=grp_start,
                    end_index=grp_end,
                    direction=direction,
                    magnitude_mw=round(magnitude, 2),
                    rate_mw_hr=round(rate, 2),
                    duration_minutes=duration_min,
                    severity=_classify_severity(magnitude),
                    detection_method="wavelet",
                )
            )

    logger.info(
        "Wavelet detection: %d ramps found (%d scales)",
        len(events),
        len(scales),
    )
    return events


# ── Detection Method 3: Regime Classification ─────────────────────


def detect_ramps_regime(
    power_mw: NDArray[np.float64],
    config: RampConfig | None = None,
) -> tuple[list[RampEvent], list[str]]:
    """Classify operating regime and detect ramp transitions.

    Gradient-based state classifier without Hidden Markov Model
    dependencies. Each timestep is classified as:
    - calm: |gradient| < calm_threshold
    - ramp_up: gradient > calm_threshold
    - ramp_down: gradient < -calm_threshold

    Transitions between regimes identify ramp start/end points.

    Args:
        power_mw: farm total power forecast [MW], shape (n_steps,)
        config: ramp detection configuration

    Returns:
        Tuple of (ramp events, per-step regime labels).
    """
    if config is None:
        config = RampConfig()

    power_mw = np.asarray(power_mw, dtype=np.float64)
    gradient = _compute_gradient_mw_hr(power_mw)
    n = len(power_mw)

    # Classify each step
    states: list[str] = []
    for g in gradient:
        if g > config.calm_threshold_mw_hr:
            states.append(RegimeState.RAMP_UP.value)
        elif g < -config.calm_threshold_mw_hr:
            states.append(RegimeState.RAMP_DOWN.value)
        else:
            states.append(RegimeState.CALM.value)

    # Extract ramp events from regime transitions
    events: list[RampEvent] = []
    i = 0

    while i < n:
        if states[i] in (RegimeState.RAMP_UP.value, RegimeState.RAMP_DOWN.value):
            start = i
            current_regime = states[i]
            while i < n and states[i] == current_regime:
                i += 1
            end = i - 1

            duration_steps = end - start + 1
            if duration_steps >= config.min_ramp_duration_steps:
                magnitude = float(power_mw[end] - power_mw[start])
                direction = (
                    RampDirection.UP
                    if current_regime == RegimeState.RAMP_UP.value
                    else RampDirection.DOWN
                )
                duration_min = duration_steps * TIMESTEP_MINUTES
                rate = abs(magnitude) / (duration_min / 60.0) if duration_min > 0 else 0.0

                events.append(
                    RampEvent(
                        start_index=start,
                        end_index=end,
                        direction=direction,
                        magnitude_mw=round(abs(magnitude), 2),
                        rate_mw_hr=round(rate, 2),
                        duration_minutes=duration_min,
                        severity=_classify_severity(magnitude),
                        detection_method="regime",
                    )
                )
        else:
            i += 1

    logger.info(
        "Regime detection: %d ramps found, states: %d calm, %d ramp_up, %d ramp_down",
        len(events),
        states.count(RegimeState.CALM.value),
        states.count(RegimeState.RAMP_UP.value),
        states.count(RegimeState.RAMP_DOWN.value),
    )
    return events, states


# ── Combined Detection ────────────────────────────────────────────


def detect_all_ramps(
    power_mw: NDArray[np.float64],
    config: RampConfig | None = None,
) -> RampDetectionResult:
    """Run all three detection methods and combine results.

    Runs threshold, wavelet, and regime methods. Returns the union
    of all detected events (no deduplication — each method's events
    are tagged with their detection_method for comparison).

    Args:
        power_mw: farm total power forecast [MW]
        config: ramp detection configuration

    Returns:
        RampDetectionResult with all events and regime states.
    """
    if config is None:
        config = RampConfig()

    threshold_events = detect_ramps_threshold(power_mw, config)
    wavelet_events = detect_ramps_wavelet(power_mw, config)
    regime_events, regime_states = detect_ramps_regime(power_mw, config)

    all_events = threshold_events + wavelet_events + regime_events

    num_up = sum(1 for e in all_events if e.direction == RampDirection.UP)
    num_down = sum(1 for e in all_events if e.direction == RampDirection.DOWN)
    max_rate = max((e.rate_mw_hr for e in all_events), default=0.0)

    return RampDetectionResult(
        events=all_events,
        num_ramp_up=num_up,
        num_ramp_down=num_down,
        max_ramp_rate_mw_hr=max_rate,
        regime_states=regime_states,
    )


# ── Grid Stability Alerts ────────────────────────────────────────


def generate_grid_alerts(
    events: list[RampEvent],
) -> list[GridStabilityAlert]:
    """Generate grid stability alerts for ramp-down events.

    Only ramp-down events trigger alerts because they represent
    sudden loss of generation that threatens grid frequency stability.
    Ramp-ups are beneficial (more power) and don't require FRT action.

    Alert levels based on magnitude as fraction of farm capacity (510 MW):
    - INFO:       < 10% (< 51 MW)   → log only
    - WARNING:   10–20% (51–102 MW) → increase STATCOM reactive support
    - CRITICAL:  20–40% (102–204 MW) → notify PSE, activate reserves
    - EMERGENCY: > 40%  (> 204 MW)  → FRT mode, PSE emergency protocol

    Args:
        events: list of ramp events to evaluate

    Returns:
        List of GridStabilityAlert for ramp-down events only.
    """
    alerts: list[GridStabilityAlert] = []

    for event in events:
        if event.direction != RampDirection.DOWN:
            continue

        pct = event.magnitude_mw / FARM_CAPACITY_MW

        if pct >= ALERT_EMERGENCY_PCT:
            alert = GridStabilityAlert(
                alert_level=AlertLevel.EMERGENCY,
                ramp_event=event,
                message=(
                    f"EMERGENCY: {event.magnitude_mw:.0f} MW ramp-down "
                    f"({pct * 100:.0f}% capacity) in {event.duration_minutes} min"
                ),
                recommended_action="Activate FRT mode, engage spinning reserves",
                statcom_action="FRT mode — maximum reactive injection ±120 MVAR",
                pse_notification=True,
            )
        elif pct >= ALERT_CRITICAL_PCT:
            alert = GridStabilityAlert(
                alert_level=AlertLevel.CRITICAL,
                ramp_event=event,
                message=(
                    f"CRITICAL: {event.magnitude_mw:.0f} MW ramp-down "
                    f"({pct * 100:.0f}% capacity) in {event.duration_minutes} min"
                ),
                recommended_action="Notify PSE dispatcher, pre-arm reserves",
                statcom_action="Increase reactive output to ±80 MVAR",
                pse_notification=True,
            )
        elif pct >= ALERT_WARNING_PCT:
            alert = GridStabilityAlert(
                alert_level=AlertLevel.WARNING,
                ramp_event=event,
                message=(
                    f"WARNING: {event.magnitude_mw:.0f} MW ramp-down "
                    f"({pct * 100:.0f}% capacity) in {event.duration_minutes} min"
                ),
                recommended_action="Increase STATCOM reactive support",
                statcom_action="Increase reactive output to ±60 MVAR",
                pse_notification=False,
            )
        else:
            alert = GridStabilityAlert(
                alert_level=AlertLevel.INFO,
                ramp_event=event,
                message=(
                    f"INFO: {event.magnitude_mw:.0f} MW ramp-down "
                    f"({pct * 100:.0f}% capacity) in {event.duration_minutes} min"
                ),
                recommended_action="Monitor — no action required",
                statcom_action="Normal operation",
                pse_notification=False,
            )

        alerts.append(alert)

    logger.info(
        "Grid alerts: %d alerts generated from %d ramp-down events",
        len(alerts),
        sum(1 for e in events if e.direction == RampDirection.DOWN),
    )
    return alerts
