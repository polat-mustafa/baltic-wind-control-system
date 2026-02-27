"""
Emergency Response Procedures — structured response for offshore HV incidents.

Physics & Safety Context
========================
Offshore substations present unique hazards not found onshore:

1. **Arc flash (IEEE 1584)** — At 66 kV with ~8 kA fault current, incident
   energy can exceed 40 cal/cm². Response: immediate evacuation of the
   switchgear room, trip all HV CBs via SCADA, activate fire suppression.

2. **SF₆ gas leak (IEC 62271-4)** — SF₆ is 5× heavier than air and pools in
   cable basements. Decomposition products (SO₂, HF) are toxic at ppm levels.
   Response: ventilate, evacuate lower levels, monitor with gas detectors.

3. **Man overboard** — Offshore-specific, governed by SOLAS and flag-state
   rules. Response: MOB alarm, deploy rescue craft, notify MRCC.

4. **Unexpected voltage (IEC 61936-1)** — Induced voltages on isolated
   conductors via capacitive coupling or backfeed through VTs. Response:
   prove dead before touch, apply portable earths, trip upstream sources.

5. **Communications failure** — Loss of fibre or SCADA link to shore control.
   Response: switch to local control mode, activate satellite backup, follow
   pre-agreed autonomous operating procedures.

6. **Medical emergency** — Offshore first aid and medevac coordination.
   Response: first aid, notify OIM, arrange helicopter evacuation via MRCC.

Each procedure follows a standardised structure:
  - Severity classification (Critical / High / Medium)
  - Ordered immediate-action checklist
  - Responsible person (PiC, Safety Officer, OIM)
  - Automated SCADA actions triggered on the switching programme
  - Communication protocol (who to notify, by what means)

Standards: IEC 61936-1, IEEE 1584, IEC 62271-4, SOLAS, IRiESP §7.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

# ── Enums ───────────────────────────────────────────────────────


class EmergencyType(StrEnum):
    """Categories of offshore substation emergencies."""

    ARC_FLASH = "arc_flash"
    SF6_LEAK = "sf6_leak"
    MEDICAL = "medical"
    MAN_OVERBOARD = "man_overboard"
    COMMS_FAILURE = "comms_failure"
    UNEXPECTED_VOLTAGE = "unexpected_voltage"


class SeverityLevel(StrEnum):
    """ISA-18.2 alarm severity mapping for emergency classification."""

    CRITICAL = "critical"  # Immediate life/equipment danger
    HIGH = "high"  # Potential escalation risk
    MEDIUM = "medium"  # Operational impact, no immediate danger


# ── Data Models ─────────────────────────────────────────────────


@dataclass
class EmergencyProcedure:
    """Pre-defined response procedure for a specific emergency type."""

    emergency_type: EmergencyType
    severity: SeverityLevel
    immediate_actions: list[str]
    responsible: str
    reference_document: str
    automated_scada_actions: list[str]
    communication_protocol: list[str]


@dataclass
class EmergencyEvent:
    """Record of an emergency that was triggered during a programme."""

    event_id: str
    programme_id: str
    emergency_type: EmergencyType
    severity: SeverityLevel
    triggered_by: str
    triggered_at: str
    actions_taken: list[str]
    scada_actions_executed: list[str]
    resolved: bool = False
    resolved_at: str | None = None


# ── Procedure Library (Roadmap Table 6.9) ───────────────────────


EMERGENCY_PROCEDURES: dict[EmergencyType, EmergencyProcedure] = {
    EmergencyType.ARC_FLASH: EmergencyProcedure(
        emergency_type=EmergencyType.ARC_FLASH,
        severity=SeverityLevel.CRITICAL,
        immediate_actions=[
            "Evacuate switchgear room immediately",
            "Account for all personnel at muster point",
            "Do NOT re-enter until PiC authorises",
            "Administer first aid to any casualties",
            "Preserve the scene for investigation",
        ],
        responsible="PiC / Safety Officer",
        reference_document="IEEE 1584 Arc Flash Hazard Assessment",
        automated_scada_actions=[
            "Trip all 66 kV feeder CBs",
            "Trip 220/66 kV transformer CB",
            "Activate fire suppression system",
            "Sound general alarm",
        ],
        communication_protocol=[
            "PiC → Shore Control Room (satellite phone if SCADA down)",
            "Shore Control → PSE Dispatch (grid notification)",
            "Safety Officer → MRCC if medevac required",
            "OIM → Vessel master for standby",
        ],
    ),
    EmergencyType.SF6_LEAK: EmergencyProcedure(
        emergency_type=EmergencyType.SF6_LEAK,
        severity=SeverityLevel.HIGH,
        immediate_actions=[
            "Activate forced ventilation in GIS room",
            "Evacuate lower levels (SF₆ pools in basements)",
            "Don SCBA if entering affected area",
            "Monitor SF₆ concentration with portable detector",
            "Isolate affected GIS bay if safe to do so",
        ],
        responsible="PiC / Safety Officer",
        reference_document="IEC 62271-4 SF₆ Gas Handling",
        automated_scada_actions=[
            "Activate GIS room ventilation fans",
            "Trigger SF₆ density alarm on affected bay",
            "Block auto-reclose on affected circuit",
        ],
        communication_protocol=[
            "PiC → Shore Control Room",
            "Safety Officer → Environmental Officer",
            "PiC → GIS manufacturer support line",
        ],
    ),
    EmergencyType.MEDICAL: EmergencyProcedure(
        emergency_type=EmergencyType.MEDICAL,
        severity=SeverityLevel.HIGH,
        immediate_actions=[
            "Provide immediate first aid (trained first-aider)",
            "Stabilise casualty — do not move if spinal injury suspected",
            "Prepare helideck for medevac if required",
            "Complete accident report form",
        ],
        responsible="OIM / First Aider",
        reference_document="Offshore First Aid & Medevac Procedure",
        automated_scada_actions=[
            "No automatic SCADA actions — manual response only",
        ],
        communication_protocol=[
            "First Aider → OIM (immediate verbal report)",
            "OIM → Shore Control → MRCC for helicopter",
            "OIM → Onshore medical advisor (telemedicine)",
            "Safety Officer → HSE incident log",
        ],
    ),
    EmergencyType.MAN_OVERBOARD: EmergencyProcedure(
        emergency_type=EmergencyType.MAN_OVERBOARD,
        severity=SeverityLevel.CRITICAL,
        immediate_actions=[
            "Raise MOB alarm — 3 long blasts",
            "Deploy lifebuoy with smoke/light",
            "Maintain visual contact with casualty",
            "Launch fast rescue craft (FRC)",
            "Stop all crane and vessel operations",
        ],
        responsible="OIM",
        reference_document="SOLAS Chapter III — Life-Saving Appliances",
        automated_scada_actions=[
            "Sound MOB alarm on PA system",
            "Activate platform perimeter lighting",
        ],
        communication_protocol=[
            "OIM → All personnel via PA (MOB alert)",
            "OIM → MRCC on Ch. 16 VHF",
            "OIM → Standby vessel for immediate response",
            "Shore Control → Coast Guard coordination",
        ],
    ),
    EmergencyType.COMMS_FAILURE: EmergencyProcedure(
        emergency_type=EmergencyType.COMMS_FAILURE,
        severity=SeverityLevel.MEDIUM,
        immediate_actions=[
            "Switch to satellite phone backup",
            "Verify fibre optic link status at ODF",
            "Activate local SCADA control mode",
            "Follow autonomous operating procedure (AOP)",
            "Log all switching actions manually",
        ],
        responsible="PiC",
        reference_document="Autonomous Operating Procedure (AOP) — IRiESP §7",
        automated_scada_actions=[
            "Switch SCADA to local control mode",
            "Enable autonomous frequency response",
            "Disable remote switching commands",
        ],
        communication_protocol=[
            "PiC → Shore Control via satellite phone",
            "PiC → PSE Dispatch (backup radio channel)",
            "Comms Engineer → Fibre repair contractor",
        ],
    ),
    EmergencyType.UNEXPECTED_VOLTAGE: EmergencyProcedure(
        emergency_type=EmergencyType.UNEXPECTED_VOLTAGE,
        severity=SeverityLevel.CRITICAL,
        immediate_actions=[
            "STOP all work — assume all conductors live",
            "Withdraw all personnel from HV area",
            "Prove dead at point of work with approved voltage detector",
            "Apply portable earths if safe to do so",
            "Identify source of backfeed (VT, capacitive coupling, parallel path)",
        ],
        responsible="PiC / SAP",
        reference_document="IEC 61936-1 Clause 7 — Safety during work",
        automated_scada_actions=[
            "Trip upstream source CBs",
            "Open all disconnectors in the affected section",
            "Block all auto-reclose functions",
        ],
        communication_protocol=[
            "PiC → All personnel via radio (STOP work)",
            "PiC → Shore Control (unexpected energisation report)",
            "Shore Control → PSE Dispatch (backfeed investigation)",
            "Safety Officer → HSE near-miss report",
        ],
    ),
}


# ── In-Memory Event Log ─────────────────────────────────────────

_emergency_logs: dict[str, list[EmergencyEvent]] = {}


# ── Public API ──────────────────────────────────────────────────


def get_all_procedures() -> list[EmergencyProcedure]:
    """Return all 6 pre-defined emergency procedures."""
    return list(EMERGENCY_PROCEDURES.values())


def get_procedure(emergency_type: EmergencyType) -> EmergencyProcedure:
    """Return the procedure for a specific emergency type."""
    procedure = EMERGENCY_PROCEDURES.get(emergency_type)
    if procedure is None:
        raise ValueError(f"Unknown emergency type: {emergency_type}")
    return procedure


def trigger_emergency(
    emergency_type: EmergencyType,
    triggered_by: str,
    programme_id: str,
) -> EmergencyEvent:
    """
    Trigger an emergency event on a programme.

    Records the event, logs automated SCADA actions that would be
    executed, and returns the event with a full timeline.

    In a production system, this would send real SCADA commands to the
    RTU/PLC layer. In our simulation, we record what *would* happen.
    """
    procedure = get_procedure(emergency_type)
    now = datetime.now(UTC).isoformat()

    event = EmergencyEvent(
        event_id=f"EMR-{uuid.uuid4().hex[:8].upper()}",
        programme_id=programme_id,
        emergency_type=emergency_type,
        severity=procedure.severity,
        triggered_by=triggered_by,
        triggered_at=now,
        actions_taken=list(procedure.immediate_actions),
        scada_actions_executed=list(procedure.automated_scada_actions),
    )

    if programme_id not in _emergency_logs:
        _emergency_logs[programme_id] = []
    _emergency_logs[programme_id].append(event)

    return event


def get_emergency_log(programme_id: str) -> list[EmergencyEvent]:
    """Return the emergency event history for a programme."""
    return _emergency_logs.get(programme_id, [])


def clear_logs() -> None:
    """Reset all emergency logs (for testing)."""
    _emergency_logs.clear()
