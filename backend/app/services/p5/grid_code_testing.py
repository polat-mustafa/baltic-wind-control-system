"""
Grid Code Compliance Testing — EON / ION / FON notification pipeline.

Physics & Regulatory Context
=============================
Before a wind farm can export power commercially, the TSO (PSE in Poland)
requires a staged series of compliance demonstrations:

1. **EON — Energisation Operational Notification**
   First energisation of the export system. Proves:
   - Protection settings match the PSE-approved settings schedule
   - SCADA telemetry reaches the National Control Centre
   - SAT results confirm equipment is fit for service
   - Earthing system impedance is within design limits
   Standards: IEC 60255 (protection), IEC 61850 (SCADA), IEC 60364 (earthing)

2. **ION — Interim Operational Notification**
   Partial generation (typically 10-30% of capacity). Proves:
   - Steady-state load flow matches the connection agreement
   - Harmonic emissions comply with IEC 61000-3-6 planning levels
   - Voltage quality at PCC meets EN 50160
   - Power quality recorder is installed and logging
   - Reactive power capability matches the declared P-Q chart
   Standards: IEC 61400-21-1, EN 50160, IEC 61000-3-6

3. **FON — Final Operational Notification**
   Full-capacity operation. Proves:
   - Fault Ride Through (FRT) matches NC RfG Type D requirements
   - Frequency response (LFSM-O, LFSM-U) is correctly parameterised
   - Full P-Q capability curve demonstrated under test conditions
   - Reactive power range at PCC: 0.95 lead to 0.95 lag (IRiESP)
   - All commissioning punch-list items are closed
   Standards: NC RfG (EU 2016/631), IRiESP §B.4, IEC 61400-27-1

Gate Logic (Critical Path):
  EON → ION: All EON tests COMPLIANT + SAT campaign approved
  ION → FON: All ION tests COMPLIANT + switching programme completed
  FON approval = **Commercial Operation Date (COD)**

Standards: NC RfG (EU 2016/631), IRiESP, IEC 61400-21-1, IEC 60255.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

# ── Enums ───────────────────────────────────────────────────────


class NotificationStage(StrEnum):
    """The three TSO notification stages before COD."""

    EON = "eon"
    ION = "ion"
    FON = "fon"


class ComplianceVerdict(StrEnum):
    """Verdict for individual tests and overall stage status."""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    PENDING = "pending"
    CONDITIONAL = "conditional"


# ── Data Models ─────────────────────────────────────────────────


@dataclass
class GridCodeTest:
    """A single compliance test within a notification stage."""

    test_id: str
    stage: NotificationStage
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
    """Tracks submission and approval of a notification stage to PSE."""

    stage: NotificationStage
    status: ComplianceVerdict = ComplianceVerdict.PENDING
    tests: list[GridCodeTest] = field(default_factory=list)
    submitted_to: str = "PSE"
    submitted_at: str | None = None
    approved_at: str | None = None


@dataclass
class ComplianceCampaign:
    """Full compliance campaign covering all 3 stages (EON → ION → FON)."""

    campaign_id: str
    programme_id: str
    stages: dict[NotificationStage, NotificationApplication] = field(default_factory=dict)
    created_at: str = ""
    cod_achieved: bool = False
    cod_date: str | None = None


# ── Exceptions ──────────────────────────────────────────────────


class ComplianceError(Exception):
    """Base exception for grid code compliance operations."""


class ComplianceGateError(ComplianceError):
    """Raised when a stage gate prerequisite is not met."""


class ComplianceTestNotFoundError(ComplianceError):
    """Raised when a test ID is not found in the campaign."""


# ── Test Specifications (Roadmap Table 6.10) ────────────────────

EON_TEST_SPECS: list[dict[str, str]] = [
    {
        "test_id": "EON-001",
        "name": "Protection settings verification",
        "description": "Confirm all relay settings match PSE-approved settings schedule",
        "standard": "IEC 60255",
        "acceptance_criteria": "All 12 relay settings within ±2% of approved values",
    },
    {
        "test_id": "EON-002",
        "name": "SCADA telemetry validation",
        "description": "Verify all telemetry points reach PSE National Control Centre",
        "standard": "IEC 61850",
        "acceptance_criteria": "100% of status and analogue points confirmed at NCC",
    },
    {
        "test_id": "EON-003",
        "name": "SAT results review",
        "description": "All Site Acceptance Tests passed and campaign approved",
        "standard": "IEC 62271-200",
        "acceptance_criteria": "SAT campaign status = approved, all tests = pass",
    },
    {
        "test_id": "EON-004",
        "name": "Earthing system impedance",
        "description": "Measure earth grid impedance at OSS and verify design compliance",
        "standard": "IEC 60364-4-41",
        "acceptance_criteria": "Earth impedance ≤ 1 Ω at OSS main earth bar",
    },
    {
        "test_id": "EON-005",
        "name": "Intertrip scheme test",
        "description": "Verify intertrip signal path from onshore to offshore CBs",
        "standard": "IEC 60834",
        "acceptance_criteria": "Intertrip operates within 100 ms end-to-end",
    },
    {
        "test_id": "EON-006",
        "name": "Emergency stop function test",
        "description": "Verify all emergency stop buttons trip the correct HV circuits",
        "standard": "IEC 61936-1",
        "acceptance_criteria": "All 4 E-stop stations trip within 200 ms",
    },
]

ION_TEST_SPECS: list[dict[str, str]] = [
    {
        "test_id": "ION-001",
        "name": "Steady-state load flow validation",
        "description": "Compare measured power flow at PCC against Pandapower model",
        "standard": "IEC 61400-21-1",
        "acceptance_criteria": "Active power within ±3% of model at 30% generation",
    },
    {
        "test_id": "ION-002",
        "name": "Harmonic emission measurement",
        "description": "Measure current harmonics at PCC up to 50th order",
        "standard": "IEC 61000-3-6",
        "acceptance_criteria": "All individual harmonics below planning levels (Table 3)",
    },
    {
        "test_id": "ION-003",
        "name": "Voltage quality at PCC",
        "description": "7-day power quality recording at the point of connection",
        "standard": "EN 50160",
        "acceptance_criteria": "Voltage within ±10% of Un for 95% of 10-min averages",
    },
    {
        "test_id": "ION-004",
        "name": "Power quality recorder verification",
        "description": "Confirm IEC 61000-4-30 Class A PQ recorder is installed and logging",
        "standard": "IEC 61000-4-30",
        "acceptance_criteria": "Recorder operational, data accessible to PSE via SCADA",
    },
    {
        "test_id": "ION-005",
        "name": "Reactive power capability (partial)",
        "description": "Demonstrate Q capability at 30% P as per declared P-Q chart",
        "standard": "IRiESP §B.4",
        "acceptance_criteria": "Q range covers 0.95 lead to 0.95 lag at 30% Pn",
    },
]

FON_TEST_SPECS: list[dict[str, str]] = [
    {
        "test_id": "FON-001",
        "name": "Fault Ride Through (FRT) test",
        "description": "Verify voltage-against-time profile compliance during grid faults",
        "standard": "NC RfG Type D (EU 2016/631)",
        "acceptance_criteria": "Remain connected for 150 ms at 0.05 pu voltage",
    },
    {
        "test_id": "FON-002",
        "name": "LFSM-O frequency response",
        "description": "Verify over-frequency active power reduction (droop = 5%)",
        "standard": "NC RfG Article 13(2)",
        "acceptance_criteria": "ΔP/ΔF response within ±0.5% of declared droop",
    },
    {
        "test_id": "FON-003",
        "name": "LFSM-U frequency response",
        "description": "Verify under-frequency active power increase capability",
        "standard": "NC RfG Article 13(2)",
        "acceptance_criteria": "Response activated within 2 s of frequency deviation",
    },
    {
        "test_id": "FON-004",
        "name": "Full P-Q capability curve",
        "description": "Demonstrate complete P-Q operating envelope at rated power",
        "standard": "IRiESP §B.4",
        "acceptance_criteria": "8 test points on P-Q boundary, all within declared envelope",
    },
    {
        "test_id": "FON-005",
        "name": "Full reactive power range at PCC",
        "description": "Demonstrate 0.95 lead to 0.95 lag at rated active power",
        "standard": "IRiESP §B.4",
        "acceptance_criteria": "Q at Prated: -160 MVAR to +160 MVAR demonstrated",
    },
    {
        "test_id": "FON-006",
        "name": "Commissioning punch-list closure",
        "description": "Verify all outstanding commissioning items are resolved",
        "standard": "Project-specific",
        "acceptance_criteria": "Zero open Category A or B punch-list items",
    },
]


# ── In-Memory Store ─────────────────────────────────────────────

_campaigns: dict[str, ComplianceCampaign] = {}


# ── Helper: Build Tests from Specs ──────────────────────────────


def _build_tests(stage: NotificationStage, specs: list[dict[str, str]]) -> list[GridCodeTest]:
    """Create GridCodeTest instances from specification dicts."""
    return [
        GridCodeTest(
            test_id=spec["test_id"],
            stage=stage,
            name=spec["name"],
            description=spec["description"],
            standard=spec["standard"],
            acceptance_criteria=spec["acceptance_criteria"],
        )
        for spec in specs
    ]


# ── Public API ──────────────────────────────────────────────────


def create_compliance_campaign(programme_id: str) -> ComplianceCampaign:
    """
    Create a new compliance campaign with all 3 stages and their tests.

    Each stage is initialised with PENDING status and its pre-defined
    test specifications.
    """
    campaign_id = f"GCC-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(UTC).isoformat()

    stages = {
        NotificationStage.EON: NotificationApplication(
            stage=NotificationStage.EON,
            tests=_build_tests(NotificationStage.EON, EON_TEST_SPECS),
        ),
        NotificationStage.ION: NotificationApplication(
            stage=NotificationStage.ION,
            tests=_build_tests(NotificationStage.ION, ION_TEST_SPECS),
        ),
        NotificationStage.FON: NotificationApplication(
            stage=NotificationStage.FON,
            tests=_build_tests(NotificationStage.FON, FON_TEST_SPECS),
        ),
    }

    campaign = ComplianceCampaign(
        campaign_id=campaign_id,
        programme_id=programme_id,
        stages=stages,
        created_at=now,
    )
    _campaigns[programme_id] = campaign
    return campaign


def get_compliance_campaign(programme_id: str) -> ComplianceCampaign | None:
    """Return the compliance campaign for a programme, or None."""
    return _campaigns.get(programme_id)


def record_test_result(
    programme_id: str,
    test_id: str,
    verdict: ComplianceVerdict,
    evidence: str,
    tested_by: str,
) -> GridCodeTest:
    """
    Record a compliance test result.

    Finds the test by ID across all stages, updates its verdict,
    evidence, and tester information.
    """
    campaign = _campaigns.get(programme_id)
    if campaign is None:
        raise ComplianceError(f"No compliance campaign found for programme {programme_id}")

    for stage_app in campaign.stages.values():
        for test in stage_app.tests:
            if test.test_id == test_id:
                test.verdict = verdict
                test.evidence = evidence
                test.tested_by = tested_by
                test.tested_at = datetime.now(UTC).isoformat()
                return test

    raise ComplianceTestNotFoundError(f"Test {test_id} not found in campaign")


def submit_notification(
    programme_id: str,
    stage: NotificationStage,
    submitted_by: str,
) -> NotificationApplication:
    """
    Submit a notification stage to PSE for approval.

    Gate logic enforced:
    - EON: All EON tests must be COMPLIANT
    - ION: All ION tests must be COMPLIANT + EON must be approved
    - FON: All FON tests must be COMPLIANT + ION must be approved
    """
    campaign = _campaigns.get(programme_id)
    if campaign is None:
        raise ComplianceError(f"No compliance campaign found for programme {programme_id}")

    stage_app = campaign.stages[stage]

    # Check all tests in this stage are compliant
    non_compliant = [t for t in stage_app.tests if t.verdict != ComplianceVerdict.COMPLIANT]
    if non_compliant:
        names = ", ".join(t.test_id for t in non_compliant)
        raise ComplianceGateError(
            f"Cannot submit {stage.value.upper()}: tests not compliant: {names}"
        )

    # Check predecessor stage gates
    if stage == NotificationStage.ION:
        eon = campaign.stages[NotificationStage.EON]
        if eon.approved_at is None:
            raise ComplianceGateError("Cannot submit ION: EON must be approved first")
    elif stage == NotificationStage.FON:
        ion = campaign.stages[NotificationStage.ION]
        if ion.approved_at is None:
            raise ComplianceGateError("Cannot submit FON: ION must be approved first")

    stage_app.submitted_at = datetime.now(UTC).isoformat()
    stage_app.status = ComplianceVerdict.CONDITIONAL
    return stage_app


def approve_notification(
    programme_id: str,
    stage: NotificationStage,
) -> NotificationApplication:
    """
    Approve a notification stage (simulates PSE approval).

    Gate: all tests in stage must be COMPLIANT and stage must be submitted.
    FON approval triggers COD (Commercial Operation Date).
    """
    campaign = _campaigns.get(programme_id)
    if campaign is None:
        raise ComplianceError(f"No compliance campaign found for programme {programme_id}")

    stage_app = campaign.stages[stage]

    if stage_app.submitted_at is None:
        raise ComplianceGateError(f"Cannot approve {stage.value.upper()}: not yet submitted")

    non_compliant = [t for t in stage_app.tests if t.verdict != ComplianceVerdict.COMPLIANT]
    if non_compliant:
        raise ComplianceGateError(f"Cannot approve {stage.value.upper()}: not all tests compliant")

    now = datetime.now(UTC).isoformat()
    stage_app.approved_at = now
    stage_app.status = ComplianceVerdict.COMPLIANT

    # FON approval = COD
    if stage == NotificationStage.FON:
        campaign.cod_achieved = True
        campaign.cod_date = now

    return stage_app


def get_stage_summary(
    programme_id: str,
    stage: NotificationStage,
) -> dict[str, object]:
    """
    Return a summary of a stage's compliance status.

    Includes test counts by verdict and the overall stage status.
    """
    campaign = _campaigns.get(programme_id)
    if campaign is None:
        raise ComplianceError(f"No compliance campaign found for programme {programme_id}")

    stage_app = campaign.stages[stage]
    verdicts = {v: 0 for v in ComplianceVerdict}
    for test in stage_app.tests:
        verdicts[test.verdict] += 1

    return {
        "stage": stage.value,
        "total_tests": len(stage_app.tests),
        "compliant": verdicts[ComplianceVerdict.COMPLIANT],
        "non_compliant": verdicts[ComplianceVerdict.NON_COMPLIANT],
        "pending": verdicts[ComplianceVerdict.PENDING],
        "conditional": verdicts[ComplianceVerdict.CONDITIONAL],
        "submitted_at": stage_app.submitted_at,
        "approved_at": stage_app.approved_at,
        "overall_status": stage_app.status.value,
    }


def clear_campaigns() -> None:
    """Reset all campaigns (for testing)."""
    _campaigns.clear()
