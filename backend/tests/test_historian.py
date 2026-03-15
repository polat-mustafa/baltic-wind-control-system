"""
Unit tests for the SCADA Historian service (P3 — historian.py).

Tests validate:
- Tag registry: all tags present, fields complete
- Time-series generation: point count, value clamping, ordering
- Determinism: same inputs → same outputs
- Physics bounds: all values within physical limits
- Resolution variants: 1min, 5min, 15min, 1hr
- Edge cases: minimum range, maximum range, latest values

Test Strategy
-------------
- No database required (purely in-memory computation)
- Physics-validated: generated values never exceed physical limits
- Deterministic: identical inputs always produce identical outputs
- Comprehensive scenario coverage across all tag types
"""

from __future__ import annotations

import pytest

from app.services.p3.historian import (
    HistorianTag,
    TagMetadata,
    TimeResolution,
    generate_time_series,
    get_available_tags,
    get_latest_values,
    TAG_REGISTRY,
    MAX_POINTS_PER_QUERY,
    RESOLUTION_MINUTES,
    _compute_value_at_hour,
    _format_pseudo_iso,
)


# ── Tag Registry Tests ─────────────────────────────────────────────


class TestTagRegistry:
    """Tests for the TAG_REGISTRY completeness and correctness."""

    def test_all_historian_tags_have_registry_entries(self):
        """Every HistorianTag enum value must have a registry entry."""
        for tag in HistorianTag:
            assert tag in TAG_REGISTRY, f"Missing registry entry for {tag}"

    def test_registry_entry_count_matches_enum(self):
        """TAG_REGISTRY must have exactly the same count as HistorianTag enum."""
        assert len(TAG_REGISTRY) == len(HistorianTag)

    def test_all_entries_have_non_empty_display_name(self):
        """Each tag must have a human-readable display name."""
        for tag, meta in TAG_REGISTRY.items():
            assert meta.display_name, f"{tag}: empty display_name"

    def test_all_entries_have_non_empty_unit(self):
        """Each tag must specify an engineering unit."""
        for tag, meta in TAG_REGISTRY.items():
            assert meta.unit, f"{tag}: empty unit"

    def test_all_entries_have_valid_range(self):
        """range_min must be strictly less than range_max."""
        for tag, meta in TAG_REGISTRY.items():
            assert meta.range_min < meta.range_max, (
                f"{tag}: range_min={meta.range_min} >= range_max={meta.range_max}"
            )

    def test_all_entries_nominal_within_range(self):
        """Nominal value must be within [range_min, range_max]."""
        for tag, meta in TAG_REGISTRY.items():
            assert meta.range_min <= meta.nominal <= meta.range_max, (
                f"{tag}: nominal={meta.nominal} outside "
                f"[{meta.range_min}, {meta.range_max}]"
            )

    def test_all_entries_have_positive_periods(self):
        """Waveform periods must be positive (physical constraint)."""
        for tag, meta in TAG_REGISTRY.items():
            assert meta.period_slow_h > 0, f"{tag}: period_slow_h <= 0"
            assert meta.period_fast_h > 0, f"{tag}: period_fast_h <= 0"

    def test_farm_power_tag_present(self):
        """Farm total power (OSS_TOTAL_POWER_MW) must exist."""
        assert HistorianTag.OSS_TOTAL_POWER_MW in TAG_REGISTRY

    def test_farm_power_range_matches_spec(self):
        """Farm power range must be [0, 510] MW per project specification."""
        meta = TAG_REGISTRY[HistorianTag.OSS_TOTAL_POWER_MW]
        assert meta.range_min == 0.0
        assert meta.range_max == 510.0
        assert meta.unit == "MW"

    def test_frequency_range_is_narrow(self):
        """Grid frequency range must stay near 50 Hz (grid stability)."""
        meta = TAG_REGISTRY[HistorianTag.OSS_FREQUENCY_HZ]
        assert meta.range_min >= 49.0
        assert meta.range_max <= 51.0
        assert meta.nominal == 50.0

    def test_statcom_range_matches_spec(self):
        """STATCOM range must be ±120 MVAR per project specification."""
        meta = TAG_REGISTRY[HistorianTag.STATCOM_Q_MVAR]
        assert meta.range_min == -120.0
        assert meta.range_max == 120.0

    def test_voltage_pu_nominal_is_near_unity(self):
        """220 kV voltage nominal should be near 1.0 pu (HV control target)."""
        meta = TAG_REGISTRY[HistorianTag.OSS_VOLTAGE_PU]
        assert 0.98 <= meta.nominal <= 1.02


