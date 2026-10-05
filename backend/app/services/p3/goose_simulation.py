"""
GOOSE messaging and protection simulation for 510 MW Baltic Sea OWF.

Simulates IEC 61850-8-1 GOOSE (Generic Object-Oriented Substation Event)
messaging for protection fault scenarios in the offshore substation.

Physics — Why GOOSE Exists
---------------------------
A bolted fault on the OSS 220 kV busbar draws Ik'' ≈ 9.1 kA (IEC 60909
max case, pandapower — P2), ~7 × the 1.34 kA the busbar carries at 510 MW.
The arc energy grows with I²·t, so every millisecond of clearing time
matters, and the fault must be gone before the PSE fault-ride-through
profile (0 pu for 150 ms) is exceeded. Hard-wired trip contacts are replaced
by GOOSE: the protection IED publishes the trip once, every breaker bay
subscribes to it on the station bus.

Standard — IEC 61850-8-1 GOOSE Protocol
-----------------------------------------
GOOSE operates at Ethernet Layer 2 (no IP routing, no TCP overhead):
  - Multicast MAC addressing (01:0C:CD:01:xx:xx per IEC 61850-8-1 Annex A)
  - Publish-subscribe model: publisher IED sends, all subscribers receive
  - Typical latency: < 1 ms on a dedicated VLAN
  - Requirement: trip messages ≤ 3 ms transfer time (IEC 61850-5 class TT6)

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

Fault clearing time
-------------------
  t_clear = t_protection + t_GOOSE + t_trip-coil + t_opening + t_arcing

  protection operate time (numerical relay, incl. measurement):
      87B busbar differential ≈ 12 ms, 87T transformer differential ≈ 25 ms
      (2nd-harmonic restraint), 87L cable differential ≈ 30 ms (incl. channel)
  GOOSE transfer 1.5 ms, trip coil 1 ms
  220 kV breaker opening time 25 ms + arcing to the next current zero ≤ 10 ms
  (rated break time 2 cycles = 40 ms, IEC 62271-100)

  87B: 12 + 1.5 + 1 + 25 + 10 ≈ 50 ms — well inside the ≤ 100 ms main-
  protection target typical of TSO requirements at 220 kV.

References
----------
- IEC 61850-8-1: Specific communication service mapping (SCSM) —
  Mappings to MMS and to ISO/IEC 8802-3
- IEC 62271-100: High-voltage switchgear and controlgear — AC circuit-breakers
- IEC 61850-5: Communication requirements for functions and device models
- IEC 60909-0: Short-circuit currents in three-phase AC systems
- IEC 61850-7-2: Abstract communication service interface (ACSI)
- IEC 60870-5-104: Telecontrol equipment and systems — Network access
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from functools import lru_cache

from app.services.p3.iec61850_model import build_oss_goose_control_block

# ── Enums ──────────────────────────────────────────────────────────


class FaultType(StrEnum):
    """Protection fault scenarios of the export system (ids kept for the API).

    - busbar_overcurrent: 3-phase fault on the OSS 220 kV busbar → 87B
    - transformer_differential: internal fault in TX-OSS-01 → 87T
    - cable_earth_fault: phase-to-earth fault on export cable 1 → 87L
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
    PDIF = "PDIF"  # Differential — 87B busbar, 87T transformer, 87L line/cable


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

# Protection operate time by fault type [ms] (numerical relays, incl. measurement)
_DETECTION_TIMES_MS: dict[FaultType, float] = {
    FaultType.BUSBAR_OVERCURRENT: 12.0,  # 87B low-impedance busbar differential
    FaultType.TRANSFORMER_DIFFERENTIAL: 25.0,  # 87T with inrush (2nd harmonic) restraint
    FaultType.CABLE_EARTH_FAULT: 30.0,  # 87L incl. ~5 ms fibre channel delay
}

# Trip decision → GOOSE publication (output logic) [ms]
_RELAY_PROCESSING_MS = 0.5

# GOOSE Layer 2 transport time [ms] — publisher to subscriber
_GOOSE_TRANSPORT_MS = 1.5

# Trip coil energised after GOOSE receipt [ms]
_TRIP_COIL_MS = 1.0

# 220 kV circuit breaker opening time (trip coil → contact separation) [ms]
_BREAKER_MECHANICAL_MS = 25.0

# Arcing time until the next current zero (≤ half a cycle at 50 Hz) [ms]
_ARC_EXTINCTION_MS = 10.0

# SCADA alarm delay via IEC 60870-5-104 (spontaneous report + gateway) [ms]
# Operator notification only — never part of the protection path.
_SCADA_POLLING_DELAY_MS = 260.0

