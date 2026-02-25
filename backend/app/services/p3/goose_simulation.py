"""
GOOSE messaging and protection simulation for 510 MW Baltic Sea OWF.

Simulates IEC 61850-8-1 GOOSE (Generic Object-Oriented Substation Event)
messaging for protection fault scenarios in the offshore substation.

Physics — Why GOOSE Exists
---------------------------
When a short-circuit fault occurs on a 220 kV busbar, the arc energy is
proportional to I²t. At 2.5× nominal current through a 1,200 A busbar,
every millisecond matters:

  Arc energy ∝ I² × t_clearance

If clearance takes 80 ms instead of 60 ms, the arc energy increases by 33%.
This can destroy switchgear (IEC 62271-200 rated for specific arc duration),
damage bus ducts, and cause cascading failures. The protection system must
detect the fault, communicate the trip command, and mechanically open the
circuit breaker — all within 80 ms (IEC 62271-100).

Standard — IEC 61850-8-1 GOOSE Protocol
-----------------------------------------
GOOSE operates at Ethernet Layer 2 (no IP routing, no TCP overhead):
  - Multicast MAC addressing (01:0C:CD:01:xx:xx per IEC 61850-8-1 Annex A)
  - Publish-subscribe model: publisher IED sends, all subscribers receive
  - Typical latency: < 1 ms on dedicated VLAN
  - Requirement: < 4 ms end-to-end (publisher → subscriber)

GOOSE retransmission scheme (IEC 61850-8-1 §15.2.2):
  On state change: send immediately, then retransmit at T0 = min_time
  Retransmission intervals double: T0, 2×T0, 4×T0, 8×T0, ..., up to max_time
  This ensures reliability without TCP acknowledgements.

GOOSE PDU key fields:
  - gocbRef: GOOSE Control Block reference (identifies the publisher)
  - datSet: dataset reference (which data objects are included)
  - goID: human-readable GOOSE identifier
  - stNum: state number — increments on each state CHANGE
  - sqNum: sequence number — increments on each retransmission, resets on stNum change
  - allData: the actual data values (trip signals, breaker positions)
  - t: timestamp of the state change (UTC, IEEE 1588 precision)

Standard — IEC 62271-100 Fault Clearance
------------------------------------------
Maximum fault clearance time for HV circuit breakers:
  - 220 kV busbar fault: < 80 ms (total protection + breaker operating time)
  - Breaker mechanical time: 20-60 ms (spring-operated mechanism)
  - Protection relay operate time: 15-30 ms (digital relay processing)
  - GOOSE transport: < 4 ms (Layer 2 Ethernet)

Maths — Fault Clearance Timeline
----------------------------------
Total clearance = t_detect + t_relay + t_goose + t_breaker

For 220 kV busbar overcurrent (our reference scenario):
  t_detect = 2.0 ms (CT secondary current exceeds pickup: I_fault/I_nominal > 2.0)
  t_relay  = 0.5 ms (digital relay processing after detection)
  t_goose  = 1.5 ms (GOOSE message Layer 2 transport)
  t_breaker = 40.0 ms (spring mechanism + arc extinction)
  t_scada  = 260.0 ms (IEC 60870-5-104 polling delay — NOT used for protection)

  Total = 2.0 + 0.5 + 1.5 + 40.0 = 44.0 ms < 80 ms ✓

References
----------
- IEC 61850-8-1: Specific communication service mapping (SCSM) —
  Mappings to MMS and to ISO/IEC 8802-3
- IEC 62271-100: High-voltage switchgear and controlgear — AC circuit-breakers
- IEC 62271-200: AC metal-enclosed switchgear and controlgear for rated
  voltages above 1 kV and up to and including 52 kV
- IEC 61850-7-2: Abstract communication service interface (ACSI)
- IEC 60870-5-104: Telecontrol equipment and systems — Network access
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

from app.services.p3.iec61850_model import build_oss_goose_control_block

# ── Enums ──────────────────────────────────────────────────────────


class FaultType(StrEnum):
    """Protection fault scenarios for the 220 kV OSS busbar.

    Each fault type triggers different protection functions:
    - Overcurrent (PTOC): I > pickup threshold, fastest for close-in faults
    - Transformer differential (PDIF): current imbalance across TX windings
    - Cable earth fault (PTOC + directional): ground fault on export cable
    """

    BUSBAR_OVERCURRENT = "busbar_overcurrent"
    TRANSFORMER_DIFFERENTIAL = "transformer_differential"
    CABLE_EARTH_FAULT = "cable_earth_fault"


class FaultLocation(StrEnum):
    """Physical location of the fault within the OSS."""

    BUSBAR_220KV = "220kV_busbar"
    TRANSFORMER_OSS = "oss_transformer"
    EXPORT_CABLE = "export_cable"


class ProtectionFunction(StrEnum):
    """IEC 61850-7-4 protection logical node classes that can trip."""

    PTOC = "PTOC"  # Time overcurrent
    PDIS = "PDIS"  # Distance protection
    PTOV = "PTOV"  # Overvoltage
    PDIF = "PDIF"  # Differential (modelled, not in base LN set)


class EventType(StrEnum):
    """Discrete events in a protection fault clearance timeline."""

    FAULT_OCCURS = "fault_occurs"
    PROTECTION_DETECTS = "protection_detects"
    RELAY_PROCESSES = "relay_processes"
    GOOSE_PUBLISHED = "goose_published"
    GOOSE_RECEIVED = "goose_received"
    BREAKER_TRIP_INITIATED = "breaker_trip_initiated"
    BREAKER_OPEN = "breaker_open"
    ARC_EXTINGUISHED = "arc_extinguished"
    FAULT_CLEARED = "fault_cleared"
    SCADA_ALARM = "scada_alarm"


# ── Timing Constants (deterministic for reproducibility) ────────────
#
# These are realistic values based on IEC standards and manufacturer data.
# We use fixed values (not random) so tests are deterministic and students
# can trace every millisecond of the protection sequence.

# Detection times by fault type [ms]
_DETECTION_TIMES_MS: dict[FaultType, float] = {
    FaultType.BUSBAR_OVERCURRENT: 2.0,  # Fast CT pickup, close-in fault
    FaultType.TRANSFORMER_DIFFERENTIAL: 5.0,  # Differential comparison
    FaultType.CABLE_EARTH_FAULT: 8.0,  # Directional element + time delay
}

# Relay digital processing time after detection [ms]
_RELAY_PROCESSING_MS = 0.5

# GOOSE Layer 2 transport time [ms] — publisher to subscriber
_GOOSE_TRANSPORT_MS = 1.5

# Circuit breaker mechanical operating time [ms]
# Spring-operated mechanism: 20-60 ms typical (IEC 62271-100)
_BREAKER_MECHANICAL_MS = 40.0

# Arc extinction time after contact separation [ms]
_ARC_EXTINCTION_MS = 15.0

# SCADA alarm delay via IEC 60870-5-104 polling [ms]
# This is NOT used for protection — it's the operator notification delay
_SCADA_POLLING_DELAY_MS = 260.0

# IEC compliance thresholds
GOOSE_MAX_LATENCY_MS = 4.0  # IEC 61850-8-1 requirement
FAULT_CLEARANCE_MAX_MS = 80.0  # IEC 62271-100 for 220 kV


# ── Data Models ────────────────────────────────────────────────────


@dataclass(frozen=True)
class ProtectionEvent:
    """A single event in the protection fault clearance timeline.

    Attributes
    ----------
    event_type : EventType
        What happened at this point in the timeline.
    timestamp_ms : float
        Time since fault inception [ms].
    description : str
        Human-readable description of the event.
    ied_name : str
        IED involved in this event (publisher or subscriber).
    """

    event_type: EventType
    timestamp_ms: float
    description: str
    ied_name: str = ""


@dataclass(frozen=True)
class GOOSEMessage:
    """IEC 61850-8-1 GOOSE Protocol Data Unit (PDU).

    Models the complete GOOSE frame as published on the Ethernet network.
    In a real system, this would be an Ethernet frame with EtherType 0x88B8.

    Attributes
    ----------
    gocb_ref : str
        GOOSE Control Block reference: {IED}/{LLN0}$GO${gcb_name}.
    dat_set : str
        Dataset reference: {IED}/{LLN0}${dataset_name}.
    go_id : str
        Human-readable GOOSE identifier.
    st_num : int
        State number — increments on each state CHANGE.
    sq_num : int
        Sequence number — increments per retransmission, resets on state change.
    all_data : dict[str, bool]
        Dataset member values: {signal_name: trip_value}.
    timestamp : datetime
        UTC timestamp of the state change (IEEE 1588 precision).
    app_id : str
        GOOSE Application ID (hex string).
    mac_address : str
        Multicast destination MAC per IEC 61850-8-1 Annex A.
    vlan_id : int
        VLAN ID for GOOSE traffic separation.
    """

    gocb_ref: str
    dat_set: str
    go_id: str
    st_num: int
    sq_num: int
    all_data: dict[str, bool] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))
    app_id: str = "0x0001"
    mac_address: str = "01:0C:CD:01:00:01"
    vlan_id: int = 100


@dataclass(frozen=True)
class FaultScenario:
    """Configuration for a protection fault simulation.

    Attributes
    ----------
    fault_type : FaultType
        Type of electrical fault.
    location : FaultLocation
        Physical location within the OSS.
    fault_current_pu : float
        Fault current magnitude in per-unit of nominal (e.g., 2.5 = 250%).
    nominal_current_a : float
        Nominal current at the fault location [A].
    protection_function : ProtectionFunction
        Primary protection function that trips.
    publisher_ied : str
        IED that publishes the GOOSE trip message.
    subscriber_ieds : tuple[str, ...]
        IEDs that subscribe to the GOOSE trip (circuit breakers).
    description : str
        Human-readable scenario description.
    """

    fault_type: FaultType
    location: FaultLocation
    fault_current_pu: float
    nominal_current_a: float
    protection_function: ProtectionFunction
    publisher_ied: str
    subscriber_ieds: tuple[str, ...]
    description: str = ""


@dataclass(frozen=True)
class FaultSimulationResult:
    """Complete result of a GOOSE protection fault simulation.

    Attributes
    ----------
    scenario : FaultScenario
        The fault scenario that was simulated.
    events : tuple[ProtectionEvent, ...]
        Ordered timeline of protection events.
    goose_messages : tuple[GOOSEMessage, ...]
        GOOSE messages published during the simulation.
    goose_latency_ms : float
        GOOSE publisher-to-subscriber latency [ms].
    total_clearance_ms : float
        Total fault clearance time [ms] (fault → arc extinguished).
    goose_compliant : bool
        True if GOOSE latency < 4 ms (IEC 61850-8-1).
    clearance_compliant : bool
        True if total clearance < 80 ms (IEC 62271-100).
    retransmission_schedule_ms : tuple[float, ...]
        GOOSE retransmission timestamps [ms] after initial publish.
    """

    scenario: FaultScenario
    events: tuple[ProtectionEvent, ...]
    goose_messages: tuple[GOOSEMessage, ...]
    goose_latency_ms: float
    total_clearance_ms: float
    goose_compliant: bool
    clearance_compliant: bool
    retransmission_schedule_ms: tuple[float, ...]


# ── Scenario Builders ──────────────────────────────────────────────


def create_busbar_overcurrent_scenario() -> FaultScenario:
    """Create 220 kV busbar overcurrent fault scenario.

    A three-phase short circuit on the 220 kV busbar produces 2.5× nominal
    current. PTOC (time overcurrent) is the primary protection function.
    The protection IED publishes a GOOSE trip to all busbar circuit breakers.

    Returns
    -------
    FaultScenario
        Configured busbar overcurrent scenario.
    """
    return FaultScenario(
        fault_type=FaultType.BUSBAR_OVERCURRENT,
        location=FaultLocation.BUSBAR_220KV,
        fault_current_pu=2.5,
        nominal_current_a=1200.0,
        protection_function=ProtectionFunction.PTOC,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            "220 kV busbar three-phase overcurrent fault: I = 2.5 pu (3,000 A). "
            "PTOC1 detects overcurrent, publishes GOOSE trip to all busbar CBs."
        ),
    )


def create_transformer_differential_scenario() -> FaultScenario:
    """Create OSS transformer differential fault scenario.

    An internal winding fault causes current imbalance between HV and LV
    sides of the OSS power transformer. Differential protection (PDIF)
    detects the imbalance and trips both HV and LV circuit breakers.

    Returns
    -------
    FaultScenario
        Configured transformer differential scenario.
    """
    return FaultScenario(
        fault_type=FaultType.TRANSFORMER_DIFFERENTIAL,
        location=FaultLocation.TRANSFORMER_OSS,
        fault_current_pu=5.0,
        nominal_current_a=1200.0,
        protection_function=ProtectionFunction.PDIF,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            "OSS transformer internal winding fault: differential current = 5.0 pu. "
            "PDIF detects HV/LV current imbalance, trips both sides."
        ),
    )


def create_cable_earth_fault_scenario() -> FaultScenario:
    """Create 220 kV export cable single-phase earth fault scenario.

    A cable insulation failure on the 45 km export cable causes a
    single-phase-to-earth fault. Directional overcurrent (PTOC with
    directional element) detects the fault with a longer detection time
    due to the directional discrimination requirement.

    Returns
    -------
    FaultScenario
        Configured cable earth fault scenario.
    """
    return FaultScenario(
        fault_type=FaultType.CABLE_EARTH_FAULT,
        location=FaultLocation.EXPORT_CABLE,
        fault_current_pu=1.8,
        nominal_current_a=1200.0,
        protection_function=ProtectionFunction.PTOC,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            "Export cable single-phase earth fault: I = 1.8 pu (2,160 A). "
            "Directional PTOC detects fault with cable-end discrimination."
        ),
    )


# ── Scenario Registry ─────────────────────────────────────────────

_SCENARIO_BUILDERS: dict[FaultType, Callable[[], FaultScenario]] = {
    FaultType.BUSBAR_OVERCURRENT: create_busbar_overcurrent_scenario,
    FaultType.TRANSFORMER_DIFFERENTIAL: create_transformer_differential_scenario,
    FaultType.CABLE_EARTH_FAULT: create_cable_earth_fault_scenario,
}


def get_available_scenarios() -> list[dict[str, str]]:
    """List all available fault scenarios with descriptions.

    Returns
    -------
    list[dict[str, str]]
        List of scenario summaries with fault_type and description.
    """
    return [
        {
            "fault_type": ft.value,
            "description": builder().description,
        }
        for ft, builder in _SCENARIO_BUILDERS.items()
    ]


def create_scenario(fault_type: FaultType) -> FaultScenario:
    """Create a fault scenario by type.

    Parameters
    ----------
    fault_type : FaultType
        The type of fault to simulate.

    Returns
    -------
    FaultScenario
        Configured fault scenario.

    Raises
    ------
    ValueError
        If the fault type is not recognised.
    """
    builder = _SCENARIO_BUILDERS.get(fault_type)
    if builder is None:
        msg = f"Unknown fault type: {fault_type}"
        raise ValueError(msg)
    return builder()


# ── GOOSE Retransmission Schedule ──────────────────────────────────


def calculate_retransmission_schedule(
    min_time_ms: int = 2,
    max_time_ms: int = 1000,
    num_retransmissions: int = 10,
) -> tuple[float, ...]:
    """Calculate GOOSE retransmission timestamps per IEC 61850-8-1 §15.2.2.

    After a state change, the GOOSE message is sent immediately. Then it
    is retransmitted with exponentially increasing intervals:
      T0, 2×T0, 4×T0, 8×T0, ..., capped at max_time.

    This "fast retransmission" scheme ensures reliability on unreliable
    Layer 2 Ethernet without TCP acknowledgements.

    Parameters
    ----------
    min_time_ms : int
        Initial retransmission interval T0 [ms]. Default: 2 ms.
    max_time_ms : int
        Maximum retransmission interval [ms]. Default: 1000 ms.
    num_retransmissions : int
        Number of retransmissions to calculate. Default: 10.

    Returns
    -------
    tuple[float, ...]
        Cumulative timestamps of each retransmission [ms] after initial send.
    """
    intervals: list[float] = []
    current_interval = float(min_time_ms)
    cumulative = 0.0

    for _ in range(num_retransmissions):
        cumulative += current_interval
        intervals.append(cumulative)
        current_interval = min(current_interval * 2, float(max_time_ms))

    return tuple(intervals)


# ── GOOSE Message Builder ──────────────────────────────────────────


def build_goose_trip_message(
    publisher_ied: str,
    trip_signals: dict[str, bool],
    st_num: int = 1,
    sq_num: int = 0,
    timestamp: datetime | None = None,
) -> GOOSEMessage:
    """Build a GOOSE trip message from the protection IED.

    Creates an IEC 61850-8-1 GOOSE PDU with proper gocbRef formatting,
    dataset reference, and the trip signal data.

    Parameters
    ----------
    publisher_ied : str
        IED name publishing the GOOSE message.
    trip_signals : dict[str, bool]
        Signal name → trip value mapping (True = trip commanded).
    st_num : int
        State number (increments on state change).
    sq_num : int
        Sequence number (increments on retransmission).
    timestamp : datetime | None
        Event timestamp. Defaults to current UTC time.

    Returns
    -------
    GOOSEMessage
        Complete GOOSE PDU ready for (simulated) publication.
    """
    gcb = build_oss_goose_control_block(ied_name=publisher_ied)

    if timestamp is None:
        timestamp = datetime.now(UTC)

    return GOOSEMessage(
        gocb_ref=f"{publisher_ied}/LLN0$GO${gcb.name}",
        dat_set=f"{publisher_ied}/LLN0${gcb.dataset_name}",
        go_id=gcb.go_id,
        st_num=st_num,
        sq_num=sq_num,
        all_data=trip_signals,
        timestamp=timestamp,
        app_id=gcb.app_id,
        mac_address=gcb.mac_address,
        vlan_id=gcb.vlan_id,
    )


# ── Protection Timeline Simulation ────────────────────────────────


def simulate_fault(scenario: FaultScenario) -> FaultSimulationResult:
    """Simulate a complete protection fault clearance sequence.

    Generates a deterministic timeline of protection events from fault
    inception through SCADA alarm, including GOOSE message publication
    and retransmission schedule.

    The timeline follows the real protection sequence:
      1. Fault occurs on the power system
      2. Protection relay CT/VT detects abnormal current/voltage
      3. Relay digital processing (comparison, logic, timer)
      4. GOOSE trip message published on Layer 2 Ethernet
      5. Subscriber IEDs receive GOOSE trip
      6. Circuit breaker trip coil energised
      7. Breaker contacts separate (mechanical time)
      8. Arc extinguished (within SF6 or vacuum chamber)
      9. Fault cleared — power system stable
      10. SCADA alarm reaches control centre (IEC 60870-5-104)

    Parameters
    ----------
    scenario : FaultScenario
        The fault scenario to simulate.

    Returns
    -------
    FaultSimulationResult
        Complete simulation result with timeline, GOOSE messages,
        compliance status, and retransmission schedule.
    """
    detection_ms = _DETECTION_TIMES_MS[scenario.fault_type]
    fault_current_a = scenario.fault_current_pu * scenario.nominal_current_a

    # Build deterministic timeline
    t = 0.0
    events: list[ProtectionEvent] = []

    # 1. Fault occurs
    events.append(
        ProtectionEvent(
            event_type=EventType.FAULT_OCCURS,
            timestamp_ms=t,
            description=(
                f"Fault on {scenario.location.value}: "
                f"I = {scenario.fault_current_pu:.1f} pu ({fault_current_a:.0f} A)"
            ),
        )
    )

    # 2. Protection detects
    t += detection_ms
    events.append(
        ProtectionEvent(
            event_type=EventType.PROTECTION_DETECTS,
            timestamp_ms=t,
            description=(
                f"{scenario.protection_function.value} detects fault current > pickup threshold"
            ),
            ied_name=scenario.publisher_ied,
        )
    )

    # 3. Relay processes
    t += _RELAY_PROCESSING_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.RELAY_PROCESSES,
            timestamp_ms=t,
            description="Digital relay processing: comparison, logic, trip decision",
            ied_name=scenario.publisher_ied,
        )
    )

    # 4. GOOSE trip published
    goose_publish_ms = t
    events.append(
        ProtectionEvent(
            event_type=EventType.GOOSE_PUBLISHED,
            timestamp_ms=t,
            description="GOOSE trip message published on Layer 2 Ethernet",
            ied_name=scenario.publisher_ied,
        )
    )

    # 5. GOOSE received by subscribers
    t += _GOOSE_TRANSPORT_MS
    goose_receive_ms = t
    for sub_ied in scenario.subscriber_ieds:
        events.append(
            ProtectionEvent(
                event_type=EventType.GOOSE_RECEIVED,
                timestamp_ms=t,
                description=f"GOOSE trip received by {sub_ied}",
                ied_name=sub_ied,
            )
        )

    # 6. Breaker trip initiated
    events.append(
        ProtectionEvent(
            event_type=EventType.BREAKER_TRIP_INITIATED,
            timestamp_ms=t,
            description="Circuit breaker trip coil energised",
            ied_name=scenario.subscriber_ieds[0] if scenario.subscriber_ieds else "",
        )
    )

    # 7. Breaker open (mechanical time)
    t += _BREAKER_MECHANICAL_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.BREAKER_OPEN,
            timestamp_ms=t,
            description="Circuit breaker contacts separated (spring mechanism)",
        )
    )

    # 8. Arc extinguished
    t += _ARC_EXTINCTION_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.ARC_EXTINGUISHED,
            timestamp_ms=t,
            description="Arc extinguished in SF6 chamber",
        )
    )

    # 9. Fault cleared
    events.append(
        ProtectionEvent(
            event_type=EventType.FAULT_CLEARED,
            timestamp_ms=t,
            description="Fault cleared — power system stable",
        )
    )

    total_clearance_ms = t

    # 10. SCADA alarm (much later — not used for protection)
    scada_ms = goose_publish_ms + _SCADA_POLLING_DELAY_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.SCADA_ALARM,
            timestamp_ms=scada_ms,
            description="SCADA alarm at control centre (IEC 60870-5-104 polling)",
        )
    )

    # Build GOOSE messages (initial + first retransmission)
    trip_signals = {f"Trip_CB_{sub}": True for sub in scenario.subscriber_ieds}
    trip_signals[f"{scenario.protection_function.value}_Op"] = True

    now = datetime.now(UTC)

    initial_msg = build_goose_trip_message(
        publisher_ied=scenario.publisher_ied,
        trip_signals=trip_signals,
        st_num=1,
        sq_num=0,
        timestamp=now,
    )

    first_retransmit = build_goose_trip_message(
        publisher_ied=scenario.publisher_ied,
        trip_signals=trip_signals,
        st_num=1,
        sq_num=1,
        timestamp=now,
    )

    # GOOSE latency = transport time only (publisher → subscriber)
    goose_latency_ms = goose_receive_ms - goose_publish_ms

    # Retransmission schedule from the GoCB settings
    gcb = build_oss_goose_control_block(ied_name=scenario.publisher_ied)
    retransmission = calculate_retransmission_schedule(
        min_time_ms=gcb.min_time_ms,
        max_time_ms=gcb.max_time_ms,
    )

    return FaultSimulationResult(
        scenario=scenario,
        events=tuple(events),
        goose_messages=(initial_msg, first_retransmit),
        goose_latency_ms=goose_latency_ms,
        total_clearance_ms=total_clearance_ms,
        goose_compliant=goose_latency_ms < GOOSE_MAX_LATENCY_MS,
        clearance_compliant=total_clearance_ms < FAULT_CLEARANCE_MAX_MS,
        retransmission_schedule_ms=retransmission,
    )