# ── Tag Listing Tests ──────────────────────────────────────────────


class TestGetAvailableTags:
    """Tests for the get_available_tags() function."""

    def test_returns_all_tags(self):
        """Should return one TagMetadata per HistorianTag enum value."""
        tags = get_available_tags()
        assert len(tags) == len(HistorianTag)

    def test_returns_sorted_by_display_name(self):
        """Tags should be sorted alphabetically by display_name."""
        tags = get_available_tags()
        names = [t.display_name for t in tags]
        assert names == sorted(names), "Tags are not sorted by display_name"

    def test_returns_tag_metadata_instances(self):
        """All returned objects must be TagMetadata instances."""
        tags = get_available_tags()
        for meta in tags:
            assert isinstance(meta, TagMetadata)


# ── Value Computation Tests ────────────────────────────────────────


class TestComputeValueAtHour:
    """Tests for the _compute_value_at_hour() function."""

    def test_value_within_range_at_hour_zero(self):
        """Value at hour_offset=0 must be within [range_min, range_max]."""
        for tag, meta in TAG_REGISTRY.items():
            val = _compute_value_at_hour(meta, 0.0)
            assert meta.range_min <= val <= meta.range_max, (
                f"{tag}: value {val} outside [{meta.range_min}, {meta.range_max}]"
            )

    def test_value_within_range_across_time(self):
        """Sweep 24 hours in 30-min steps — value must always be within range."""
        meta = TAG_REGISTRY[HistorianTag.OSS_TOTAL_POWER_MW]
        for h in [i * 0.5 for i in range(48)]:
            val = _compute_value_at_hour(meta, h)
            assert meta.range_min <= val <= meta.range_max, (
                f"Hour {h}: value {val} outside range"
            )

    def test_determinism(self):
        """Same inputs must produce same output (no randomness)."""
        meta = TAG_REGISTRY[HistorianTag.OSS_FREQUENCY_HZ]
        v1 = _compute_value_at_hour(meta, 12.5)
        v2 = _compute_value_at_hour(meta, 12.5)
        assert v1 == v2

    def test_different_tags_differ_at_same_time(self):
        """Different tags should generally produce different values."""
        hour = 6.0
        power_val = _compute_value_at_hour(TAG_REGISTRY[HistorianTag.OSS_TOTAL_POWER_MW], hour)
        freq_val = _compute_value_at_hour(TAG_REGISTRY[HistorianTag.OSS_FREQUENCY_HZ], hour)
        # These have very different ranges so must differ
        assert power_val != freq_val


# ── Time-Series Generation Tests ──────────────────────────────────


