"""
Tests for the HV equipment state machine (P5).

Validates:
- Equipment registry completeness (all 22 pieces of OSS equipment)
- Valid transitions per equipment type (CB, DS, ES, TX)
- Invalid transition rejection
- All 5 safety interlocks (IEC 61936-1)
- State preservation on failed actions
"""

from __future__ import annotations

import pytest

from app.services.p5.equipment_state import (
    CB_TRANSITIONS,
    DS_TRANSITIONS,
    ES_TRANSITIONS,
    OSS_EQUIPMENT,
    TX_TRANSITIONS,
    EquipmentNotFoundError,
    EquipmentState,
    EquipmentType,
    InterlockError,
    InvalidTransitionError,
    SwitchingAction,
    build_initial_state,
    check_interlocks,
    execute_switching_action,
    get_equipment_definition,
)

# ── Equipment Registry ───────────────────────────────────────────


class TestEquipmentRegistry:
    """Verify the OSS equipment registry is complete and correct."""

    def test_total_equipment_count(self) -> None:
        """Registry contains all 22 pieces of OSS equipment."""
        assert len(OSS_EQUIPMENT) == 22

    def test_earth_switch_count(self) -> None:
        """9 earth switches: ES-ON-220-01, ES-OSS-220-01, ES-OSS-66-01, ES-STR-01 to 06."""
        es_count = sum(1 for eq in OSS_EQUIPMENT if eq.equipment_type == EquipmentType.EARTH_SWITCH)
        assert es_count == 9

    def test_disconnector_count(self) -> None:
        """2 disconnectors: DS-ON-220-01, DS-OSS-220-01."""
        ds_count = sum(1 for eq in OSS_EQUIPMENT if eq.equipment_type == EquipmentType.DISCONNECTOR)
        assert ds_count == 2

    def test_circuit_breaker_count(self) -> None:
        """10 circuit breakers: CB-ON-220-01, CB-OSS-220-01, CB-TX-OSS-HV/LV, CB-STR-01 to 06."""
        cb_count = sum(
            1 for eq in OSS_EQUIPMENT if eq.equipment_type == EquipmentType.CIRCUIT_BREAKER
        )
        assert cb_count == 10

    def test_transformer_count(self) -> None:
        """1 transformer: TX-OSS-01."""
        tx_count = sum(1 for eq in OSS_EQUIPMENT if eq.equipment_type == EquipmentType.TRANSFORMER)
        assert tx_count == 1

    def test_unique_equipment_ids(self) -> None:
        """All equipment IDs are unique."""
        ids = [eq.equipment_id for eq in OSS_EQUIPMENT]
        assert len(ids) == len(set(ids))

    def test_initial_states_correct(self) -> None:
        """Earth switches start CLOSED; everything else starts OPEN."""
        for eq in OSS_EQUIPMENT:
            if eq.equipment_type == EquipmentType.EARTH_SWITCH:
                assert eq.initial_state == EquipmentState.CLOSED, (
                    f"{eq.equipment_id} should start CLOSED (earthed)"
                )
            else:
                assert eq.initial_state == EquipmentState.OPEN, (
                    f"{eq.equipment_id} should start OPEN"
                )

    def test_get_equipment_definition(self) -> None:
        """Can retrieve a specific equipment definition."""
        eq = get_equipment_definition("CB-OSS-220-01")
        assert eq.equipment_type == EquipmentType.CIRCUIT_BREAKER
        assert eq.voltage_kv == 220.0

    def test_get_equipment_not_found(self) -> None:
        """Raises EquipmentNotFoundError for unknown equipment."""
        with pytest.raises(EquipmentNotFoundError):
            get_equipment_definition("CB-DOES-NOT-EXIST")

    def test_build_initial_state(self) -> None:
        """Build initial state map has all 22 entries."""
        state = build_initial_state()
        assert len(state) == 22


# ── Valid Transitions ────────────────────────────────────────────


