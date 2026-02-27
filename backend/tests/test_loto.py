"""
Tests for LOTO (Lock-Out / Tag-Out) tracking (P5).

Validates:
- LOTO set creation for OSS earth switches
- Application and removal lifecycle
- Double-apply prevention
- Double-remove prevention
- Completeness verification (all_applied / all_removed)
"""

from __future__ import annotations

import pytest

from app.services.p5.loto import (
    LOTOAlreadyAppliedError,
    LOTONotAppliedError,
    LOTOPointNotFoundError,
    LOTOStatus,
    all_loto_applied,
    all_loto_removed,
    apply_loto,
    create_loto_set_for_oss,
    remove_loto,
)

# ── LOTO Set Creation ────────────────────────────────────────────


class TestLOTOSetCreation:
    """Verify LOTO set factory creates correct isolation points."""

    def test_creates_9_isolation_points(self) -> None:
        """One isolation point per earth switch (9 total)."""
        loto_set = create_loto_set_for_oss("SP-001")
        assert len(loto_set.points) == 9

    def test_all_points_start_not_applied(self) -> None:
        """All isolation points start in NOT_APPLIED state."""
        loto_set = create_loto_set_for_oss("SP-001")
        for point in loto_set.points.values():
            assert point.status == LOTOStatus.NOT_APPLIED

    def test_point_ids_match_equipment(self) -> None:
        """Point IDs are 'LOTO-{equipment_id}'."""
        loto_set = create_loto_set_for_oss("SP-001")
        assert "LOTO-ES-ON-220-01" in loto_set.points
        assert "LOTO-ES-OSS-220-01" in loto_set.points
        assert "LOTO-ES-OSS-66-01" in loto_set.points
        assert "LOTO-ES-STR-01" in loto_set.points
        assert "LOTO-ES-STR-06" in loto_set.points

    def test_tag_numbers_assigned(self) -> None:
        """Each point has a unique tag number."""
        loto_set = create_loto_set_for_oss("SP-001")
        tags = {p.tag_number for p in loto_set.points.values()}
        assert len(tags) == 9

    def test_programme_id_stored(self) -> None:
        """LOTO set records its programme ID."""
        loto_set = create_loto_set_for_oss("SP-042")
        assert loto_set.programme_id == "SP-042"


# ── LOTO Application ────────────────────────────────────────────


class TestLOTOApplication:
    """Verify LOTO apply lifecycle."""

    def test_apply_loto_success(self) -> None:
        """Apply LOTO transitions point to APPLIED state."""
        loto_set = create_loto_set_for_oss("SP-001")
        point = apply_loto(loto_set, "LOTO-ES-ON-220-01", "Engineer A")
        assert point.status == LOTOStatus.APPLIED
        assert point.locked_by == "Engineer A"
        assert point.applied_at is not None

    def test_apply_loto_double_apply_rejected(self) -> None:
        """Cannot apply LOTO twice to the same point."""
        loto_set = create_loto_set_for_oss("SP-001")
        apply_loto(loto_set, "LOTO-ES-ON-220-01", "Engineer A")
        with pytest.raises(LOTOAlreadyAppliedError):
            apply_loto(loto_set, "LOTO-ES-ON-220-01", "Engineer B")

    def test_apply_loto_unknown_point(self) -> None:
        """Cannot apply LOTO to a non-existent point."""
        loto_set = create_loto_set_for_oss("SP-001")
        with pytest.raises(LOTOPointNotFoundError):
            apply_loto(loto_set, "LOTO-FAKE-01", "Engineer A")


# ── LOTO Removal ────────────────────────────────────────────────


class TestLOTORemoval:
    """Verify LOTO removal lifecycle."""

    def test_remove_loto_success(self) -> None:
        """Remove LOTO transitions point to REMOVED state."""
        loto_set = create_loto_set_for_oss("SP-001")
        apply_loto(loto_set, "LOTO-ES-ON-220-01", "Engineer A")
        point = remove_loto(loto_set, "LOTO-ES-ON-220-01", "PiC Smith")
        assert point.status == LOTOStatus.REMOVED
        assert point.removed_by == "PiC Smith"
        assert point.removed_at is not None

    def test_remove_loto_not_applied(self) -> None:
        """Cannot remove LOTO that was never applied."""
        loto_set = create_loto_set_for_oss("SP-001")
        with pytest.raises(LOTONotAppliedError):
            remove_loto(loto_set, "LOTO-ES-ON-220-01", "PiC Smith")

    def test_remove_loto_already_removed(self) -> None:
        """Cannot remove LOTO that was already removed."""
        loto_set = create_loto_set_for_oss("SP-001")
        apply_loto(loto_set, "LOTO-ES-ON-220-01", "Engineer A")
        remove_loto(loto_set, "LOTO-ES-ON-220-01", "PiC Smith")
        with pytest.raises(LOTONotAppliedError):
            remove_loto(loto_set, "LOTO-ES-ON-220-01", "PiC Smith")

    def test_remove_loto_unknown_point(self) -> None:
        """Cannot remove LOTO from a non-existent point."""
        loto_set = create_loto_set_for_oss("SP-001")
        with pytest.raises(LOTOPointNotFoundError):
            remove_loto(loto_set, "LOTO-FAKE-01", "PiC Smith")


# ── Completeness Checks ─────────────────────────────────────────


class TestLOTOCompleteness:
    """Verify all_applied / all_removed queries."""

    def test_all_applied_false_initially(self) -> None:
        """Not all applied when freshly created."""
        loto_set = create_loto_set_for_oss("SP-001")
        assert all_loto_applied(loto_set) is False

    def test_all_applied_true_when_complete(self) -> None:
        """All applied after locking every point."""
        loto_set = create_loto_set_for_oss("SP-001")
        for point_id in loto_set.points:
            apply_loto(loto_set, point_id, "Engineer A")
        assert all_loto_applied(loto_set) is True

    def test_all_removed_false_initially(self) -> None:
        """Not all removed when freshly created (they're NOT_APPLIED, not REMOVED)."""
        loto_set = create_loto_set_for_oss("SP-001")
        assert all_loto_removed(loto_set) is False

    def test_all_removed_true_after_full_cycle(self) -> None:
        """All removed after applying then removing every point."""
        loto_set = create_loto_set_for_oss("SP-001")
        for point_id in loto_set.points:
            apply_loto(loto_set, point_id, "Engineer A")
        for point_id in loto_set.points:
            remove_loto(loto_set, point_id, "PiC Smith")
        assert all_loto_removed(loto_set) is True

    def test_partial_application_not_complete(self) -> None:
        """all_applied is False if even one point is not applied."""
        loto_set = create_loto_set_for_oss("SP-001")
        point_ids = list(loto_set.points.keys())
        for pid in point_ids[:-1]:
            apply_loto(loto_set, pid, "Engineer A")
        assert all_loto_applied(loto_set) is False
