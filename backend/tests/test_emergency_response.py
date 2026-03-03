"""
Unit tests for P5 emergency response procedures.

Tests cover:
- Procedure library completeness (6 emergency types)
- Procedure content and severity mapping
- Emergency triggering and event creation
- Emergency log management
"""

from __future__ import annotations

import pytest

from app.services.p5.emergency_response import (
    EmergencyType,
    SeverityLevel,
    clear_logs,
    get_all_procedures,
    get_emergency_log,
    get_procedure,
    trigger_emergency,
)

PROGRAMME_ID = "BWA-SP-TEST-001"
TRIGGERED_BY = "Jan Kowalski"


@pytest.fixture(autouse=True)
def _clean_logs():
    """Clear emergency logs before each test."""
    clear_logs()
    yield
    clear_logs()


# ── Procedure Library ─────────────────────────────────────────────


class TestProcedureLibrary:
    """Verify the emergency procedure definitions."""

    def test_all_six_procedures_defined(self) -> None:
        procedures = get_all_procedures()
        assert len(procedures) == 6

    def test_all_emergency_types_covered(self) -> None:
        procedures = get_all_procedures()
        types = {p.emergency_type for p in procedures}
        expected = {et for et in EmergencyType}
        assert types == expected

    @pytest.mark.parametrize(
        "emergency_type",
        list(EmergencyType),
    )
    def test_get_procedure_returns_valid(self, emergency_type: EmergencyType) -> None:
        proc = get_procedure(emergency_type)
        assert proc.emergency_type == emergency_type
        assert len(proc.immediate_actions) > 0
        assert proc.responsible != ""
        assert proc.reference_document != ""

    def test_arc_flash_is_critical(self) -> None:
        proc = get_procedure(EmergencyType.ARC_FLASH)
        assert proc.severity == SeverityLevel.CRITICAL

    def test_sf6_leak_is_high(self) -> None:
        proc = get_procedure(EmergencyType.SF6_LEAK)
        assert proc.severity == SeverityLevel.HIGH

    def test_comms_failure_is_medium(self) -> None:
        proc = get_procedure(EmergencyType.COMMS_FAILURE)
        assert proc.severity == SeverityLevel.MEDIUM

    def test_man_overboard_is_critical(self) -> None:
        proc = get_procedure(EmergencyType.MAN_OVERBOARD)
        assert proc.severity == SeverityLevel.CRITICAL

    def test_unexpected_voltage_is_critical(self) -> None:
        proc = get_procedure(EmergencyType.UNEXPECTED_VOLTAGE)
        assert proc.severity == SeverityLevel.CRITICAL

    def test_procedures_have_scada_actions(self) -> None:
        proc = get_procedure(EmergencyType.ARC_FLASH)
        assert len(proc.automated_scada_actions) > 0

    def test_procedures_have_communication_protocol(self) -> None:
        proc = get_procedure(EmergencyType.ARC_FLASH)
        assert len(proc.communication_protocol) > 0


# ── Emergency Triggering ──────────────────────────────────────────


class TestEmergencyTriggering:
    """Verify emergency event creation and logging."""

    def test_trigger_creates_event(self) -> None:
        event = trigger_emergency(
            EmergencyType.ARC_FLASH,
            triggered_by=TRIGGERED_BY,
            programme_id=PROGRAMME_ID,
        )
        assert event.programme_id == PROGRAMME_ID
        assert event.emergency_type == EmergencyType.ARC_FLASH
        assert event.triggered_by == TRIGGERED_BY
        assert event.triggered_at is not None

    def test_event_has_unique_id(self) -> None:
        e1 = trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        e2 = trigger_emergency(EmergencyType.SF6_LEAK, TRIGGERED_BY, PROGRAMME_ID)
        assert e1.event_id != e2.event_id

    def test_event_severity_matches_procedure(self) -> None:
        event = trigger_emergency(EmergencyType.SF6_LEAK, TRIGGERED_BY, PROGRAMME_ID)
        assert event.severity == SeverityLevel.HIGH

    def test_event_has_actions_taken(self) -> None:
        event = trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        assert len(event.actions_taken) > 0

    def test_event_has_scada_actions(self) -> None:
        event = trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        assert len(event.scada_actions_executed) > 0

    def test_event_initially_unresolved(self) -> None:
        event = trigger_emergency(EmergencyType.COMMS_FAILURE, TRIGGERED_BY, PROGRAMME_ID)
        assert event.resolved is False
        assert event.resolved_at is None


# ── Emergency Log ─────────────────────────────────────────────────


class TestEmergencyLog:
    """Verify emergency log retrieval and filtering."""

    def test_empty_log_initially(self) -> None:
        log = get_emergency_log(PROGRAMME_ID)
        assert len(log) == 0

    def test_log_records_triggered_events(self) -> None:
        trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        trigger_emergency(EmergencyType.SF6_LEAK, TRIGGERED_BY, PROGRAMME_ID)
        log = get_emergency_log(PROGRAMME_ID)
        assert len(log) == 2

    def test_log_filters_by_programme(self) -> None:
        trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        trigger_emergency(EmergencyType.SF6_LEAK, TRIGGERED_BY, "OTHER-PROG")
        log = get_emergency_log(PROGRAMME_ID)
        assert len(log) == 1
        assert log[0].emergency_type == EmergencyType.ARC_FLASH

    def test_clear_logs_empties_all(self) -> None:
        trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        clear_logs()
        log = get_emergency_log(PROGRAMME_ID)
        assert len(log) == 0

    def test_log_preserves_chronological_order(self) -> None:
        trigger_emergency(EmergencyType.ARC_FLASH, TRIGGERED_BY, PROGRAMME_ID)
        trigger_emergency(EmergencyType.MEDICAL, TRIGGERED_BY, PROGRAMME_ID)
        log = get_emergency_log(PROGRAMME_ID)
        assert log[0].triggered_at <= log[1].triggered_at