class TestValidTransitions:
    """Verify valid state transitions per equipment type."""

    def test_cb_has_4_transitions(self) -> None:
        """Circuit breakers have exactly 4 valid transitions."""
        assert len(CB_TRANSITIONS) == 4

    def test_ds_has_2_transitions(self) -> None:
        """Disconnectors have exactly 2 valid transitions."""
        assert len(DS_TRANSITIONS) == 2

    def test_es_has_2_transitions(self) -> None:
        """Earth switches have exactly 2 valid transitions."""
        assert len(ES_TRANSITIONS) == 2

    def test_tx_has_2_transitions(self) -> None:
        """Transformers have exactly 2 valid transitions."""
        assert len(TX_TRANSITIONS) == 2

    def test_cb_open_to_closed(self) -> None:
        """CB can close from OPEN state."""
        state = build_initial_state()
        # First open the earth switch and close the disconnector (for CB-ON-220-01)
        state["ES-ON-220-01"] = EquipmentState.OPEN
        state["DS-ON-220-01"] = EquipmentState.CLOSED
        result = execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)
        assert result.success
        assert result.new_state == EquipmentState.CLOSED

    def test_cb_closed_to_open(self) -> None:
        """CB can open from CLOSED state."""
        state = build_initial_state()
        state["ES-ON-220-01"] = EquipmentState.OPEN
        state["DS-ON-220-01"] = EquipmentState.CLOSED
        state["CB-ON-220-01"] = EquipmentState.CLOSED
        result = execute_switching_action("CB-ON-220-01", SwitchingAction.OPEN, state)
        assert result.success
        assert result.new_state == EquipmentState.OPEN

    def test_cb_rack_out(self) -> None:
        """CB can rack out from OPEN state."""
        state = build_initial_state()
        result = execute_switching_action("CB-ON-220-01", SwitchingAction.RACK_OUT, state)
        assert result.success
        assert result.new_state == EquipmentState.RACKED_OUT

    def test_cb_rack_in(self) -> None:
        """CB can rack in from RACKED_OUT state."""
        state = build_initial_state()
        state["CB-ON-220-01"] = EquipmentState.RACKED_OUT
        result = execute_switching_action("CB-ON-220-01", SwitchingAction.RACK_IN, state)
        assert result.success
        assert result.new_state == EquipmentState.OPEN

    def test_es_open(self) -> None:
        """Earth switch can open from CLOSED state."""
        state = build_initial_state()
        result = execute_switching_action("ES-ON-220-01", SwitchingAction.OPEN, state)
        assert result.success
        assert result.new_state == EquipmentState.OPEN

    def test_ds_close(self) -> None:
        """Disconnector can close from OPEN state (CB must be open)."""
        state = build_initial_state()
        result = execute_switching_action("DS-ON-220-01", SwitchingAction.CLOSE, state)
        assert result.success
        assert result.new_state == EquipmentState.CLOSED


# ── Invalid Transitions ─────────────────────────────────────────


class TestInvalidTransitions:
    """Verify invalid transitions are rejected."""

    def test_cb_cannot_close_from_racked_out(self) -> None:
        """CB cannot close directly from RACKED_OUT (must rack in first)."""
        state = build_initial_state()
        state["CB-ON-220-01"] = EquipmentState.RACKED_OUT
        with pytest.raises(InvalidTransitionError):
            execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)

    def test_es_cannot_rack_out(self) -> None:
        """Earth switches don't have rack in/out actions."""
        state = build_initial_state()
        with pytest.raises(InvalidTransitionError):
            execute_switching_action("ES-ON-220-01", SwitchingAction.RACK_OUT, state)

    def test_ds_cannot_rack_out(self) -> None:
        """Disconnectors don't have rack in/out actions."""
        state = build_initial_state()
        with pytest.raises(InvalidTransitionError):
            execute_switching_action("DS-ON-220-01", SwitchingAction.RACK_OUT, state)

    def test_equipment_not_found(self) -> None:
        """Unknown equipment raises EquipmentNotFoundError."""
        state = build_initial_state()
        with pytest.raises(EquipmentNotFoundError):
            execute_switching_action("CB-FAKE-01", SwitchingAction.CLOSE, state)


# ── Interlock Verification ───────────────────────────────────────


