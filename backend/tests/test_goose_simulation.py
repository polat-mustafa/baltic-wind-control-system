"""
Unit tests for GOOSE messaging and protection simulation (P3 — goose_simulation.py).

Tests validate the IEC 61850-8-1 GOOSE protocol simulation including:
- GOOSE message PDU field correctness
- Protection fault timelines (event ordering, timing)
- IEC 61850-8-1 compliance (GOOSE latency < 4 ms)
- IEC 62271-100 compliance (fault clearance < 80 ms)
- GOOSE retransmission schedule (exponential backoff)
- All three fault scenarios produce valid results
- stNum/sqNum semantics (state vs sequence numbering)

Test Strategy
-------------
- Deterministic: all timings are fixed, no randomness
- Physics-validated: fault clearance times match IEC standards
- Exhaustive scenarios: all fault types tested individually
- Edge cases: retransmission boundary conditions
"""

import pytest

from app.services.p3.goose_simulation import (
    FAULT_CLEARANCE_MAX_MS,
    GOOSE_MAX_LATENCY_MS,
    EventType,
    FaultLocation,
    FaultType,
    ProtectionFunction,
    calculate_retransmission_schedule,
    create_busbar_overcurrent_scenario,
    create_cable_earth_fault_scenario,
    create_scenario,
    create_transformer_differential_scenario,
    get_available_scenarios,
    simulate_fault,
)

# ── GOOSE Message Tests ───────────────────────────────────────────


class TestGOOSEMessage:
    """Tests for GOOSE PDU structure and field correctness."""

    def test_goose_message_has_gocb_ref(self):
        """GOOSE PDU must have a valid gocbRef following IEC 61850 naming."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert "LLN0$GO$" in msg.gocb_ref
        assert msg.gocb_ref.startswith(scenario.publisher_ied)

    def test_goose_message_has_dataset_ref(self):
        """GOOSE PDU must reference the trip dataset."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert "LLN0$" in msg.dat_set
        assert "TripDataset" in msg.dat_set

    def test_goose_initial_message_st_num_is_one(self):
        """First state change: stNum = 1 (initial trip)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert msg.st_num == 1

    def test_goose_initial_message_sq_num_is_zero(self):
        """First message of a state change: sqNum = 0."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert msg.sq_num == 0

    def test_goose_retransmission_increments_sq_num(self):
        """Retransmission increments sqNum while stNum stays the same."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        initial = result.goose_messages[0]
        retransmit = result.goose_messages[1]
        assert retransmit.st_num == initial.st_num
        assert retransmit.sq_num == initial.sq_num + 1

    def test_goose_message_has_trip_signals(self):
        """GOOSE PDU all_data must contain trip signal values."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert len(msg.all_data) > 0
        assert all(isinstance(v, bool) for v in msg.all_data.values())

    def test_goose_message_trip_values_are_true(self):
        """Trip signals must be True (commanding breaker to open)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert all(msg.all_data.values()), "All trip signals should be True"

    def test_goose_message_has_multicast_mac(self):
        """GOOSE uses multicast MAC per IEC 61850-8-1 Annex A: 01:0C:CD:01:xx:xx."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert msg.mac_address.startswith("01:0C:CD:01")

    def test_goose_message_has_vlan(self):
        """GOOSE traffic must be on a dedicated VLAN (typically 100-199)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert 1 <= msg.vlan_id <= 4094

    def test_goose_message_has_app_id(self):
        """GOOSE PDU must have an Application ID."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert msg.app_id.startswith("0x")

    def test_goose_message_has_utc_timestamp(self):
        """GOOSE timestamp must be UTC (IEEE 1588 precision)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        msg = result.goose_messages[0]
        assert msg.timestamp.tzinfo is not None


# ── Protection Timeline Tests ─────────────────────────────────────


class TestProtectionTimeline:
    """Tests for the protection fault clearance event timeline."""

    def test_timeline_starts_at_zero(self):
        """Timeline must start at t = 0 ms (fault inception)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.events[0].timestamp_ms == 0.0

    def test_timeline_first_event_is_fault(self):
        """First event must be the fault occurrence."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.events[0].event_type == EventType.FAULT_OCCURS

    def test_timeline_events_are_monotonically_ordered(self):
        """All events must be in chronological order (non-decreasing time)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        timestamps = [e.timestamp_ms for e in result.events]
        for i in range(1, len(timestamps)):
            assert timestamps[i] >= timestamps[i - 1], (
                f"Event {i} ({result.events[i].event_type}) at {timestamps[i]} ms "
                f"is before event {i - 1} ({result.events[i - 1].event_type}) "
                f"at {timestamps[i - 1]} ms"
            )

    def test_timeline_contains_all_critical_events(self):
        """Timeline must include detection, GOOSE publish/receive, breaker, and clearance."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        event_types = {e.event_type for e in result.events}
        required_events = {
            EventType.FAULT_OCCURS,
            EventType.PROTECTION_DETECTS,
            EventType.GOOSE_PUBLISHED,
            EventType.GOOSE_RECEIVED,
            EventType.BREAKER_OPEN,
            EventType.FAULT_CLEARED,
            EventType.SCADA_ALARM,
        }
        assert required_events.issubset(event_types), (
            f"Missing events: {required_events - event_types}"
        )

    def test_goose_published_before_received(self):
        """GOOSE publish must occur before receive (causality)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        pub_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.GOOSE_PUBLISHED
        )
        recv_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.GOOSE_RECEIVED
        )
        assert pub_time < recv_time

    def test_detection_before_goose(self):
        """Protection detection must occur before GOOSE publication."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        detect_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.PROTECTION_DETECTS
        )
        pub_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.GOOSE_PUBLISHED
        )
        assert detect_time < pub_time

    def test_breaker_opens_after_goose_received(self):
        """Breaker cannot open before receiving the GOOSE trip command."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        recv_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.GOOSE_RECEIVED
        )
        breaker_time = next(
            e.timestamp_ms for e in result.events if e.event_type == EventType.BREAKER_OPEN
        )
        assert breaker_time > recv_time

    def test_scada_alarm_is_last_and_much_later(self):
        """SCADA alarm arrives ~260 ms later — NOT used for protection."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        scada_event = next(e for e in result.events if e.event_type == EventType.SCADA_ALARM)
        clearance_event = next(e for e in result.events if e.event_type == EventType.FAULT_CLEARED)
        # SCADA alarm should be much slower than fault clearance
        assert scada_event.timestamp_ms > clearance_event.timestamp_ms
        # SCADA alarm should be > 200 ms (IEC 60870-5-104 polling cycle)
        assert scada_event.timestamp_ms > 200.0

    def test_timeline_events_have_descriptions(self):
        """All events must have non-empty descriptions for educational clarity."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        for event in result.events:
            assert event.description, f"Event {event.event_type} has no description"


