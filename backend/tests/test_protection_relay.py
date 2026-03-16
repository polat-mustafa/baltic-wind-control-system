"""
Tests for the protection relay setting verification module (P5).

Validates:
- 8 relay settings match IEC standards
- Selectivity check detects all-selective scenarios
- Selectivity check detects non-selective margins
- Individual grading pair verification
"""

from __future__ import annotations

import pytest

from app.services.p5.protection_relay import (
    GRADING_PAIRS,
    OSS_RELAY_SETTINGS,
    GradingPair,
    ProtectionFunction,
    RelaySetting,
    SelectivityVerdict,
    check_single_grading_pair,
    get_relay_settings,
    verify_selectivity,
)

# ── Settings Validation ─────────────────────────────────────────


class TestRelaySettings:
    """Validate the 8 OSS relay settings."""

    def test_has_8_settings(self) -> None:
        assert len(OSS_RELAY_SETTINGS) == 8

    def test_all_settings_have_unique_ids(self) -> None:
        ids = [s.setting_id for s in OSS_RELAY_SETTINGS]
        assert len(ids) == len(set(ids))

    def test_get_relay_settings_returns_tuple(self) -> None:
        settings = get_relay_settings()
        assert isinstance(settings, tuple)
        assert len(settings) == 8

    def test_ptoc_feeder(self) -> None:
        s = OSS_RELAY_SETTINGS[0]
        assert s.setting_id == "PTOC-01"
        assert s.function == ProtectionFunction.PTOC
        assert s.pickup_value == 1.2
        assert s.time_delay == 0.5
        assert s.location == "String feeder"

    def test_ptoc_incomer(self) -> None:
        s = OSS_RELAY_SETTINGS[1]
        assert s.setting_id == "PTOC-02"
        assert s.function == ProtectionFunction.PTOC
        assert s.time_delay == 0.8

    def test_pdis_zone1(self) -> None:
        s = OSS_RELAY_SETTINGS[2]
        assert s.setting_id == "PDIS-Z1"
        assert s.function == ProtectionFunction.PDIS
        assert s.pickup_value == 80.0
        assert s.time_delay == 0.0

    def test_pdis_zone2(self) -> None:
        s = OSS_RELAY_SETTINGS[3]
        assert s.setting_id == "PDIS-Z2"
        assert s.function == ProtectionFunction.PDIS
        assert s.pickup_value == 120.0
        assert s.time_delay == 0.4

    def test_ptov(self) -> None:
        s = OSS_RELAY_SETTINGS[4]
        assert s.setting_id == "PTOV-01"
        assert s.function == ProtectionFunction.PTOV
        assert s.pickup_value == 1.15
        assert s.time_delay == 1.0

    def test_ptuv(self) -> None:
        s = OSS_RELAY_SETTINGS[5]
        assert s.setting_id == "PTUV-01"
        assert s.function == ProtectionFunction.PTUV
        assert s.pickup_value == 0.80
        assert s.time_delay == 3.0

    def test_ptof(self) -> None:
        s = OSS_RELAY_SETTINGS[6]
        assert s.setting_id == "PTOF-01"
        assert s.function == ProtectionFunction.PTOF
        assert s.pickup_value == 51.5
        assert s.time_delay == 0.5

    def test_ptuf(self) -> None:
        s = OSS_RELAY_SETTINGS[7]
        assert s.setting_id == "PTUF-01"
        assert s.function == ProtectionFunction.PTUF
        assert s.pickup_value == 47.5
        assert s.time_delay == 0.5


# ── Grading Pairs Validation ────────────────────────────────────


class TestGradingPairs:
    """Validate the grading pair definitions."""

    def test_has_2_grading_pairs(self) -> None:
        assert len(GRADING_PAIRS) == 2

    def test_ptoc_pair(self) -> None:
        gp = GRADING_PAIRS[0]
        assert gp.pair_id == "GP-001"
        assert gp.downstream_id == "PTOC-01"
        assert gp.upstream_id == "PTOC-02"
        assert gp.required_margin_ms == 300.0

    def test_pdis_pair(self) -> None:
        gp = GRADING_PAIRS[1]
        assert gp.pair_id == "GP-002"
        assert gp.downstream_id == "PDIS-Z1"
        assert gp.upstream_id == "PDIS-Z2"
        assert gp.required_margin_ms == 400.0


# ── Selectivity Check ───────────────────────────────────────────