class TestGenerateTimeSeries:
    """Tests for the generate_time_series() function."""

    def test_returns_correct_resolution_label(self):
        """Response resolution field must match the requested resolution."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=1,
            resolution=TimeResolution.ONE_MINUTE,
        )
        assert ts.resolution == TimeResolution.ONE_MINUTE.value

    def test_point_count_1hr_1min(self):
        """1-hour range at 1-min resolution → 61 points (0..60 inclusive)."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=1,
            resolution=TimeResolution.ONE_MINUTE,
        )
        assert len(ts.points) == 61

    def test_point_count_4hr_5min(self):
        """4-hour range at 5-min resolution → 49 points (0..240/5 inclusive)."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=4,
            resolution=TimeResolution.FIVE_MINUTES,
        )
        assert len(ts.points) == 49

    def test_point_count_24hr_15min(self):
        """24-hour range at 15-min resolution → 97 points."""
        ts = generate_time_series(
            HistorianTag.OSS_FREQUENCY_HZ,
            range_hours=24,
            resolution=TimeResolution.FIFTEEN_MINUTES,
        )
        assert len(ts.points) == 97

    def test_point_count_7d_1hr(self):
        """7-day range at 1-hr resolution → 169 points (0..168 inclusive)."""
        ts = generate_time_series(
            HistorianTag.OSS_VOLTAGE_PU,
            range_hours=168,
            resolution=TimeResolution.ONE_HOUR,
        )
        assert len(ts.points) == 169

    def test_never_exceeds_max_points(self):
        """Point count must never exceed MAX_POINTS_PER_QUERY."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=168,
            resolution=TimeResolution.ONE_MINUTE,
        )
        assert len(ts.points) <= MAX_POINTS_PER_QUERY

    def test_all_values_within_physical_range(self):
        """Every generated value must be within the tag's physical range."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=24,
            resolution=TimeResolution.FIFTEEN_MINUTES,
        )
        meta = TAG_REGISTRY[HistorianTag.OSS_TOTAL_POWER_MW]
        for pt in ts.points:
            assert meta.range_min <= pt.value <= meta.range_max, (
                f"Value {pt.value} at {pt.timestamp_iso} outside range"
            )

    def test_frequency_values_within_range(self):
        """Grid frequency must stay within ±1 Hz of nominal (49-51 Hz)."""
        ts = generate_time_series(
            HistorianTag.OSS_FREQUENCY_HZ,
            range_hours=24,
            resolution=TimeResolution.FIFTEEN_MINUTES,
        )
        for pt in ts.points:
            assert 49.0 <= pt.value <= 51.0, (
                f"Frequency {pt.value} Hz outside 49-51 Hz band"
            )

    def test_voltage_pu_within_range(self):
        """Voltage must stay within declared range (0.95-1.05 pu)."""
        ts = generate_time_series(
            HistorianTag.OSS_VOLTAGE_PU,
            range_hours=24,
            resolution=TimeResolution.FIFTEEN_MINUTES,
        )
        for pt in ts.points:
            assert 0.95 <= pt.value <= 1.05, (
                f"Voltage {pt.value} pu outside 0.95-1.05 band"
            )

    def test_statcom_within_rating(self):
        """STATCOM output must be within ±120 MVAR rating."""
        ts = generate_time_series(
            HistorianTag.STATCOM_Q_MVAR,
            range_hours=24,
            resolution=TimeResolution.FIFTEEN_MINUTES,
        )
        for pt in ts.points:
            assert -120.0 <= pt.value <= 120.0, (
                f"STATCOM {pt.value} MVAR exceeds ±120 MVAR rating"
            )

    def test_timestamps_are_strings(self):
        """All timestamps must be strings (ISO-8601 format)."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=1,
            resolution=TimeResolution.ONE_MINUTE,
        )
        for pt in ts.points:
            assert isinstance(pt.timestamp_iso, str)
            assert "T" in pt.timestamp_iso
            assert "Z" in pt.timestamp_iso

    def test_determinism_same_epoch(self):
        """Same tag + range + resolution + epoch → identical series."""
        kwargs = dict(
            tag=HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=4,
            resolution=TimeResolution.FIVE_MINUTES,
            now_epoch_minutes=1000,
        )
        ts1 = generate_time_series(**kwargs)
        ts2 = generate_time_series(**kwargs)
        assert [p.value for p in ts1.points] == [p.value for p in ts2.points]

    def test_different_epoch_shifts_values(self):
        """Different epoch offsets should produce different value sequences."""
        ts1 = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=4,
            resolution=TimeResolution.FIVE_MINUTES,
            now_epoch_minutes=0,
        )
        ts2 = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=4,
            resolution=TimeResolution.FIVE_MINUTES,
            now_epoch_minutes=500,
        )
        # Different epoch → different series (not equal everywhere)
        values1 = [p.value for p in ts1.points]
        values2 = [p.value for p in ts2.points]
        assert values1 != values2

    def test_metadata_fields_populated(self):
        """Response must include display_name, unit, description, nominal, ranges."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=1,
            resolution=TimeResolution.ONE_MINUTE,
        )
        assert ts.display_name
        assert ts.unit == "MW"
        assert ts.description
        assert ts.nominal > 0
        assert ts.range_min == 0.0
        assert ts.range_max == 510.0

    def test_unknown_tag_raises_value_error(self):
        """Unknown tag value must raise ValueError."""
        with pytest.raises(ValueError, match="Unknown historian tag"):
            generate_time_series(
                "BWA.UNKNOWN.FAKE",  # type: ignore[arg-type]
                range_hours=1,
                resolution=TimeResolution.ONE_MINUTE,
            )

    @pytest.mark.parametrize("resolution", list(TimeResolution))
    def test_all_resolutions_produce_points(self, resolution: TimeResolution):
        """Every supported resolution must produce at least one point."""
        ts = generate_time_series(
            HistorianTag.OSS_TOTAL_POWER_MW,
            range_hours=4,
            resolution=resolution,
        )
        assert len(ts.points) > 0

    @pytest.mark.parametrize("tag", list(HistorianTag))
    def test_all_tags_generate_valid_series(self, tag: HistorianTag):
        """Every tag must produce a valid series without errors."""
        ts = generate_time_series(
            tag,
            range_hours=4,
            resolution=TimeResolution.FIVE_MINUTES,
        )
        meta = TAG_REGISTRY[tag]
        assert len(ts.points) > 0
        for pt in ts.points:
            assert meta.range_min <= pt.value <= meta.range_max


# ── Latest Values Tests ────────────────────────────────────────────


class TestGetLatestValues:
    """Tests for the get_latest_values() function."""

    def test_returns_value_for_every_tag(self):
        """Latest values dict must contain an entry for each tag."""
        values = get_latest_values()
        for tag in HistorianTag:
            assert tag.value in values, f"Missing latest value for {tag}"

    def test_all_latest_values_within_range(self):
        """All latest values must be within their physical range."""
        values = get_latest_values()
        for tag, meta in TAG_REGISTRY.items():
            val = values[tag.value]
            assert meta.range_min <= val <= meta.range_max, (
                f"{tag}: latest value {val} outside "
                f"[{meta.range_min}, {meta.range_max}]"
            )

    def test_deterministic_latest_values(self):
        """Latest values must be deterministic (epoch=0 reference)."""
        v1 = get_latest_values()
        v2 = get_latest_values()
        assert v1 == v2


# ── Pseudo-ISO Timestamp Tests ─────────────────────────────────────


class TestFormatPseudoISO:
    """Tests for the _format_pseudo_iso() helper."""

    def test_format_at_zero_is_start_of_year(self):
        """Minute offset 0 → 2026-01-01T00:00:00Z."""
        result = _format_pseudo_iso(0)
        assert result == "2026-01-01T00:00:00Z"

    def test_format_at_60_is_one_hour(self):
        """60 minutes from epoch → 01:00:00 on day 1."""
        result = _format_pseudo_iso(60)
        assert "01:00:00Z" in result

    def test_format_contains_z_suffix(self):
        """All timestamps must end with 'Z' (UTC indicator)."""
        for offset in [0, 60, 1440, 10080]:
            assert _format_pseudo_iso(offset).endswith("Z")

    def test_format_contains_t_separator(self):
        """ISO-8601 requires 'T' separator between date and time."""
        result = _format_pseudo_iso(720)
        assert "T" in result

    def test_negative_offset_wraps(self):
        """Negative offsets should wrap to positive (circular time)."""
        result = _format_pseudo_iso(-60)
        assert result.endswith("Z")
        assert "T" in result


# ── Resolution Mapping Tests ───────────────────────────────────────


class TestResolutionMappings:
    """Tests for the RESOLUTION_MINUTES mapping."""

    def test_all_resolutions_mapped(self):
        """Every TimeResolution must have a minutes entry."""
        for res in TimeResolution:
            assert res in RESOLUTION_MINUTES, f"Missing mapping for {res}"

    def test_resolution_values_are_positive(self):
        """All resolution minute values must be positive integers."""
        for res, minutes in RESOLUTION_MINUTES.items():
            assert minutes > 0, f"{res}: minutes={minutes} is not positive"

    def test_1min_is_one_minute(self):
        assert RESOLUTION_MINUTES[TimeResolution.ONE_MINUTE] == 1

    def test_5min_is_five_minutes(self):
        assert RESOLUTION_MINUTES[TimeResolution.FIVE_MINUTES] == 5

    def test_15min_is_fifteen_minutes(self):
        assert RESOLUTION_MINUTES[TimeResolution.FIFTEEN_MINUTES] == 15

    def test_1hr_is_sixty_minutes(self):
        assert RESOLUTION_MINUTES[TimeResolution.ONE_HOUR] == 60