class TestInterlocks:
    """Verify all 5 safety interlocks per IEC 61936-1."""

    def test_ilk001_cannot_close_cb_if_es_closed(self) -> None:
        """ILK-001: Cannot close CB if earth switch CLOSED."""
        state = build_initial_state()
        # ES-ON-220-01 is CLOSED (initial), DS-ON-220-01 is OPEN
        state["DS-ON-220-01"] = EquipmentState.CLOSED
        # CB-ON-220-01 is OPEN — try to close it with ES still CLOSED
        with pytest.raises(InterlockError) as exc_info:
            execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)
        assert any(v.interlock_id == "ILK-001" for v in exc_info.value.violations)

    def test_ilk002_cannot_close_es_if_cb_closed(self) -> None:
        """ILK-002: Cannot close earth switch if CB CLOSED."""
        state = build_initial_state()
        state["ES-ON-220-01"] = EquipmentState.OPEN
        state["DS-ON-220-01"] = EquipmentState.CLOSED
        state["CB-ON-220-01"] = EquipmentState.CLOSED
        with pytest.raises(InterlockError) as exc_info:
            execute_switching_action("ES-ON-220-01", SwitchingAction.CLOSE, state)
        assert any(v.interlock_id == "ILK-002" for v in exc_info.value.violations)

    def test_ilk003_cannot_close_ds_if_cb_closed(self) -> None:
        """ILK-003: Cannot close disconnector if CB CLOSED."""
        state = build_initial_state()
        state["ES-ON-220-01"] = EquipmentState.OPEN
        state["DS-ON-220-01"] = EquipmentState.OPEN
        state["CB-ON-220-01"] = EquipmentState.CLOSED
        with pytest.raises(InterlockError) as exc_info:
            execute_switching_action("DS-ON-220-01", SwitchingAction.CLOSE, state)
        assert any(v.interlock_id == "ILK-003" for v in exc_info.value.violations)

    def test_ilk003_cannot_open_ds_if_cb_closed(self) -> None:
        """ILK-003: Cannot open disconnector if CB CLOSED."""
        state = build_initial_state()
        state["ES-ON-220-01"] = EquipmentState.OPEN
        state["DS-ON-220-01"] = EquipmentState.CLOSED
        state["CB-ON-220-01"] = EquipmentState.CLOSED
        with pytest.raises(InterlockError) as exc_info:
            execute_switching_action("DS-ON-220-01", SwitchingAction.OPEN, state)
        assert any(v.interlock_id == "ILK-003" for v in exc_info.value.violations)

    def test_ilk004_cannot_close_cb_if_ds_open(self) -> None:
        """ILK-004: Cannot close CB if disconnector OPEN."""
        state = build_initial_state()
        state["ES-ON-220-01"] = EquipmentState.OPEN
        # DS-ON-220-01 starts OPEN — interlock should fire
        with pytest.raises(InterlockError) as exc_info:
            execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)
        assert any(v.interlock_id == "ILK-004" for v in exc_info.value.violations)

    def test_ilk005_cannot_rack_out_cb_if_closed(self) -> None:
        """ILK-005: Cannot rack out CB if CLOSED.

        Note: The transition map also rejects (CLOSED, RACK_OUT), so we
        test check_interlocks() directly to verify ILK-005 fires.
        """
        state = build_initial_state()
        state["CB-ON-220-01"] = EquipmentState.CLOSED
        violations = check_interlocks("CB-ON-220-01", SwitchingAction.RACK_OUT, state)
        assert any(v.interlock_id == "ILK-005" for v in violations)


# ── State Preservation ───────────────────────────────────────────


class TestStatePreservation:
    """Verify state is not mutated on failed actions."""

    def test_state_unchanged_on_interlock_failure(self) -> None:
        """State map is not modified when interlock prevents action."""
        state = build_initial_state()
        original = dict(state)
        with pytest.raises(InterlockError):
            execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)
        assert state == original

    def test_state_unchanged_on_invalid_transition(self) -> None:
        """State map is not modified on invalid transition."""
        state = build_initial_state()
        state["CB-ON-220-01"] = EquipmentState.RACKED_OUT
        original = dict(state)
        with pytest.raises(InvalidTransitionError):
            execute_switching_action("CB-ON-220-01", SwitchingAction.CLOSE, state)
        assert state == original

    def test_state_updated_on_success(self) -> None:
        """State map is updated on successful action."""
        state = build_initial_state()
        assert state["ES-ON-220-01"] == EquipmentState.CLOSED
        execute_switching_action("ES-ON-220-01", SwitchingAction.OPEN, state)
        assert state["ES-ON-220-01"] == EquipmentState.OPEN