# ── IEC Compliance Tests ──────────────────────────────────────────


class TestIECCompliance:
    """Tests for IEC 61850-8-1 and IEC 62271-100 compliance."""

    def test_goose_latency_below_4ms(self):
        """GOOSE latency must be < 4 ms per IEC 61850-8-1."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.goose_latency_ms < GOOSE_MAX_LATENCY_MS

    def test_goose_compliance_flag_is_true(self):
        """Compliance flag must agree with the latency check."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.goose_compliant is True

    def test_fault_clearance_below_80ms(self):
        """Total fault clearance must be < 80 ms per IEC 62271-100."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.total_clearance_ms < FAULT_CLEARANCE_MAX_MS

    def test_clearance_compliance_flag_is_true(self):
        """Clearance compliance flag must agree with the timing check."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.clearance_compliant is True

    @pytest.mark.parametrize("fault_type", list(FaultType))
    def test_all_scenarios_are_goose_compliant(self, fault_type: FaultType):
        """Every fault scenario must achieve < 4 ms GOOSE latency."""
        scenario = create_scenario(fault_type)
        result = simulate_fault(scenario)
        assert result.goose_compliant, (
            f"{fault_type}: GOOSE latency {result.goose_latency_ms} ms >= {GOOSE_MAX_LATENCY_MS} ms"
        )

    @pytest.mark.parametrize("fault_type", list(FaultType))
    def test_all_scenarios_are_clearance_compliant(self, fault_type: FaultType):
        """Every fault scenario must achieve < 80 ms total clearance."""
        scenario = create_scenario(fault_type)
        result = simulate_fault(scenario)
        assert result.clearance_compliant, (
            f"{fault_type}: clearance {result.total_clearance_ms} ms >= {FAULT_CLEARANCE_MAX_MS} ms"
        )

    def test_goose_latency_is_positive(self):
        """GOOSE latency must be a positive value (non-zero transport time)."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert result.goose_latency_ms > 0.0


# ── Fault Scenario Tests ──────────────────────────────────────────


class TestFaultScenarios:
    """Tests for individual fault scenario configurations."""

    def test_busbar_overcurrent_uses_ptoc(self):
        """Busbar overcurrent should use PTOC (time overcurrent) protection."""
        scenario = create_busbar_overcurrent_scenario()
        assert scenario.protection_function == ProtectionFunction.PTOC

    def test_busbar_overcurrent_fault_current(self):
        """Busbar fault current should be 2.5 pu (250% of nominal)."""
        scenario = create_busbar_overcurrent_scenario()
        assert scenario.fault_current_pu == 2.5

    def test_transformer_differential_uses_pdif(self):
        """Transformer fault should use PDIF (differential) protection."""
        scenario = create_transformer_differential_scenario()
        assert scenario.protection_function == ProtectionFunction.PDIF

    def test_transformer_differential_higher_current(self):
        """Transformer internal fault produces higher fault current than busbar."""
        bb = create_busbar_overcurrent_scenario()
        tx = create_transformer_differential_scenario()
        assert tx.fault_current_pu > bb.fault_current_pu

    def test_cable_earth_fault_location(self):
        """Cable fault should be located at the export cable."""
        scenario = create_cable_earth_fault_scenario()
        assert scenario.location == FaultLocation.EXPORT_CABLE

    def test_cable_fault_slower_detection(self):
        """Cable earth fault detection is slower (directional discrimination)."""
        bb = create_busbar_overcurrent_scenario()
        cable = create_cable_earth_fault_scenario()
        bb_result = simulate_fault(bb)
        cable_result = simulate_fault(cable)
        # Cable detection takes longer due to directional element
        assert cable_result.total_clearance_ms > bb_result.total_clearance_ms

    def test_all_scenarios_have_publisher_ied(self):
        """Every scenario must have a valid publisher IED."""
        for ft in FaultType:
            scenario = create_scenario(ft)
            assert scenario.publisher_ied, f"{ft} has no publisher IED"

    def test_all_scenarios_have_subscriber_ieds(self):
        """Every scenario must have at least one subscriber IED."""
        for ft in FaultType:
            scenario = create_scenario(ft)
            assert len(scenario.subscriber_ieds) > 0, f"{ft} has no subscribers"

    def test_all_scenarios_have_descriptions(self):
        """Every scenario must have a non-empty description."""
        for ft in FaultType:
            scenario = create_scenario(ft)
            assert scenario.description, f"{ft} has no description"


# ── Scenario Registry Tests ───────────────────────────────────────


class TestScenarioRegistry:
    """Tests for the scenario creation and listing functions."""

    def test_get_available_scenarios_returns_all(self):
        """Available scenarios list should contain all fault types."""
        scenarios = get_available_scenarios()
        fault_types = {s["fault_type"] for s in scenarios}
        assert fault_types == {ft.value for ft in FaultType}

    def test_create_scenario_valid_type(self):
        """create_scenario should return a scenario for valid fault types."""
        scenario = create_scenario(FaultType.BUSBAR_OVERCURRENT)
        assert scenario.fault_type == FaultType.BUSBAR_OVERCURRENT

    def test_create_scenario_invalid_type_raises(self):
        """create_scenario should raise ValueError for unknown types."""
        with pytest.raises(ValueError, match="Unknown fault type"):
            create_scenario("nonexistent_fault")  # type: ignore[arg-type]


# ── Retransmission Schedule Tests ─────────────────────────────────


class TestRetransmissionSchedule:
    """Tests for GOOSE retransmission per IEC 61850-8-1 §15.2.2."""

    def test_schedule_length(self):
        """Schedule should have exactly num_retransmissions entries."""
        schedule = calculate_retransmission_schedule(
            min_time_ms=2,
            max_time_ms=1000,
            num_retransmissions=10,
        )
        assert len(schedule) == 10

    def test_first_retransmission_at_min_time(self):
        """First retransmission should be at T0 = min_time_ms."""
        schedule = calculate_retransmission_schedule(
            min_time_ms=2,
            max_time_ms=1000,
            num_retransmissions=5,
        )
        assert schedule[0] == 2.0

    def test_schedule_is_monotonically_increasing(self):
        """Cumulative timestamps must always increase."""
        schedule = calculate_retransmission_schedule(
            min_time_ms=2,
            max_time_ms=1000,
            num_retransmissions=10,
        )
        for i in range(1, len(schedule)):
            assert schedule[i] > schedule[i - 1]

    def test_intervals_double_up_to_max(self):
        """Intervals should double each time until reaching max_time."""
        schedule = calculate_retransmission_schedule(
            min_time_ms=2,
            max_time_ms=1000,
            num_retransmissions=15,
        )
        # Calculate individual intervals
        intervals = [schedule[0]]
        for i in range(1, len(schedule)):
            intervals.append(schedule[i] - schedule[i - 1])

        # First few intervals should double: 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000
        assert intervals[0] == 2.0
        assert intervals[1] == 4.0
        assert intervals[2] == 8.0
        assert intervals[3] == 16.0

    def test_intervals_capped_at_max(self):
        """No interval should exceed max_time_ms."""
        schedule = calculate_retransmission_schedule(
            min_time_ms=2,
            max_time_ms=1000,
            num_retransmissions=15,
        )
        intervals = [schedule[0]]
        for i in range(1, len(schedule)):
            intervals.append(schedule[i] - schedule[i - 1])

        for interval in intervals:
            assert interval <= 1000.0

    def test_default_parameters(self):
        """Default parameters should produce a valid schedule."""
        schedule = calculate_retransmission_schedule()
        assert len(schedule) == 10
        assert schedule[0] == 2.0

    def test_simulation_result_has_retransmission(self):
        """Simulation result must include the retransmission schedule."""
        scenario = create_busbar_overcurrent_scenario()
        result = simulate_fault(scenario)
        assert len(result.retransmission_schedule_ms) > 0
        assert result.retransmission_schedule_ms[0] > 0
