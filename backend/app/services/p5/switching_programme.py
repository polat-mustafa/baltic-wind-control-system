"""
Switching programme execution engine for OSS first energisation.

Implements the 30-step switching programme with Person in Control (PiC)
decision logic, hold points, and full audit trail.

Physics — What Happens During First Energisation
--------------------------------------------------
When a 45 km 220 kV submarine cable is energised for the first time, two
critical phenomena occur:

1. **Cable charging current** — A 45 km XLPE submarine cable has a
   capacitance of ~0.25 µF/km (IEC 60287). The charging current is:

     I_c = ω × C × V = 2π × 50 × (0.25e-6 × 45) × (220e3/√3)
         ≈ 89 A per phase

   This reactive current flows continuously and must be compensated by
   the STATCOM (P2) to maintain voltage within ±5%.

2. **Ferranti effect** — The receiving end voltage of an unloaded cable
   rises above the sending end:

     V_receiving / V_sending = 1 / cos(β × l)

   where β = ω√(LC) ≈ 1.05e-3 rad/km. For 45 km:
     V_ratio = 1 / cos(0.0473) ≈ 1.001 (0.1% rise)

   Manageable for 45 km, but critical for longer cables (>100 km).

3. **Transformer inrush** — Energising TX-OSS-01 draws magnetising
   inrush current up to 8× rated current for ~100 ms. The 2nd harmonic
   content (I₂/I₁ > 0.15) is used by the protection relay to distinguish
   inrush from a fault — this is why S-019 verifies "magnetising current
   normal" before proceeding.

Standard — IEC 62271-100 Switching Sequences
----------------------------------------------
IEC 62271-100 §4.101 defines the standard operating sequence for CBs:

    O — 0.3s — CO — 3min — CO

    O  = opening operation
    CO = closing followed by opening (auto-reclose)

The 0.3s delay is the minimum time between operations for SF6 gas
recovery. Our switching programme enforces this through the PiC
confirmation step (no automated rapid re-closure during commissioning).

Maths — Programme Lifecycle FSM
---------------------------------
The programme itself has a lifecycle state machine:

    CREATED → APPROVED → IN_PROGRESS → COMPLETED
                             ↓
                           HOLD ← → IN_PROGRESS
                             ↓
                          ABORTED

    Status transitions:
      CREATED → APPROVED       (PiC reviews and signs off)
      APPROVED → IN_PROGRESS   (PiC declares programme start)
      IN_PROGRESS → HOLD       (hold point reached or issue detected)
      HOLD → IN_PROGRESS       (PiC GO decision)
      HOLD → ABORTED           (PiC NO-GO decision or emergency)
      IN_PROGRESS → COMPLETED  (all 30 steps executed successfully)
      IN_PROGRESS → ABORTED    (emergency stop)

Each step within the programme has its own status:
    PENDING → IN_PROGRESS → COMPLETED | FAILED | SKIPPED

References
----------
- IEC 62271-100:2021 — CB operating sequences
- IEC 60287:2023 — Cable current rating (capacitance calculations)
- IEC 60076-5:2006 — Transformer inrush current
- IEEE C57.12.90 — Transformer test code (inrush measurement)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from app.services.p5.equipment_state import (
    EquipmentNotFoundError,
    EquipmentState,
    InterlockError,
    InvalidTransitionError,
    SwitchingAction,
    build_initial_state,
    execute_switching_action,
)
from app.services.p5.loto import (
    LOTOSet,
    create_loto_set_for_oss,
)

# ── Enums ──────────────────────────────────────────────────────────


class ProgrammeStatus(StrEnum):
    """Switching programme lifecycle states."""

    CREATED = "created"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    HOLD = "hold"
    COMPLETED = "completed"
    ABORTED = "aborted"


class StepStatus(StrEnum):
    """Individual step execution states."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class StepType(StrEnum):
    """Categories of switching programme steps."""

    CHECK = "check"
    SWITCHING = "switching"
    VERIFICATION = "verification"
    HOLD_POINT = "hold_point"
    DECLARATION = "declaration"


# ── Data Models ────────────────────────────────────────────────────