# Compliance thresholds
GOOSE_MAX_LATENCY_MS = 3.0  # IEC 61850-5 transfer time class TT6 (trip)
FAULT_CLEARANCE_MAX_MS = 100.0  # main-protection clearing target at 220 kV


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
    fault_current_ka : float
        Initial symmetrical short-circuit current Ik'' at the fault [kA]
        (IEC 60909 max case, pandapower).
    load_current_ka : float
        Load current through the faulted zone at 510 MW [kA].
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
    fault_current_ka: float
    load_current_ka: float
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
        True if GOOSE latency ≤ 3 ms (IEC 61850-5 TT6).
    clearance_compliant : bool
        True if total clearance ≤ 100 ms (main-protection target).
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


@lru_cache(maxsize=1)
def _ikss_ka() -> dict[str, float]:
    """IEC 60909 max-case Ik'' per bus [kA] from the P2 pandapower model (Rule 3)."""
    from app.services.p2.short_circuit import calc_short_circuit

    return {b.bus_name: b.ikss_ka for b in calc_short_circuit("max").bus_results}


# Load current through each zone at 510 MW, 220 kV [kA]
_I_LOAD_220_KA = 510.0 / (3**0.5 * 220.0)


def create_busbar_overcurrent_scenario() -> FaultScenario:
    """Three-phase fault on the OSS 220 kV busbar, cleared by 87B."""
    ik = _ikss_ka()["OSS_220kV"]
    return FaultScenario(
        fault_type=FaultType.BUSBAR_OVERCURRENT,
        location=FaultLocation.BUSBAR_220KV,
        fault_current_ka=ik,
        load_current_ka=_I_LOAD_220_KA,
        protection_function=ProtectionFunction.PDIF,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            f"3-phase fault on the OSS 220 kV busbar: Ik'' = {ik:.1f} kA (IEC 60909 max). "
            "87B busbar differential trips all four busbar bays via GOOSE."
        ),
    )


def create_transformer_differential_scenario() -> FaultScenario:
    """Internal fault in TX-OSS-01 near its HV terminals, cleared by 87T."""
    ik = _ikss_ka()["OSS_220kV"]
    return FaultScenario(
        fault_type=FaultType.TRANSFORMER_DIFFERENTIAL,
        location=FaultLocation.TRANSFORMER_OSS,
        fault_current_ka=ik,
        load_current_ka=300.0 / (3**0.5 * 220.0),
        protection_function=ProtectionFunction.PDIF,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            f"Internal fault in TX-OSS-01 near the HV terminals: up to {ik:.1f} kA from the "
            "220 kV side. 87T sees the HV/LV difference and trips both sides."
        ),
    )


def create_cable_earth_fault_scenario() -> FaultScenario:
    """Phase-to-earth fault on export cable 1, cleared at both ends by 87L."""
    ik = _ikss_ka()["OSS_220kV"]
    return FaultScenario(
        fault_type=FaultType.CABLE_EARTH_FAULT,
        location=FaultLocation.EXPORT_CABLE,
        fault_current_ka=ik,
        load_current_ka=_I_LOAD_220_KA / 2,
        protection_function=ProtectionFunction.PDIF,
        publisher_ied="OSS_PROT_IED01",
        subscriber_ieds=("OSS_BAY_CTRL01",),
        description=(
            f"Phase-to-earth fault on export cable 1 near the OSS: ≈ {ik:.1f} kA "
            "(solidly earthed, Z0 ≈ Z1 assumed). 87L opens both cable ends; no auto-reclose."
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

    # Build deterministic timeline
    t = 0.0
    events: list[ProtectionEvent] = []

    # 1. Fault occurs
    events.append(
        ProtectionEvent(
            event_type=EventType.FAULT_OCCURS,
            timestamp_ms=t,
            description=(
                f"Fault on {scenario.location.value}: Ik'' = {scenario.fault_current_ka:.1f} kA "
                f"({scenario.fault_current_ka / scenario.load_current_ka:.1f} × load current)"
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
                f"{scenario.protection_function.value} operates: differential current above "
                "the restrained pickup"
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

    # 6. Breaker trip coil energised
    t += _TRIP_COIL_MS
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
            description="Breaker contacts separate (opening time 25 ms)",
        )
    )

    # 8. Arc extinguished
    t += _ARC_EXTINCTION_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.ARC_EXTINGUISHED,
            timestamp_ms=t,
            description="Arc extinguished at current zero in the SF6 interrupter",
        )
    )

    # 9. Fault cleared
    events.append(
        ProtectionEvent(
            event_type=EventType.FAULT_CLEARED,
            timestamp_ms=t,
            description="Fault cleared — healthy part of the network keeps running",
        )
    )

    total_clearance_ms = t

    # 10. SCADA alarm (much later — not used for protection)
    scada_ms = goose_publish_ms + _SCADA_POLLING_DELAY_MS
    events.append(
        ProtectionEvent(
            event_type=EventType.SCADA_ALARM,
            timestamp_ms=scada_ms,
            description="Alarm at the control centre (IEC 60870-5-104 spontaneous report)",
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
