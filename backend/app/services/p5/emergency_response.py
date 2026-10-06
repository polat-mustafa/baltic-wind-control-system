"""
Emergency procedures during the energisation programme.

Each procedure has an effect on the programme, not just a checklist:

- TRIP — emergency trip: every closed breaker of circuit 1 and every released
  turbine group opens and the programme is aborted (``emergency_trip``).
  Used when the hazard is electrical (internal arc, voltage where none should be).
- SUSPEND — all switching stops until the Person in Control resumes. Used when
  the plant is safe as it is but the people or the communication are not.

Hazard notes
------------
- Internal arc in GIS/switchgear: cleared by the busbar/line differential
  protection in tens of milliseconds; the hazard to people is the pressure
  relief and the hot, toxic gases — internal-arc classification of the
  switchgear (IEC 62271-203 / -200) limits it to the accessible sides. Arc-flash
  incident-energy methods such as IEEE 1584 apply to 208 V–15 kV only and are
  not used for 66/220 kV.
- SF6 loss: SF6 is about five times denser than air (146 vs 29 g/mol) and
  collects in low rooms and cable basements, displacing oxygen. Gas exposed to
  arcing contains toxic by-products (SO2, HF, SOF2) — handling per IEC 62271-4.
  A breaker below its lockout density must not operate.

References: EN 50110-1:2013; IEC 62271-4:2022; IEC 62271-203:2022; SOLAS Ch. III.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum

from app.core.exceptions import NotFoundError
from app.services.p5.switching_programme import (
    SwitchingProgramme,
    emergency_trip,
    suspend_programme,
)


class EmergencyType(StrEnum):
    INTERNAL_ARC = "internal_arc"
    UNEXPECTED_VOLTAGE = "unexpected_voltage"
    SF6_LOW_DENSITY = "sf6_low_density"
    COMMS_FAILURE = "comms_failure"
    MEDICAL = "medical"
    MAN_OVERBOARD = "man_overboard"


class SeverityLevel(StrEnum):
    CRITICAL = "critical"  # danger to life — immediate plant action
    HIGH = "high"  # escalation possible
    MEDIUM = "medium"  # operational impact only


class ProgrammeEffect(StrEnum):
    TRIP = "trip"
    SUSPEND = "suspend"


@dataclass(frozen=True)
class EmergencyProcedure:
    emergency_type: EmergencyType
    title: str
    severity: SeverityLevel
    effect: ProgrammeEffect
    immediate_actions: tuple[str, ...]
    responsible: str
    reference_document: str
    communication_protocol: tuple[str, ...]


_P = EmergencyProcedure
EMERGENCY_PROCEDURES: dict[EmergencyType, EmergencyProcedure] = {
    p.emergency_type: p
    for p in (
        _P(
            EmergencyType.INTERNAL_ARC, "Internal arc in GIS / switchgear room",
            SeverityLevel.CRITICAL, ProgrammeEffect.TRIP,
            (
                "Confirm the fault is cleared (87B / 87L trip, breaker positions)",
                "Evacuate the switchgear room and adjoining areas; muster and account for all",
                "Do not re-enter until the room is ventilated and gas-tested and the PiC allows it",
                "First aid for burns and inhalation; prepare medevac",
                "Preserve the scene and the disturbance records",
            ),
            "PiC / OIM", "IEC 62271-203 (internal arc classification); site emergency plan",
            ("PiC → shore control room", "Shore control → PSE dispatch (circuit 1 tripped)",
             "OIM → MRCC Gdynia if medevac is required"),
        ),
        _P(
            EmergencyType.UNEXPECTED_VOLTAGE, "Voltage detected on isolated equipment",
            SeverityLevel.CRITICAL, ProgrammeEffect.TRIP,
            (
                "Stop all work; treat every conductor in the area as live",
                "Withdraw all persons from the work area",
                "Open the source breakers; find the source (backfeed, induction, wrong isolation)",
                "Re-verify absence of voltage with an approved detector before any earthing",
                "Report as a dangerous occurrence",
            ),
            "PiC", "EN 50110-1 §6.2 (verify absence of voltage)",
            ("PiC → all parties by radio: STOP", "PiC → shore control → PSE dispatch"),
        ),
        _P(
            EmergencyType.SF6_LOW_DENSITY, "SF6 low-density alarm / gas leak",
            SeverityLevel.HIGH, ProgrammeEffect.SUSPEND,
            (
                "Suspend switching; a breaker below lockout density must not operate",
                "Start forced ventilation of the GIS room",
                "Keep out of low-lying rooms and cable basements until O2 and SF6 are measured",
                "Respiratory protection if the gas may contain arc by-products",
                "Isolate the compartment once switching is safe; recover gas per IEC 62271-4",
            ),
            "PiC / HSE officer", "IEC 62271-4 (SF6 handling)",
            ("PiC → shore control room", "HSE officer → environmental reporting (F-gas)",
             "PiC → GIS manufacturer"),
        ),
        _P(
            EmergencyType.COMMS_FAILURE, "Loss of communication PiC ↔ operators / control centre",
            SeverityLevel.MEDIUM, ProgrammeEffect.SUSPEND,
            (
                "Suspend switching — no operation without confirmed communication",
                "Leave the plant in its present, stable state",
                "Restore the voice link (VHF / satellite) before any further step",
                "Re-confirm plant status with every party before resuming",
            ),
            "PiC", "EN 50110-1 (agreed communication arrangements)",
            ("PiC → shore control via backup channel", "Shore control → PSE dispatch"),
        ),
        _P(
            EmergencyType.MEDICAL, "Medical emergency", SeverityLevel.HIGH, ProgrammeEffect.SUSPEND,
            (
                "Suspend switching; first aid by the nearest trained first-aider",
                "Do not move the casualty if a spinal injury is suspected",
                "Prepare the helideck / vessel transfer for medevac",
            ),
            "OIM", "Site emergency response plan",
            ("First-aider → OIM", "OIM → MRCC Gdynia for helicopter / vessel",
             "OIM → onshore medical advisor"),
        ),
        _P(
            EmergencyType.MAN_OVERBOARD, "Person overboard", SeverityLevel.CRITICAL,
            ProgrammeEffect.SUSPEND,
            (
                "Raise the alarm; throw a lifebuoy with light and smoke signal",
                "Keep the person in sight and point continuously",
                "Launch the rescue boat; stop crane and vessel operations",
                "Suspend switching — all hands to the emergency",
            ),
            "OIM", "SOLAS Ch. III; site emergency response plan",
            ("OIM → all persons on board (PA)", "OIM → MRCC Gdynia on VHF channel 16",
             "OIM → standby vessel"),
        ),
    )
}  # fmt: skip


class UnknownEmergencyError(NotFoundError):
    """Unknown emergency type."""


def get_procedure(emergency_type: str) -> EmergencyProcedure:
    try:
        return EMERGENCY_PROCEDURES[EmergencyType(emergency_type)]
    except ValueError:
        raise UnknownEmergencyError(f"Unknown emergency type '{emergency_type}'.") from None


def trigger_emergency(
    programme: SwitchingProgramme, emergency_type: str, triggered_by: str
) -> dict[str, object]:
    """Apply the procedure's effect to the programme and log the event."""
    proc = get_procedure(emergency_type)
    opened: list[str] = []
    if proc.effect == ProgrammeEffect.TRIP:
        opened = emergency_trip(programme, triggered_by, proc.title)
    else:
        suspend_programme(programme, triggered_by, proc.title)
    event: dict[str, object] = {
        "event_id": f"EMR-{uuid.uuid4().hex[:8].upper()}",
        "emergency_type": proc.emergency_type.value,
        "severity": proc.severity.value,
        "effect": proc.effect.value,
        "triggered_by": triggered_by,
        "triggered_at": datetime.now(UTC).isoformat(),
        "breakers_opened": opened,
        "programme_status": programme.status.value,
    }
    programme.emergency_log.append(event)
    return event