@dataclass
class SwitchingStep:
    """A single step in the switching programme.

    Attributes
    ----------
    step_id : str
        Unique identifier (e.g. 'S-001', 'CHECK-001').
    step_number : int
        Sequential position (1-based).
    phase : int
        Programme phase (1=Pre-energisation, 2=Energisation, 3=Turbine connection).
    step_type : StepType
        Category of this step.
    action : str
        Human-readable description of the action.
    equipment_id : str
        Equipment identifier (empty for non-switching steps).
    switching_action : SwitchingAction | None
        Equipment action to execute (None for checks/declarations).
    expected_state_before : EquipmentState | None
        Expected equipment state before action.
    expected_state_after : EquipmentState | None
        Expected equipment state after action.
    responsible : str
        Who performs the action (PiC, Local, SCADA).
    pic_confirmation : bool
        Whether PiC verbal confirmation is required.
    verification : str
        How to confirm the action was successful.
    notes : str
        Safety notes and special conditions.
    status : StepStatus
        Current execution status.
    executed_at : datetime | None
        UTC timestamp when step was executed.
    executed_by : str
        Who executed the step.
    """

    step_id: str
    step_number: int
    phase: int
    step_type: StepType
    action: str
    equipment_id: str = ""
    switching_action: SwitchingAction | None = None
    expected_state_before: EquipmentState | None = None
    expected_state_after: EquipmentState | None = None
    responsible: str = "PiC"
    pic_confirmation: bool = True
    verification: str = ""
    notes: str = ""
    status: StepStatus = StepStatus.PENDING
    executed_at: datetime | None = None
    executed_by: str = ""


@dataclass(frozen=True)
class AuditRecord:
    """Timestamped record of an action in the programme.

    Attributes
    ----------
    record_id : str
        Unique identifier.
    timestamp : datetime
        UTC time of the action.
    action : str
        Description of what happened.
    performed_by : str
        Who did it.
    step_id : str
        Associated step (empty for programme-level actions).
    details : str
        Additional context.
    """

    record_id: str
    timestamp: datetime
    action: str
    performed_by: str
    step_id: str = ""
    details: str = ""


