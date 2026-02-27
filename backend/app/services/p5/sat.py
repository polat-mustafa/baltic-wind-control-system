"""
Site Acceptance Test (SAT) specifications and campaign management.

Implements IEC-standard SAT test specifications for offshore substation
equipment after installation. SAT verifies that equipment survives
transport and installation, and functions correctly in its final
operating environment.

Physics — Why Site Acceptance Testing Matters
----------------------------------------------
Equipment that passed FAT at the factory may be damaged during:
- **Sea transport** — wave-induced vibration can shift transformer
  windings (detected by FRA comparison with FAT baseline).
- **Installation** — crane lifts, cable pulling, and bolting can
  introduce new partial discharge sources or loose connections.
- **Environmental exposure** — offshore humidity, salt spray, and
  temperature cycling stress insulation and seals.

SAT verifies the equipment is fit for service in its installed state
before any HV energisation occurs. Critically:

- **CT/VT ratio tests** ensure protection relays receive accurate
  measurements (a 2% CT error means protection may not trip on time).
- **CB timing** ensures fault clearance within the protection
  coordination grading time (< 80 ms close, < 60 ms open per
  IEC 62271-100).
- **GOOSE latency** < 4 ms ensures IEC 61850 peer-to-peer tripping
  meets the 3 ms + 1 ms margin budget for busbar protection.

Standard — IEC References
--------------------------
- IEC 60229:2007 — Cable insulation resistance tests
- IEC 61869-2:2012 — Current transformer ratio accuracy
- IEC 61869-3:2011 — Voltage transformer ratio accuracy
- IEC 62271-100:2021 — Circuit breaker timing
- IEC 60255-1:2022 — Protection relay trip test
- IEC 61850-8-1:2011 — GOOSE messaging latency
- IEC 60870-5-104:2006 — SCADA telecontrol protocol
- IEC 60214:2014 — Tap changer operation
- EN 54:2014 — Fire detection and alarm systems
- IEC 60502:2005 — Power cable impedance

Maths — Same Tolerance Band Model as FAT
------------------------------------------
SAT uses the same TestSpecification / TestResult / TestVerdict types
from the FAT module. The evaluate_test_verdict() function applies:

    PASS if:  spec.min_value <= measured_value <= spec.max_value

Code — FAT-Gate Pattern
-------------------------
SAT campaign creation optionally requires an approved FAT campaign.
This enforces the real-world sequence: FAT must pass before equipment
ships, SAT must pass before energisation begins.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.services.p5.fat import (
    FATCampaign,
    TestCampaignStatus,
    TestResult,
    TestSpecification,
    TestVerdict,
    evaluate_test_verdict,
)

# ── SAT Specifications ────────────────────────────────────────────

SAT_SPECS: tuple[TestSpecification, ...] = (
    TestSpecification(
        test_id="SAT-001",
        name="Insulation Resistance Test",
        standard="IEC 60229",
        description="Cable insulation resistance > 100 MOhm at 5 kV DC",
        unit="MOhm",
        min_value=100.0,
        max_value=float("inf"),
    ),
    TestSpecification(
        test_id="SAT-002",
        name="CT Ratio Accuracy",
        standard="IEC 61869-2",
        description="Current transformer ratio within ±1% at rated current",
        unit="%_error",
        min_value=-1.0,
        max_value=1.0,
    ),
    TestSpecification(
        test_id="SAT-003",
        name="VT Ratio Accuracy",
        standard="IEC 61869-3",
        description="Voltage transformer ratio within ±0.5% at rated voltage",
        unit="%_error",
        min_value=-0.5,
        max_value=0.5,
    ),
    TestSpecification(
        test_id="SAT-004",
        name="CB Close Timing",
        standard="IEC 62271-100",
        description="Circuit breaker closing time < 80 ms",
        unit="ms",
        min_value=float("-inf"),
        max_value=80.0,
    ),
    TestSpecification(
        test_id="SAT-005",
        name="CB Open Timing",
        standard="IEC 62271-100",
        description="Circuit breaker opening time < 60 ms",
        unit="ms",
        min_value=float("-inf"),
        max_value=60.0,
    ),
    TestSpecification(
        test_id="SAT-006",
        name="Protection Trip Test",
        standard="IEC 60255",
        description="Relay issues trip signal within rated time for simulated fault",
        unit="ms",
        min_value=float("-inf"),
        max_value=100.0,
    ),
    TestSpecification(
        test_id="SAT-007",
        name="GOOSE Latency",
        standard="IEC 61850-8-1",
        description="GOOSE message transfer time < 4 ms end-to-end",
        unit="ms",
        min_value=float("-inf"),
        max_value=4.0,
    ),
    TestSpecification(
        test_id="SAT-008",
        name="SCADA Point Verification",
        standard="IEC 60870-5-104",
        description="100% of SCADA points responding correctly",
        unit="%",
        min_value=100.0,
        max_value=100.0,
    ),
    TestSpecification(
        test_id="SAT-009",
        name="Tap Changer Operation",
        standard="IEC 60214",
        description="OLTC operates through full range without jamming",
        unit="tap_position",
        min_value=1.0,
        max_value=33.0,
    ),
    TestSpecification(
        test_id="SAT-010",
        name="Fire Detection Response",
        standard="EN 54",
        description="Fire detection system response time < 30 s",
        unit="s",
        min_value=float("-inf"),
        max_value=30.0,
    ),
    TestSpecification(
        test_id="SAT-011",
        name="Emergency Stop Verification",
        standard="IEC 62271-100",
        description="Emergency stop trips all CBs and alarms correctly",
        unit="pass_flag",
        min_value=1.0,
        max_value=1.0,
    ),
    TestSpecification(
        test_id="SAT-012",
        name="Cable Impedance Measurement",
        standard="IEC 60502",
        description="Export cable impedance within ±5% of design value",
        unit="%_error",
        min_value=-5.0,
        max_value=5.0,
    ),
)


# ── SAT Campaign ──────────────────────────────────────────────────


@dataclass
class SATCampaign:
    """Site Acceptance Test campaign for installed equipment.

    Attributes
    ----------
    campaign_id : str
        Unique campaign identifier.
    programme_id : str
        Associated switching programme.
    status : TestCampaignStatus
        Campaign lifecycle state.
    fat_campaign_id : str
        Linked FAT campaign (empty if no FAT gate).
    specs : dict[str, TestSpecification]
        Test specifications keyed by test_id.
    results : dict[str, TestResult]
        Recorded results keyed by test_id.
    created_at : datetime
        UTC timestamp of campaign creation.
    approved_by : str
        Who approved the campaign.
    approved_at : datetime | None
        UTC timestamp of approval.
    """

    campaign_id: str
    programme_id: str
    status: TestCampaignStatus = TestCampaignStatus.CREATED
    fat_campaign_id: str = ""
    specs: dict[str, TestSpecification] = field(default_factory=dict)
    results: dict[str, TestResult] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    approved_by: str = ""
    approved_at: datetime | None = None


# ── Exceptions ────────────────────────────────────────────────────


class SATError(Exception):
    """Base exception for SAT operations."""


class SATCampaignStateError(SATError):
    """Campaign is in wrong state for the requested operation."""


class SATTestNotFoundError(SATError):
    """Test ID not found in campaign specs."""


class SATFATGateError(SATError):
    """FAT campaign has not been approved — cannot create SAT."""


# ── Campaign Functions ────────────────────────────────────────────


def create_sat_campaign(
    programme_id: str,
    fat_campaign: FATCampaign | None = None,
) -> SATCampaign:
    """Create a new SAT campaign with all 12 standard specs.

    Parameters
    ----------
    programme_id : str
        Associated switching programme ID.
    fat_campaign : FATCampaign | None
        If provided, FAT must be APPROVED before SAT can be created.

    Returns
    -------
    SATCampaign
        New campaign in CREATED state with all specs loaded.

    Raises
    ------
    SATFATGateError
        If fat_campaign is provided but not APPROVED.
    """
    if fat_campaign is not None and fat_campaign.status != TestCampaignStatus.APPROVED:
        raise SATFATGateError(
            f"FAT campaign '{fat_campaign.campaign_id}' is '{fat_campaign.status.value}', "
            f"must be 'approved' before SAT can begin."
        )

    campaign_id = f"SAT-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    specs = {spec.test_id: spec for spec in SAT_SPECS}

    return SATCampaign(
        campaign_id=campaign_id,
        programme_id=programme_id,
        fat_campaign_id=fat_campaign.campaign_id if fat_campaign else "",
        specs=specs,
    )


def record_sat_result(
    campaign: SATCampaign,
    test_id: str,
    measured_value: float,
    recorded_by: str,
    notes: str = "",
) -> TestResult:
    """Record a SAT test result and auto-evaluate the verdict.

    Parameters
    ----------
    campaign : SATCampaign
        The SAT campaign.
    test_id : str
        Test specification ID (e.g. 'SAT-001').
    measured_value : float
        Recorded measurement.
    recorded_by : str
        Engineer recording the result.
    notes : str
        Optional observations.

    Returns
    -------
    TestResult
        The recorded result with auto-evaluated verdict.

    Raises
    ------
    SATCampaignStateError
        If campaign is already APPROVED.
    SATTestNotFoundError
        If test_id is not in the campaign specs.
    """
    if campaign.status == TestCampaignStatus.APPROVED:
        raise SATCampaignStateError(
            f"Cannot record results: campaign '{campaign.campaign_id}' is already approved."
        )

    if test_id not in campaign.specs:
        raise SATTestNotFoundError(
            f"Test '{test_id}' not found in campaign '{campaign.campaign_id}'."
        )

    spec = campaign.specs[test_id]
    verdict = evaluate_test_verdict(spec, measured_value)

    result = TestResult(
        test_id=test_id,
        measured_value=measured_value,
        verdict=verdict,
        recorded_by=recorded_by,
        notes=notes,
    )
    campaign.results[test_id] = result

    # Transition to IN_PROGRESS on first result
    if campaign.status == TestCampaignStatus.CREATED:
        campaign.status = TestCampaignStatus.IN_PROGRESS

    # Transition to COMPLETED when all specs have results
    if len(campaign.results) == len(campaign.specs):
        campaign.status = TestCampaignStatus.COMPLETED

    return result


def all_sat_passed(campaign: SATCampaign) -> bool:
    """Check if all SAT tests passed.

    Returns
    -------
    bool
        True if every spec has a result with PASS or CONDITIONAL_PASS verdict.
    """
    if len(campaign.results) < len(campaign.specs):
        return False

    passing = {TestVerdict.PASS, TestVerdict.CONDITIONAL_PASS}
    return all(r.verdict in passing for r in campaign.results.values())


def approve_sat_campaign(campaign: SATCampaign, approved_by: str) -> None:
    """Approve a completed SAT campaign.

    Parameters
    ----------
    campaign : SATCampaign
        The campaign to approve.
    approved_by : str
        Name of the approver.

    Raises
    ------
    SATCampaignStateError
        If campaign is not COMPLETED or not all tests passed.
    """
    if campaign.status != TestCampaignStatus.COMPLETED:
        raise SATCampaignStateError(
            f"Cannot approve: campaign is '{campaign.status.value}', must be 'completed'."
        )

    if not all_sat_passed(campaign):
        raise SATCampaignStateError(
            "Cannot approve: not all tests passed. Review failing tests."
        )

    campaign.status = TestCampaignStatus.APPROVED
    campaign.approved_by = approved_by
    campaign.approved_at = datetime.now(UTC)