class TestSelectivityCheck:
    """Test selectivity verification with default and custom settings."""

    def test_default_settings_are_all_selective(self) -> None:
        """OSS default settings should all be selective."""
        results = verify_selectivity()
        assert len(results) == 2
        assert all(r.verdict == SelectivityVerdict.SELECTIVE for r in results)

    def test_ptoc_margin_is_300ms(self) -> None:
        results = verify_selectivity()
        ptoc_result = results[0]
        assert ptoc_result.pair_id == "GP-001"
        assert ptoc_result.actual_margin_ms == pytest.approx(300.0)
        assert ptoc_result.verdict == SelectivityVerdict.SELECTIVE

    def test_pdis_margin_is_400ms(self) -> None:
        results = verify_selectivity()
        pdis_result = results[1]
        assert pdis_result.pair_id == "GP-002"
        assert pdis_result.actual_margin_ms == pytest.approx(400.0)
        assert pdis_result.verdict == SelectivityVerdict.SELECTIVE

    def test_detect_non_selective_ptoc(self) -> None:
        """Reduce upstream PTOC delay to make it non-selective."""
        modified = list(OSS_RELAY_SETTINGS)
        # Replace PTOC-02 with reduced delay (0.6s instead of 0.8s)
        modified[1] = RelaySetting(
            setting_id="PTOC-02",
            function=ProtectionFunction.PTOC,
            description="Modified incomer OC — too fast",
            pickup_value=1.2,
            pickup_unit="xIn",
            time_delay=0.6,  # Only 100 ms margin, need 300 ms
            location="Incomer",
            standard="IEC 60255-151",
        )

        results = verify_selectivity(
            settings=tuple(modified),
            grading_pairs=GRADING_PAIRS,
        )
        ptoc_result = results[0]
        assert ptoc_result.actual_margin_ms == pytest.approx(100.0)
        assert ptoc_result.verdict == SelectivityVerdict.NON_SELECTIVE

    def test_detect_non_selective_pdis(self) -> None:
        """Reduce Zone 2 delay to make it non-selective."""
        modified = list(OSS_RELAY_SETTINGS)
        # Replace PDIS-Z2 with reduced delay (0.2s instead of 0.4s)
        modified[3] = RelaySetting(
            setting_id="PDIS-Z2",
            function=ProtectionFunction.PDIS,
            description="Modified Zone 2 — too fast",
            pickup_value=120.0,
            pickup_unit="%_reach",
            time_delay=0.2,  # Only 200 ms margin, need 400 ms
            location="Export cable",
            standard="IEC 60255-121",
        )

        results = verify_selectivity(
            settings=tuple(modified),
            grading_pairs=GRADING_PAIRS,
        )
        pdis_result = results[1]
        assert pdis_result.actual_margin_ms == pytest.approx(200.0)
        assert pdis_result.verdict == SelectivityVerdict.NON_SELECTIVE


# ── Single Grading Pair ─────────────────────────────────────────


class TestSingleGradingPair:
    """Test the check_single_grading_pair function."""

    def test_selective_pair(self) -> None:
        settings = {s.setting_id: s for s in OSS_RELAY_SETTINGS}
        result = check_single_grading_pair(GRADING_PAIRS[0], settings)
        assert result.verdict == SelectivityVerdict.SELECTIVE
        assert result.downstream_delay_s == 0.5
        assert result.upstream_delay_s == 0.8

    def test_missing_setting_raises_key_error(self) -> None:
        settings: dict[str, RelaySetting] = {}  # Empty
        with pytest.raises(KeyError):
            check_single_grading_pair(GRADING_PAIRS[0], settings)

    def test_exact_margin_is_selective(self) -> None:
        """Margin exactly equal to required should be SELECTIVE."""
        settings = {
            "D": RelaySetting(
                setting_id="D",
                function=ProtectionFunction.PTOC,
                description="Downstream",
                pickup_value=1.0,
                pickup_unit="xIn",
                time_delay=0.0,
                location="Test",
                standard="IEC 60255",
            ),
            "U": RelaySetting(
                setting_id="U",
                function=ProtectionFunction.PTOC,
                description="Upstream",
                pickup_value=1.0,
                pickup_unit="xIn",
                time_delay=0.3,  # 300 ms margin
                location="Test",
                standard="IEC 60255",
            ),
        }
        pair = GradingPair(
            pair_id="TEST",
            downstream_id="D",
            upstream_id="U",
            required_margin_ms=300.0,
            description="Test pair",
        )
        result = check_single_grading_pair(pair, settings)
        assert result.actual_margin_ms == pytest.approx(300.0)
        assert result.verdict == SelectivityVerdict.SELECTIVE
