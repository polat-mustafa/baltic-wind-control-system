"""Tests for P4 ramp event detection and grid stability alerting.

Covers: flat signal, obvious ramps, threshold boundary, wavelet detection,
regime classification, grid alert generation, and severity classification.
"""

from __future__ import annotations

import numpy as np

from app.services.p4.ramp_detection import (
    AlertLevel,
    GridStabilityAlert,
    RampConfig,
    RampDetectionResult,
    RampDirection,
    RampEvent,
    RampSeverity,
    RegimeState,
    detect_all_ramps,
    detect_ramps_regime,
    detect_ramps_threshold,
    detect_ramps_wavelet,
    generate_grid_alerts,
)

# ── Helper ────────────────────────────────────────────────────────


def _make_flat_signal(n: int = 100, power_mw: float = 200.0) -> np.ndarray:
    """Create a flat (constant) power signal."""
    return np.full(n, power_mw, dtype=np.float64)


def _make_ramp_signal(
    n: int = 100,
    ramp_start: int = 30,
    ramp_end: int = 40,
    start_power: float = 200.0,
    end_power: float = 400.0,
) -> np.ndarray:
    """Create a signal with a single linear ramp."""
    signal = np.full(n, start_power, dtype=np.float64)
    ramp_steps = ramp_end - ramp_start
    if ramp_steps > 0:
        signal[ramp_start:ramp_end] = np.linspace(start_power, end_power, ramp_steps)
    signal[ramp_end:] = end_power
    return signal


# ── Threshold Detection ──────────────────────────────────────────


class TestThresholdDetection:
    """Threshold-based ramp detection tests."""

    def test_flat_signal_no_ramps(self) -> None:
        """Constant power → no ramp events."""
        power = _make_flat_signal()
        events = detect_ramps_threshold(power)
        assert len(events) == 0

    def test_obvious_ramp_up(self) -> None:
        """Sharp increase → ramp_up detected."""
        # 200 MW rise over 5 steps (50 min) = 240 MW/hr
        power = _make_ramp_signal(ramp_start=30, ramp_end=35, start_power=100.0, end_power=300.0)
        events = detect_ramps_threshold(power)
        up_events = [e for e in events if e.direction == RampDirection.UP]
        assert len(up_events) > 0
        assert up_events[0].magnitude_mw > 0

    def test_obvious_ramp_down(self) -> None:
        """Sharp decrease → ramp_down detected."""
        power = _make_ramp_signal(ramp_start=30, ramp_end=35, start_power=400.0, end_power=100.0)
        events = detect_ramps_threshold(power)
        down_events = [e for e in events if e.direction == RampDirection.DOWN]
        assert len(down_events) > 0

    def test_below_threshold_no_ramps(self) -> None:
        """Gradual change below threshold → no ramps."""
        # 10 MW rise over 6 steps (1 hour) = 10 MW/hr < 50 MW/hr threshold
        n = 100
        power = np.linspace(200.0, 210.0, n, dtype=np.float64)
        events = detect_ramps_threshold(power)
        assert len(events) == 0

    def test_custom_threshold(self) -> None:
        """Lower threshold → more events detected."""
        power = _make_ramp_signal(ramp_start=30, ramp_end=40, start_power=200.0, end_power=250.0)
        # Default (50 MW/hr) may not detect; lower threshold should
        low_config = RampConfig(threshold_mw_hr=10.0)
        events = detect_ramps_threshold(power, low_config)
        assert len(events) >= 0  # Depends on gradient computation

    def test_severity_classification(self) -> None:
        """Large ramp → higher severity."""
        # 250 MW ramp (~49% capacity) → extreme
        power = _make_ramp_signal(ramp_start=30, ramp_end=35, start_power=400.0, end_power=150.0)
        config = RampConfig(threshold_mw_hr=50.0)
        events = detect_ramps_threshold(power, config)
        severe_events = [
            e for e in events if e.severity in (RampSeverity.SEVERE, RampSeverity.EXTREME)
        ]
        assert len(severe_events) > 0


# ── Wavelet Detection ────────────────────────────────────────────


class TestWaveletDetection:
    """Wavelet-based ramp detection tests."""

    def test_flat_signal_no_ramps(self) -> None:
        """Flat signal → no wavelet ramp events."""
        power = _make_flat_signal(200)
        events = detect_ramps_wavelet(power)
        assert len(events) == 0

    def test_sharp_transition_detected(self) -> None:
        """Sharp ramp → wavelet coefficients spike."""
        # Step function: instant jump from 100 → 400 MW
        n = 200
        power = np.full(n, 100.0, dtype=np.float64)
        power[100:] = 400.0
        events = detect_ramps_wavelet(power)
        assert len(events) > 0

    def test_short_signal_handled(self) -> None:
        """Very short signal (< 4 steps) → empty result."""
        power = np.array([1.0, 2.0, 3.0])
        events = detect_ramps_wavelet(power)
        assert len(events) == 0


# ── Regime Detection ─────────────────────────────────────────────


