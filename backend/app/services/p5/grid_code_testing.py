"""
Operational notification of the wind farm to PSE — EON → ION → FON.

Regulation (EU) 2016/631 (NC RfG), Title III, for a type D power park module:

- **EON**, Art. 34 — entitles the owner to energise its internal network and
  auxiliaries through the grid connection; issued once the protection and
  control settings at the connection point are agreed with the system operator.
- **ION**, Art. 35 — entitles the owner to operate and *generate* for a limited
  period, at most 24 months (35(4)); issued after the data and study review of
  35(3)(a)–(f).
- **FON**, Art. 36 — entitles normal operation; issued after the incompatibilities
  found at ION are removed and the statement of compliance, models and studies
  are updated with values measured during the compliance tests (36(3)).

Which tests apply: the connection point of this farm is PSE's onshore 400 kV
busbar, so by Art. 23(1) it is treated as an *onshore* power park module, type D.
Compliance tests are those of Art. 49 (= Art. 47 + Art. 48(2)–(9)); compliance
simulations those of Art. 56 (= Art. 54, 55, plus fault-ride-through to Art.
16(3)(a)). An equipment certificate may replace a test (Art. 48(1)).

Parameter values are PSE's choices in its requirements of general application
under NC RfG (2018), the same values the P2 studies use.

The programme couples to this campaign: EON is a gate before cable 1 is
energised, ION before the turbines are released, and FON can only be submitted
once the switching programme is complete.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from app.core.exceptions import NotFoundError, StateTransitionError
from app.services.p2.frt_simulation import (
    PSE_FRT_PROFILE,
    RECOVERY_FRACTION,
    RECOVERY_LIMIT_S,
)
from app.services.p2.power_plant_controller import (
    FREQ_RESPONSE_WINDOW_S,
    Q_RESPONSE_LIMIT_S,
    SETPOINT_DEADLINE_S,
)
from app.services.p2.statcom_sizing import PSE_Q_ABSORB_PU, PSE_Q_PRODUCE_PU

ION_MAX_VALIDITY_DAYS = 730  # NC RfG Art. 35(4): 24 months


class NotificationStage(StrEnum):
    EON = "eon"
    ION = "ion"
    FON = "fon"


class ComplianceVerdict(StrEnum):
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"


class StageStatus(StrEnum):
    OPEN = "open"
    SUBMITTED = "submitted"
    ISSUED = "issued"


class ItemKind(StrEnum):
    DOCUMENT = "document"  # data / agreement reviewed by PSE
    TEST = "test"  # measured on site
    SIMULATION = "simulation"  # validated model


@dataclass
class GridCodeTest:
    """One item of a notification stage."""

    test_id: str
    stage: NotificationStage
    kind: ItemKind
    name: str
    description: str
    standard: str
    acceptance_criteria: str
    verdict: ComplianceVerdict = ComplianceVerdict.PENDING
    evidence: str = ""
    tested_by: str = ""
    tested_at: str | None = None


@dataclass
class NotificationApplication:
    stage: NotificationStage
    status: StageStatus = StageStatus.OPEN
    tests: list[GridCodeTest] = field(default_factory=list)
    submitted_to: str = "PSE S.A."
    submitted_at: str | None = None
    approved_at: str | None = None
    valid_until: str | None = None  # ION only


@dataclass
class ComplianceCampaign:
    campaign_id: str
    programme_id: str
    stages: dict[NotificationStage, NotificationApplication] = field(default_factory=dict)
    created_at: str = ""
    cod_achieved: bool = False
    cod_date: str | None = None


class ComplianceGateError(StateTransitionError):
    """A stage prerequisite is not met."""


class ComplianceTestNotFoundError(NotFoundError):
    """Unknown item ID."""


_D, _T, _S = ItemKind.DOCUMENT, ItemKind.TEST, ItemKind.SIMULATION
_FRT_T, _FRT_U = PSE_FRT_PROFILE[1][0] * 1e3, PSE_FRT_PROFILE[2]

# (id, kind, name, reference, description, acceptance)
_SPECS: dict[NotificationStage, list[tuple[str, ItemKind, str, str, str, str]]] = {
    NotificationStage.EON: [
        (
            "EON-01",
            _D,
            "Protection and control settings agreed",
            "NC RfG Art. 34(2)",
            "Settings at the connection point agreed between PSE and the owner",
            "Signed setting schedule for the 400/220 kV connection and export circuits",
        ),
        (
            "EON-02",
            _T,
            "Real-time data exchange with PSE",
            "NC RfG Art. 14(5)(d)",
            "Telemetry and control signals between the plant and PSE dispatch verified",
            "All agreed signals verified end-to-end with PSE dispatch",
        ),
        (
            "EON-03",
            _T,
            "Earthing system",
            "EN 50522:2022",
            "Earth-potential rise, touch and step voltages measured at the OSS and onshore",
            "Touch voltages within the EN 50522 permissible curve for the fault duration",
        ),
        (
            "EON-04",
            _D,
            "Operational agreement",
            "Connection agreement",
            "Switching authority, Person in Control and communication with PSE dispatch",
            "Signed operating agreement and contact list",
        ),
    ],
    NotificationStage.ION: [
        (
            "ION-01",
            _D,
            "Itemised statement of compliance",
            "NC RfG Art. 35(3)(a)",
            "Requirement-by-requirement statement",
            "Submitted and reviewed",
        ),
        (
            "ION-02",
            _D,
            "Detailed technical data",
            "NC RfG Art. 35(3)(b)",
            "Technical data of the PPM relevant to the grid connection",
            "Submitted and reviewed",
        ),
        (
            "ION-03",
            _D,
            "Equipment certificates",
            "NC RfG Art. 35(3)(c)",
            "Turbine unit certificates from an authorised certifier",
            "Certificates cover the turbine type and software version installed",
        ),
        (
            "ION-04",
            _D,
            "Simulation models",
            "NC RfG Art. 35(3)(d), 15(6)(c)",
            "RMS (and EMT if requested) models of turbines, PPC and STATCOM",
            "Accepted by PSE",
        ),
        (
            "ION-05",
            _D,
            "Steady-state and dynamic studies",
            "NC RfG Art. 35(3)(e)",
            "Load flow, reactive capability, FRT, power quality (see P2 studies)",
            "Studies show compliance at the connection point",
        ),
        (
            "ION-06",
            _D,
            "Intended compliance tests",
            "NC RfG Art. 35(3)(f)",
            "Test programme for the FON stage",
            "Agreed with PSE",
        ),
    ],
    NotificationStage.FON: [
        (
            "FON-01",
            _T,
            "LFSM-O response",
            "NC RfG Art. 47(3), 13(2)",
            "Frequency steps/ramps causing ≥ 10 % Pmax change, simulated signal injected",
            "Threshold 50.2 Hz, droop 5 % (PSE); static and dynamic response as required",
        ),
        (
            "FON-02",
            _T,
            "Active power controllability",
            "NC RfG Art. 48(2), 15(2)(a)",
            "Operation below a PSE setpoint",
            f"Setpoint reached within {SETPOINT_DEADLINE_S / 60:.0f} min; accuracy as set by PSE",
        ),
        (
            "FON-03",
            _T,
            "LFSM-U response",
            "NC RfG Art. 48(3), 15(2)(c)",
            "Steps/ramps from ≤ 80 % Pmax causing ≥ 10 % Pmax change",
            "Threshold 49.8 Hz, droop 5 % (PSE); no undamped oscillation",
        ),
        (
            "FON-04",
            _T,
            "FSM response",
            "NC RfG Art. 48(4), 15(2)(d)",
            "Full active-power frequency response range, simulated signal injected",
            f"Full activation ≤ {FREQ_RESPONSE_WINDOW_S:.0f} s; droop and deadband as set by PSE",
        ),
        (
            "FON-05",
            _T,
            "Frequency restoration control",
            "NC RfG Art. 48(5), 15(2)(e)",
            "Co-operation of FSM and restoration control",
            "Static and dynamic parameters met",
        ),
        (
            "FON-06",
            _T,
            "Reactive power capability",
            "NC RfG Art. 48(6), 21(3)(b)–(c)",
            "Max lead and lag Q: > 60 % Pmax for 30 min, 30–50 % for 30 min, 10–20 % for 60 min",
            f"Q/Pmax from −{PSE_Q_ABSORB_PU:.2f} to +{PSE_Q_PRODUCE_PU:.2f} at the connection "
            "point (PSE); no protection operation",
        ),
        (
            "FON-07",
            _T,
            "Voltage control mode",
            "NC RfG Art. 48(7), 21(3)(d)",
            "Slope, deadband, accuracy and Q activation time after a voltage step",
            f"Insensitivity ≤ 0.01 pu; 90 % of ΔQ within {Q_RESPONSE_LIMIT_S:.0f} s (PSE)",
        ),
        (
            "FON-08",
            _T,
            "Reactive power control mode",
            "NC RfG Art. 48(8), 21(3)(d)(v)",
            "Setpoint range, increment, accuracy, activation time",
            "As set by PSE",
        ),
        (
            "FON-09",
            _T,
            "Power factor control mode",
            "NC RfG Art. 48(9), 21(3)(d)(vi)",
            "Setpoint range, accuracy, Q response to an active-power step",
            "As set by PSE",
        ),
        (
            "FON-10",
            _S,
            "Fault-ride-through",
            "NC RfG Art. 56, 16(3)(a)",
            "Validated model against the PSE voltage-against-time profile",
            f"Stays connected: 0 pu for {_FRT_T:.0f} ms, recovery to {_FRT_U[1]:.2f} pu at "
            f"{_FRT_U[0]:.1f} s",
        ),
        (
            "FON-11",
            _S,
            "Fast fault current injection",
            "NC RfG Art. 54(3), 20(2)(b)",
            "Reactive current during symmetrical faults",
            "Per PSE K-factor requirement",
        ),
        (
            "FON-12",
            _S,
            "Post-fault active power recovery",
            "NC RfG Art. 54(5), 20(3)",
            "Active power after fault clearance",
            f"{RECOVERY_FRACTION:.0%} of pre-fault power within {RECOVERY_LIMIT_S:.0f} s (PSE)",
        ),
        (
            "FON-13",
            _D,
            "Updated statement of compliance",
            "NC RfG Art. 36(3)",
            "Technical data, models and studies updated with measured values",
            "All ION incompatibilities removed",
        ),
    ],
}


def create_compliance_campaign(programme_id: str) -> ComplianceCampaign:
    """Campaign with all three stages open and every item pending."""
    return ComplianceCampaign(
        campaign_id=f"GCC-{uuid.uuid4().hex[:8].upper()}",
        programme_id=programme_id,
        created_at=datetime.now(UTC).isoformat(),
        stages={
            stage: NotificationApplication(
                stage=stage,
                tests=[
                    GridCodeTest(tid, stage, kind, name, desc, ref, acc)
                    for tid, kind, name, ref, desc, acc in specs
                ],
            )
            for stage, specs in _SPECS.items()
        },
    )


def record_test_result(
    campaign: ComplianceCampaign,
    test_id: str,
    verdict: ComplianceVerdict,
    evidence: str,
    tested_by: str,
) -> GridCodeTest:
    """Record a verdict; an issued stage is frozen."""
    for stage in campaign.stages.values():
        for test in stage.tests:
            if test.test_id == test_id:
                if stage.status != StageStatus.OPEN:
                    name = stage.stage.value.upper()
                    raise ComplianceGateError(f"{name} is {stage.status.value}; items are frozen.")
                test.verdict, test.evidence, test.tested_by = verdict, evidence, tested_by
                test.tested_at = datetime.now(UTC).isoformat()
                return test
    raise ComplianceTestNotFoundError(f"Item {test_id} not found.")


def submit_notification(
    campaign: ComplianceCampaign,
    stage: NotificationStage,
    programme_completed: bool,
) -> NotificationApplication:
    """Submit a stage to PSE once its items are compliant and the predecessor is issued."""
    app = campaign.stages[stage]
    if app.status != StageStatus.OPEN:
        raise ComplianceGateError(f"{stage.value.upper()} is already {app.status.value}.")
    open_items = [t.test_id for t in app.tests if t.verdict != ComplianceVerdict.COMPLIANT]
    if open_items:
        raise ComplianceGateError(f"Not compliant yet: {', '.join(open_items)}.")
    order = list(NotificationStage)
    if stage != NotificationStage.EON:
        prev = campaign.stages[order[order.index(stage) - 1]]
        if prev.approved_at is None:
            raise ComplianceGateError(f"{prev.stage.value.upper()} must be issued first.")
    if stage == NotificationStage.FON and not programme_completed:
        raise ComplianceGateError("FON requires the energisation programme to be complete.")
    app.status = StageStatus.SUBMITTED
    app.submitted_at = datetime.now(UTC).isoformat()
    return app


def approve_notification(
    campaign: ComplianceCampaign, stage: NotificationStage
) -> NotificationApplication:
    """PSE issues the notification (simulated). FON = commercial operation."""
    app = campaign.stages[stage]
    if app.status != StageStatus.SUBMITTED:
        raise ComplianceGateError(f"{stage.value.upper()} has not been submitted.")
    now = datetime.now(UTC)
    app.status = StageStatus.ISSUED
    app.approved_at = now.isoformat()
    if stage == NotificationStage.ION:
        app.valid_until = (now + timedelta(days=ION_MAX_VALIDITY_DAYS)).isoformat()
    if stage == NotificationStage.FON:
        campaign.cod_achieved = True
        campaign.cod_date = now.isoformat()
    return app