@dataclass
class SwitchingProgramme:
    """Complete switching programme with system state.

    Each programme owns its own equipment state map and LOTO set,
    ensuring no shared mutable state between programmes.

    Attributes
    ----------
    programme_id : str
        Unique identifier.
    title : str
        Programme title.
    pic_name : str
        Person in Control name.
    status : ProgrammeStatus
        Current lifecycle state.
    steps : list[SwitchingStep]
        All programme steps in execution order.
    current_step_index : int
        Index of the next step to execute (0-based).
    system_state : dict[str, EquipmentState]
        Current state of all equipment.
    loto_set : LOTOSet
        LOTO isolation points for this programme.
    audit_trail : list[AuditRecord]
        Append-only action log.
    created_at : datetime
        UTC timestamp of programme creation.
    """

    programme_id: str
    title: str
    pic_name: str
    status: ProgrammeStatus = ProgrammeStatus.CREATED
    steps: list[SwitchingStep] = field(default_factory=list)
    current_step_index: int = 0
    system_state: dict[str, EquipmentState] = field(default_factory=dict)
    loto_set: LOTOSet | None = None
    audit_trail: list[AuditRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


# ── Exceptions ───────────────────────────────────────────────────


class ProgrammeError(Exception):
    """Base exception for switching programme operations."""


class ProgrammeStateError(ProgrammeError):
    """Programme is in wrong state for the requested operation."""


class StepExecutionError(ProgrammeError):
    """Step execution failed."""


class PiCDecisionRequiredError(ProgrammeError):
    """A hold point requires PiC GO/NO-GO decision."""


# ── Terminal States ──────────────────────────────────────────────

_TERMINAL_STATUSES: frozenset[ProgrammeStatus] = frozenset(
    {ProgrammeStatus.COMPLETED, ProgrammeStatus.ABORTED}
)


# ── Private Helpers ──────────────────────────────────────────────


def _add_audit(
    programme: SwitchingProgramme,
    action: str,
    performed_by: str,
    step_id: str = "",
    details: str = "",
) -> AuditRecord:
    """Append an audit record to the programme."""
    record = AuditRecord(
        record_id=str(uuid.uuid4()),
        timestamp=datetime.now(UTC),
        action=action,
        performed_by=performed_by,
        step_id=step_id,
        details=details,
    )
    programme.audit_trail.append(record)
    return record


# ── 30-Step Programme Factory ────────────────────────────────────


def create_oss_energisation_programme(pic_name: str) -> SwitchingProgramme:
    """Create the complete 30-step OSS first energisation programme.

    Builds all steps across 3 phases:
      Phase 1 (CHECK-001 to CHECK-015): Pre-energisation checks
      Phase 2 (S-001 to S-022): Energisation switching
      Phase 3 (S-023 to S-030): Turbine connection

    Parameters
    ----------
    pic_name : str
        Name of the Person in Control.

    Returns
    -------
    SwitchingProgramme
        Complete programme with initial equipment state and LOTO set.
    """
    programme_id = f"BWA-SP-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    programme = SwitchingProgramme(
        programme_id=programme_id,
        title="OSS First Energisation — Baltic Wind Alpha 510 MW",
        pic_name=pic_name,
        system_state=build_initial_state(),
        loto_set=create_loto_set_for_oss(programme_id),
    )

    steps: list[SwitchingStep] = []
    step_num = 0

    # ── Phase 1: Pre-Energisation Checks (15 steps) ──────────────
    phase1_checks = [
        (
            "Physical inspection — all installation bolts torqued, covers closed",
            "Visual inspection log",
        ),
        ("Megger test — insulation resistance > 100 MΩ (all HV components)", "Megger test report"),
        ("Continuity test — all earthing connections verified", "Continuity test report"),
        ("SF6 gas pressure — all GIS compartments within limits", "SF6 pressure gauges"),
        ("Transformer oil — DGA (dissolved gas analysis) within normal", "DGA report"),
        (
            "Protection relay settings — all confirmed per setting schedule",
            "Setting schedule sign-off",
        ),
        ("SCADA communication — all IEDs responding via IEC 61850 MMS", "SCADA status screen"),
        ("GOOSE subscriptions — publisher-subscriber mapping verified", "GOOSE monitor tool"),
        ("All earthing switches — CLOSED (system is earthed)", "SCADA + local indicators"),
        ("All circuit breakers — OPEN and racked out", "SCADA + local indicators"),
        ("All LOTO — applied to maintenance isolation points", "LOTO register"),
        ("Emergency stop — tested and functional", "E-stop test log"),
        ("Fire detection/suppression — tested and armed", "Fire system status"),
        ("Communications — VHF radio, satellite phone, PA system verified", "Comms check log"),
        ("Personnel — all non-essential persons evacuated from HV areas", "Muster list"),
    ]

    for i, (action, verification) in enumerate(phase1_checks, start=1):
        step_num += 1
        steps.append(
            SwitchingStep(
                step_id=f"CHECK-{i:03d}",
                step_number=step_num,
                phase=1,
                step_type=StepType.CHECK,
                action=action,
                responsible="Local" if i <= 14 else "PiC",
                pic_confirmation=True,
                verification=verification,
            )
        )

    # ── Phase 2: Energisation Switching (S-001 to S-022) ──────────
    phase2_steps: list[dict[str, Any]] = [
        # S-001: PiC declaration
        {
            "step_id": "S-001",
            "type": StepType.DECLARATION,
            "action": "PiC declares: 'Begin energisation programme'",
            "responsible": "PiC",
            "pic_confirm": False,
            "verification": "Verbal declaration logged",
            "notes": "Programme officially starts",
        },
        # S-002: PSE dispatch authorisation
        {
            "step_id": "S-002",
            "type": StepType.CHECK,
            "action": "Confirm PSE dispatch authorisation received",
            "responsible": "PiC",
            "pic_confirm": True,
            "verification": "Dispatch authorisation document",
            "notes": "Cannot proceed without grid operator clearance",
        },
        # S-003: Open ES-ON-220-01
        {
            "step_id": "S-003",
            "type": StepType.SWITCHING,
            "action": "Open Earth Switch ES-ON-220-01",
            "equipment_id": "ES-ON-220-01",
            "switching_action": SwitchingAction.OPEN,
            "before": EquipmentState.CLOSED,
            "after": EquipmentState.OPEN,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-004: Verify ES-ON-220-01
        {
            "step_id": "S-004",
            "type": StepType.VERIFICATION,
            "action": "Verify: Earth Switch ES-ON-220-01 = OPEN",
            "equipment_id": "ES-ON-220-01",
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-005: Open ES-OSS-220-01
        {
            "step_id": "S-005",
            "type": StepType.SWITCHING,
            "action": "Open Earth Switch ES-OSS-220-01",
            "equipment_id": "ES-OSS-220-01",
            "switching_action": SwitchingAction.OPEN,
            "before": EquipmentState.CLOSED,
            "after": EquipmentState.OPEN,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-006: Verify ES-OSS-220-01
        {
            "step_id": "S-006",
            "type": StepType.VERIFICATION,
            "action": "Verify: Earth Switch ES-OSS-220-01 = OPEN",
            "equipment_id": "ES-OSS-220-01",
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-007: Close DS-ON-220-01
        {
            "step_id": "S-007",
            "type": StepType.SWITCHING,
            "action": "Close Disconnector DS-ON-220-01",
            "equipment_id": "DS-ON-220-01",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-008: Verify DS-ON-220-01
        {
            "step_id": "S-008",
            "type": StepType.VERIFICATION,
            "action": "Verify: Disconnector DS-ON-220-01 = CLOSED",
            "equipment_id": "DS-ON-220-01",
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-009: HOLD POINT
        {
            "step_id": "S-009",
            "type": StepType.HOLD_POINT,
            "action": "HOLD POINT: PiC confirms all checks complete",
            "responsible": "PiC",
            "pic_confirm": True,
            "verification": "PiC verbal confirmation",
            "notes": "PiC reviews all pre-energisation checks before closing CB",
        },
        # S-010: Close CB-ON-220-01 (export cable energised)
        {
            "step_id": "S-010",
            "type": StepType.SWITCHING,
            "action": "Close CB-ON-220-01 (onshore substation) — export cable energised at 220 kV",
            "equipment_id": "CB-ON-220-01",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA indication + voltage reading",
            "notes": "Export cable now energised at 220 kV. Monitor cable charging current.",
        },
        # S-011: Verify voltage
        {
            "step_id": "S-011",
            "type": StepType.VERIFICATION,
            "action": "Verify: V = 220 kV ±5% at onshore bus",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA voltage reading 209-231 kV",
        },
        # S-012: Monitor cable charging
        {
            "step_id": "S-012",
            "type": StepType.VERIFICATION,
            "action": "Monitor: Cable charging current stable (5 min)",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA current reading stable ~89 A/phase",
            "notes": "45 km XLPE cable capacitance ~0.25 µF/km → 89 A charging current",
        },
        # S-013: Close DS-OSS-220-01
        {
            "step_id": "S-013",
            "type": StepType.SWITCHING,
            "action": "Close DS-OSS-220-01 (OSS disconnector)",
            "equipment_id": "DS-OSS-220-01",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
        },
        # S-014: Close CB-OSS-220-01 (OSS 220 kV busbar energised)
        {
            "step_id": "S-014",
            "type": StepType.SWITCHING,
            "action": "Close CB-OSS-220-01 (OSS 220 kV CB) — OSS 220 kV busbar energised",
            "equipment_id": "CB-OSS-220-01",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA indication + voltage reading",
        },
        # S-015: Verify OSS 220 kV voltage
        {
            "step_id": "S-015",
            "type": StepType.VERIFICATION,
            "action": "Verify: V = 220 kV ±5% at OSS 220 kV bus",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA voltage reading 209-231 kV",
        },
        # S-016: Activate STATCOM
        {
            "step_id": "S-016",
            "type": StepType.SWITCHING,
            "action": "Activate STATCOM voltage control mode",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "STATCOM status = ACTIVE",
            "notes": "STATCOM compensates cable charging reactive power",
        },
        # S-017: Verify STATCOM
        {
            "step_id": "S-017",
            "type": StepType.VERIFICATION,
            "action": "Verify: STATCOM absorbing ~85 MVAR",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA reactive power reading ~85 MVAR inductive",
        },
        # S-018: Close TX-OSS HV CB
        {
            "step_id": "S-018",
            "type": StepType.SWITCHING,
            "action": "Close TX-OSS HV CB (220 kV side)",
            "equipment_id": "CB-TX-OSS-HV",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA indication + magnetising current",
            "notes": (
                "Expect inrush current up to 8x rated for ~100 ms. 2nd harmonic restraint active."
            ),
        },
        # S-019: Verify TX magnetising current
        {
            "step_id": "S-019",
            "type": StepType.VERIFICATION,
            "action": "Verify: TX magnetising current normal",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA current reading < 5 A steady-state",
        },
        # S-019A: Open ES-OSS-66-01 (remove 66 kV earth before energising)
        {
            "step_id": "S-019A",
            "type": StepType.SWITCHING,
            "action": "Open Earth Switch ES-OSS-66-01 (remove 66 kV busbar earth)",
            "equipment_id": "ES-OSS-66-01",
            "switching_action": SwitchingAction.OPEN,
            "before": EquipmentState.CLOSED,
            "after": EquipmentState.OPEN,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
            "notes": "Must remove 66 kV earth before closing LV CB",
        },
        # S-020: Close TX-OSS LV CB (66 kV busbar energised)
        {
            "step_id": "S-020",
            "type": StepType.SWITCHING,
            "action": "Close TX-OSS LV CB (66 kV side) — OSS 66 kV busbar energised",
            "equipment_id": "CB-TX-OSS-LV",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA indication + voltage reading",
        },
        # S-021: Verify 66 kV voltage
        {
            "step_id": "S-021",
            "type": StepType.VERIFICATION,
            "action": "Verify: V = 66 kV ±5% at OSS 66 kV bus",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA voltage reading 62.7-69.3 kV",
        },
        # S-022: HOLD POINT
        {
            "step_id": "S-022",
            "type": StepType.HOLD_POINT,
            "action": "HOLD POINT: PiC confirms all voltages normal — OSS fully energised",
            "responsible": "PiC",
            "pic_confirm": True,
            "verification": "PiC verbal confirmation",
            "notes": "OSS fully energised, ready for turbine connection",
        },
    ]

    for step_def in phase2_steps:
        step_num += 1
        steps.append(
            SwitchingStep(
                step_id=step_def["step_id"],
                step_number=step_num,
                phase=2,
                step_type=step_def["type"],
                action=step_def["action"],
                equipment_id=step_def.get("equipment_id", ""),
                switching_action=step_def.get("switching_action"),
                expected_state_before=step_def.get("before"),
                expected_state_after=step_def.get("after"),
                responsible=step_def["responsible"],
                pic_confirmation=step_def["pic_confirm"],
                verification=step_def.get("verification", ""),
                notes=step_def.get("notes", ""),
            )
        )

    # ── Phase 3: Turbine Connection (S-023 to S-030) ─────────────
    phase3_steps: list[dict[str, Any]] = [
        # S-022A: Open String 1 earth switch
        {
            "step_id": "S-022A",
            "type": StepType.SWITCHING,
            "action": "Open Earth Switch ES-STR-01 (remove String 1 earth)",
            "equipment_id": "ES-STR-01",
            "switching_action": SwitchingAction.OPEN,
            "before": EquipmentState.CLOSED,
            "after": EquipmentState.OPEN,
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "SCADA indication + local indicator",
            "notes": "Must remove string earth before closing feeder CB",
        },
        # S-023: Close String 1 feeder CB
        {
            "step_id": "S-023",
            "type": StepType.SWITCHING,
            "action": "Close String 1 feeder CB",
            "equipment_id": "CB-STR-01",
            "switching_action": SwitchingAction.CLOSE,
            "before": EquipmentState.OPEN,
            "after": EquipmentState.CLOSED,
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA indication + voltage on string cable",
        },
        # S-024: Energise WTG_01 through WTG_06
        {
            "step_id": "S-024",
            "type": StepType.VERIFICATION,
            "action": (
                "Energise WTG_01 through WTG_06 (one by one) "
                "-- close array CB, verify voltage, start turbine, "
                "ramp to 10%, confirm grid sync"
            ),
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "Each turbine grid-synced and producing power",
        },
        # S-025: String 1 ramp to 50%
        {
            "step_id": "S-025",
            "type": StepType.VERIFICATION,
            "action": "String 1 power ramp to 50%",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA active power reading ~45 MW (6 x 7.5 MW)",
        },
        # S-026: String 1 ramp to 100%
        {
            "step_id": "S-026",
            "type": StepType.VERIFICATION,
            "action": "String 1 power ramp to 100%",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "SCADA active power reading ~90 MW (6 x 15 MW)",
        },
        # S-027: Verify protection
        {
            "step_id": "S-027",
            "type": StepType.VERIFICATION,
            "action": "Verify: Protection relay operation correct",
            "responsible": "Local",
            "pic_confirm": True,
            "verification": "Protection event log — no spurious trips",
        },
        # S-028: Repeat for strings 2-6
        {
            "step_id": "S-028",
            "type": StepType.DECLARATION,
            "action": "REPEAT S-023 to S-027 for Strings 2-6",
            "responsible": "SCADA",
            "pic_confirm": True,
            "verification": "All 6 strings connected and producing",
            "notes": "Each string follows identical sequence",
        },
        # S-029: All strings connected
        {
            "step_id": "S-029",
            "type": StepType.VERIFICATION,
            "action": "ALL STRINGS CONNECTED — Farm at rated power (510 MW)",
            "responsible": "PiC",
            "pic_confirm": True,
            "verification": "SCADA total active power ~510 MW",
        },
        # S-030: PiC declaration complete
        {
            "step_id": "S-030",
            "type": StepType.DECLARATION,
            "action": "PiC declares: 'Energisation programme complete'",
            "responsible": "PiC",
            "pic_confirm": False,
            "verification": "Verbal declaration logged",
            "notes": "Programme officially complete. SAT report to be issued.",
        },
    ]

    for step_def in phase3_steps:
        step_num += 1
        steps.append(
            SwitchingStep(
                step_id=step_def["step_id"],
                step_number=step_num,
                phase=3,
                step_type=step_def["type"],
                action=step_def["action"],
                equipment_id=step_def.get("equipment_id", ""),
                switching_action=step_def.get("switching_action"),
                expected_state_before=step_def.get("before"),
                expected_state_after=step_def.get("after"),
                responsible=step_def["responsible"],
                pic_confirmation=step_def["pic_confirm"],
                verification=step_def.get("verification", ""),
                notes=step_def.get("notes", ""),
            )
        )

    programme.steps = steps
    _add_audit(programme, "Programme created", pic_name, details=f"30 steps, PiC: {pic_name}")

    return programme


# ── Programme Lifecycle ──────────────────────────────────────────


def approve_programme(programme: SwitchingProgramme, approved_by: str) -> None:
    """Approve the programme for execution.

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme to approve.
    approved_by : str
        Name of the approver (typically the PiC).

    Raises
    ------
    ProgrammeStateError
        If programme is not in CREATED state.
    """
    if programme.status != ProgrammeStatus.CREATED:
        raise ProgrammeStateError(
            f"Cannot approve programme in '{programme.status.value}' state. "
            f"Must be in 'created' state."
        )
    programme.status = ProgrammeStatus.APPROVED
    _add_audit(programme, "Programme approved", approved_by)


def start_programme(programme: SwitchingProgramme) -> None:
    """Start programme execution.

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme to start.

    Raises
    ------
    ProgrammeStateError
        If programme is not in APPROVED state.
    """
    if programme.status != ProgrammeStatus.APPROVED:
        raise ProgrammeStateError(
            f"Cannot start programme in '{programme.status.value}' state. "
            f"Must be in 'approved' state."
        )
    programme.status = ProgrammeStatus.IN_PROGRESS
    _add_audit(programme, "Programme started", programme.pic_name)


# ── Step Execution ───────────────────────────────────────────────


def execute_step(
    programme: SwitchingProgramme,
    step_id: str,
    executed_by: str,
    pic_confirmed: bool = True,
) -> SwitchingStep:
    """Execute a single step in the switching programme.

    Validation chain:
    1. Programme must be IN_PROGRESS (not HOLD, COMPLETED, ABORTED)
    2. Step must be the current step (sequential execution)
    3. PiC confirmation required for most steps
    4. For SWITCHING steps: pre-condition check → equipment action → post-condition
    5. For HOLD_POINT steps: transitions programme to HOLD state

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme being executed.
    step_id : str
        Step to execute (must match current step).
    executed_by : str
        Name of the person executing.
    pic_confirmed : bool
        Whether PiC has verbally confirmed this step.

    Returns
    -------
    SwitchingStep
        The executed step with updated status.

    Raises
    ------
    ProgrammeStateError
        If programme is not in correct state.
    StepExecutionError
        If step cannot be executed (wrong order, pre-condition fail).
    PiCDecisionRequiredError
        If step is a hold point (programme goes to HOLD).
    """
    # 1. Programme state check
    if programme.status != ProgrammeStatus.IN_PROGRESS:
        raise ProgrammeStateError(
            f"Cannot execute step: programme is '{programme.status.value}'. Must be 'in_progress'."
        )

    # 2. Sequential execution check
    if programme.current_step_index >= len(programme.steps):
        raise StepExecutionError("All steps have been executed.")

    current_step = programme.steps[programme.current_step_index]
    if current_step.step_id != step_id:
        raise StepExecutionError(
            f"Cannot execute '{step_id}': current step is '{current_step.step_id}' "
            f"(step {current_step.step_number} of {len(programme.steps)})."
        )

    # 3. PiC confirmation
    if current_step.pic_confirmation and not pic_confirmed:
        raise StepExecutionError(
            f"Step '{step_id}' requires PiC confirmation. "
            f"Set pic_confirmed=True after verbal confirmation from PiC."
        )

    # Mark step in progress
    current_step.status = StepStatus.IN_PROGRESS

    # 4. Handle HOLD_POINT — transitions programme to HOLD
    if current_step.step_type == StepType.HOLD_POINT:
        programme.status = ProgrammeStatus.HOLD
        current_step.status = StepStatus.IN_PROGRESS
        current_step.executed_by = executed_by
        _add_audit(
            programme,
            f"Hold point reached: {current_step.action}",
            executed_by,
            step_id=step_id,
            details="Programme on HOLD — awaiting PiC GO/NO-GO decision",
        )
        raise PiCDecisionRequiredError(
            f"Hold point at {step_id}: {current_step.action}. "
            f"Programme is now on HOLD. Call pic_go_decision() or pic_nogo_decision()."
        )

    # 5. Execute based on step type
    if current_step.step_type == StepType.SWITCHING and current_step.switching_action is not None:
        # Pre-condition: verify equipment is in expected state
        if current_step.expected_state_before is not None:
            actual = programme.system_state.get(current_step.equipment_id)
            if actual != current_step.expected_state_before:
                current_step.status = StepStatus.FAILED
                _add_audit(
                    programme,
                    "Step failed: pre-condition not met",
                    executed_by,
                    step_id=step_id,
                    details=(
                        f"Expected {current_step.equipment_id} = "
                        f"{current_step.expected_state_before.value}, "
                        f"actual = {actual}"
                    ),
                )
                raise StepExecutionError(
                    f"Pre-condition failed for '{step_id}': "
                    f"{current_step.equipment_id} expected "
                    f"{current_step.expected_state_before.value}, "
                    f"actual {actual}."
                )

        # Execute equipment action
        try:
            result = execute_switching_action(
                current_step.equipment_id,
                current_step.switching_action,
                programme.system_state,
            )
        except (EquipmentNotFoundError, InvalidTransitionError, InterlockError) as e:
            current_step.status = StepStatus.FAILED
            _add_audit(
                programme,
                f"Step failed: {e}",
                executed_by,
                step_id=step_id,
            )
            raise StepExecutionError(str(e)) from e

        # Post-condition: verify equipment reached expected state
        if (
            current_step.expected_state_after is not None
            and result.new_state != current_step.expected_state_after
        ):
            current_step.status = StepStatus.FAILED
            _add_audit(
                programme,
                "Step failed: post-condition not met",
                executed_by,
                step_id=step_id,
                details=(
                    f"Expected {current_step.equipment_id} = "
                    f"{current_step.expected_state_after.value}, "
                    f"actual = {result.new_state.value}"
                ),
            )
            raise StepExecutionError(
                f"Post-condition failed for '{step_id}': "
                f"{current_step.equipment_id} expected "
                f"{current_step.expected_state_after.value}, "
                f"actual {result.new_state.value}."
            )

    # Mark step completed
    current_step.status = StepStatus.COMPLETED
    current_step.executed_at = datetime.now(UTC)
    current_step.executed_by = executed_by
    programme.current_step_index += 1

    _add_audit(
        programme,
        f"Step completed: {current_step.action}",
        executed_by,
        step_id=step_id,
    )

    # Check if programme is complete
    if programme.current_step_index >= len(programme.steps):
        programme.status = ProgrammeStatus.COMPLETED
        _add_audit(programme, "Programme completed", programme.pic_name)

    return current_step


# ── PiC Decision Logic ───────────────────────────────────────────


def pic_go_decision(
    programme: SwitchingProgramme,
    pic_name: str,
    notes: str = "",
) -> SwitchingStep:
    """PiC GO decision — resume programme execution past a hold point.

    Completes the hold point step and returns programme to IN_PROGRESS.

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme on HOLD.
    pic_name : str
        PiC making the decision (must match programme PiC).
    notes : str
        Optional notes for the audit trail.

    Returns
    -------
    SwitchingStep
        The completed hold point step.

    Raises
    ------
    ProgrammeStateError
        If programme is not on HOLD.
    StepExecutionError
        If PiC name doesn't match.
    """
    if programme.status != ProgrammeStatus.HOLD:
        raise ProgrammeStateError(
            f"Cannot make GO decision: programme is '{programme.status.value}', not 'hold'."
        )

    if pic_name != programme.pic_name:
        raise StepExecutionError(
            f"Only the PiC ({programme.pic_name}) can make GO/NO-GO decisions. "
            f"'{pic_name}' is not authorised."
        )

    current_step = programme.steps[programme.current_step_index]
    current_step.status = StepStatus.COMPLETED
    current_step.executed_at = datetime.now(UTC)
    current_step.executed_by = pic_name

    programme.current_step_index += 1
    programme.status = ProgrammeStatus.IN_PROGRESS

    _add_audit(
        programme,
        f"PiC GO decision at {current_step.step_id}",
        pic_name,
        step_id=current_step.step_id,
        details=notes or "All conditions met — proceed",
    )

    return current_step


def pic_nogo_decision(
    programme: SwitchingProgramme,
    pic_name: str,
    reason: str,
) -> None:
    """PiC NO-GO decision — abort the programme at a hold point.

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme on HOLD.
    pic_name : str
        PiC making the decision.
    reason : str
        Mandatory reason for aborting.

    Raises
    ------
    ProgrammeStateError
        If programme is not on HOLD.
    StepExecutionError
        If PiC name doesn't match.
    """
    if programme.status != ProgrammeStatus.HOLD:
        raise ProgrammeStateError(
            f"Cannot make NO-GO decision: programme is '{programme.status.value}', not 'hold'."
        )

    if pic_name != programme.pic_name:
        raise StepExecutionError(
            f"Only the PiC ({programme.pic_name}) can make GO/NO-GO decisions. "
            f"'{pic_name}' is not authorised."
        )

    current_step = programme.steps[programme.current_step_index]
    current_step.status = StepStatus.FAILED

    programme.status = ProgrammeStatus.ABORTED

    _add_audit(
        programme,
        f"PiC NO-GO decision at {current_step.step_id}",
        pic_name,
        step_id=current_step.step_id,
        details=f"Reason: {reason}",
    )


def emergency_stop(
    programme: SwitchingProgramme,
    initiated_by: str,
    reason: str,
) -> None:
    """Emergency stop — immediately abort the programme.

    Can be called from any non-terminal state. Records the emergency
    in the audit trail.

    Parameters
    ----------
    programme : SwitchingProgramme
        The programme to stop.
    initiated_by : str
        Person initiating the emergency stop.
    reason : str
        Reason for the emergency stop.

    Raises
    ------
    ProgrammeStateError
        If programme is already in a terminal state.
    """
    if programme.status in _TERMINAL_STATUSES:
        raise ProgrammeStateError(
            f"Cannot emergency stop: programme is already '{programme.status.value}'."
        )

    programme.status = ProgrammeStatus.ABORTED

    _add_audit(
        programme,
        "EMERGENCY STOP",
        initiated_by,
        details=f"Reason: {reason}",
    )