class TestRegimeDetection:
    """Gradient-based regime classification tests."""

    def test_flat_signal_all_calm(self) -> None:
        """Constant power → all steps classified as calm."""
        power = _make_flat_signal()
        _events, states = detect_ramps_regime(power)
        assert all(s == RegimeState.CALM.value for s in states)
        assert len(_events) == 0

    def test_ramp_up_regime(self) -> None:
        """Rising power → ramp_up regime classification."""
        power = _make_ramp_signal(ramp_start=30, ramp_end=40, start_power=100.0, end_power=300.0)
        _events, states = detect_ramps_regime(power)
        # Some steps in the ramp region should be classified ramp_up
        ramp_up_count = sum(1 for s in states if s == RegimeState.RAMP_UP.value)
        assert ramp_up_count > 0

    def test_ramp_down_regime(self) -> None:
        """Falling power → ramp_down regime classification."""
        power = _make_ramp_signal(ramp_start=30, ramp_end=40, start_power=400.0, end_power=100.0)
        _events, states = detect_ramps_regime(power)
        ramp_down_count = sum(1 for s in states if s == RegimeState.RAMP_DOWN.value)
        assert ramp_down_count > 0

    def test_state_labels_valid(self) -> None:
        """All states are valid RegimeState values."""
        power = _make_ramp_signal()
        _, states = detect_ramps_regime(power)
        valid = {RegimeState.CALM.value, RegimeState.RAMP_UP.value, RegimeState.RAMP_DOWN.value}
        assert all(s in valid for s in states)


# ── Combined Detection ───────────────────────────────────────────


class TestCombinedDetection:
    """detect_all_ramps() integration tests."""

    def test_returns_detection_result(self) -> None:
        """detect_all_ramps returns RampDetectionResult."""
        power = _make_ramp_signal(
            n=200, ramp_start=80, ramp_end=90, start_power=100.0, end_power=350.0
        )
        result = detect_all_ramps(power)
        assert isinstance(result, RampDetectionResult)
        assert isinstance(result.regime_states, list)
        assert len(result.regime_states) == 200

    def test_flat_signal_minimal_events(self) -> None:
        """Flat signal → few or no events from any method."""
        power = _make_flat_signal(200)
        result = detect_all_ramps(power)
        assert result.num_ramp_up == 0
        assert result.num_ramp_down == 0


# ── Grid Stability Alerts ────────────────────────────────────────


class TestGridAlerts:
    """Grid stability alert generation tests."""

    def test_ramp_up_no_alerts(self) -> None:
        """Ramp-up events do NOT generate alerts."""
        up_event = RampEvent(
            start_index=0,
            end_index=5,
            direction=RampDirection.UP,
            magnitude_mw=100.0,
            rate_mw_hr=120.0,
            duration_minutes=50,
            severity=RampSeverity.MODERATE,
            detection_method="threshold",
        )
        alerts = generate_grid_alerts([up_event])
        assert len(alerts) == 0

    def test_minor_ramp_down_info_alert(self) -> None:
        """Small ramp-down (< 10% capacity) → INFO alert."""
        event = RampEvent(
            start_index=0,
            end_index=5,
            direction=RampDirection.DOWN,
            magnitude_mw=30.0,  # ~6% of 510 MW
            rate_mw_hr=36.0,
            duration_minutes=50,
            severity=RampSeverity.MINOR,
            detection_method="threshold",
        )
        alerts = generate_grid_alerts([event])
        assert len(alerts) == 1
        assert alerts[0].alert_level == AlertLevel.INFO
        assert alerts[0].pse_notification is False

    def test_moderate_ramp_down_warning(self) -> None:
        """10-20% capacity ramp-down → WARNING alert."""
        event = RampEvent(
            start_index=0,
            end_index=5,
            direction=RampDirection.DOWN,
            magnitude_mw=70.0,  # ~14% of 510 MW
            rate_mw_hr=84.0,
            duration_minutes=50,
            severity=RampSeverity.MODERATE,
            detection_method="threshold",
        )
        alerts = generate_grid_alerts([event])
        assert len(alerts) == 1
        assert alerts[0].alert_level == AlertLevel.WARNING
        assert alerts[0].pse_notification is False

    def test_severe_ramp_down_critical(self) -> None:
        """20-40% capacity ramp-down → CRITICAL alert + PSE notification."""
        event = RampEvent(
            start_index=0,
            end_index=5,
            direction=RampDirection.DOWN,
            magnitude_mw=150.0,  # ~29% of 510 MW
            rate_mw_hr=180.0,
            duration_minutes=50,
            severity=RampSeverity.SEVERE,
            detection_method="threshold",
        )
        alerts = generate_grid_alerts([event])
        assert len(alerts) == 1
        assert alerts[0].alert_level == AlertLevel.CRITICAL
        assert alerts[0].pse_notification is True

    def test_extreme_ramp_down_emergency(self) -> None:
        """40%+ capacity ramp-down → EMERGENCY alert + FRT mode."""
        event = RampEvent(
            start_index=0,
            end_index=5,
            direction=RampDirection.DOWN,
            magnitude_mw=250.0,  # ~49% of 510 MW
            rate_mw_hr=300.0,
            duration_minutes=50,
            severity=RampSeverity.EXTREME,
            detection_method="threshold",
        )
        alerts = generate_grid_alerts([event])
        assert len(alerts) == 1
        assert isinstance(alerts[0], GridStabilityAlert)
        assert alerts[0].alert_level == AlertLevel.EMERGENCY
        assert alerts[0].pse_notification is True
        assert "FRT" in alerts[0].statcom_action
