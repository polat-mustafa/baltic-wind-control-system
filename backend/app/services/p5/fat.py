"""
Factory Acceptance Test (FAT) specifications and campaign management.

Implements IEC-standard FAT test specifications for offshore substation
equipment, with campaign lifecycle management and automated pass/fail
evaluation against tolerance bands.

Physics — Why Factory Acceptance Testing Matters
--------------------------------------------------
Before a 220/66 kV transformer, GIS switchgear, or protection relay
ships to an offshore platform 45 km from shore, it must pass rigorous
factory tests. Failure at sea means a major vessel mobilisation
(~EUR 500k/day) and months of delay. FAT catches defects while the
equipment is still at the manufacturer's premises where repair is
straightforward.

Key physical phenomena tested:
- **HV withstand** (IEC 60060-1): Apply 460 kV AC for 60 s to verify
  insulation integrity. Partial discharge must remain < 10 pC.
- **Transformer ratio** (IEC 60076-1): Verify turns ratio within ±0.5%
  to ensure correct voltage transformation 220/66 kV.
- **FRA baseline** (IEC 60076-18): Frequency Response Analysis captures
  the transformer's electromagnetic fingerprint — any shift after
  transport indicates core/winding displacement.
- **GIS gas tightness** (IEC 62271-203): SF6 leakage < 0.5%/year
  ensures the insulation medium remains effective for 30+ years.

Standard — IEC References
--------------------------
- IEC 60060-1:2010 — High-voltage test techniques (withstand)
- IEC 60270:2000 — Partial discharge measurements
- IEC 60076-1:2011 — Power transformers (ratio, impedance)
- IEC 60076-18:2012 — Frequency response analysis
- IEC 60567:2011 — Dissolved gas analysis (oil-filled equipment)
- IEC 60255-1:2022 — Protection relay type testing
- IEC 62271-203:2022 — GIS gas tightness

Maths — Tolerance Band Evaluation
------------------------------------
Each test has a specification with bounds:

    PASS if:  spec.min_value <= measured_value <= spec.max_value

For single-bound tests (e.g. PD < 10 pC):
    min_value = -inf (no lower bound)
    max_value = 10.0

For ratio tests (e.g. transformer ratio ±0.5%):
    nominal = 220/66 = 3.333
    min_value = 3.333 × (1 - 0.005) = 3.317
    max_value = 3.333 × (1 + 0.005) = 3.350

Code — Deterministic Finite Automaton Pattern
----------------------------------------------
Campaign lifecycle:  CREATED → IN_PROGRESS → COMPLETED → APPROVED
Each test result triggers an automatic verdict evaluation against the
spec tolerance band. The campaign can only be approved when all tests
pass (or receive conditional_pass from the approver).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

# ── Enums ──────────────────────────────────────────────────────────


class TestVerdict(StrEnum):
    """Verdict for a single test result."""

    NOT_TESTED = "not_tested"
    PASS = "pass"
    FAIL = "fail"
    CONDITIONAL_PASS = "conditional_pass"


class TestCampaignStatus(StrEnum):
    """Campaign lifecycle states."""

    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    APPROVED = "approved"


# ── Shared Types ───────────────────────────────────────────────────


@dataclass(frozen=True)
class TestSpecification:
    """Immutable test specification with acceptance criteria.

    Attributes
    ----------
    test_id : str
        Unique test identifier (e.g. 'FAT-001').
    name : str
        Human-readable test name.
    standard : str
        IEC/EN standard reference.
    description : str
        What the test verifies.
    unit : str
        Measurement unit.
    min_value : float
        Lower acceptance bound (use float('-inf') for no lower bound).
    max_value : float
        Upper acceptance bound (use float('inf') for no upper bound).
    """

    test_id: str
    name: str
    standard: str
    description: str
    unit: str
    min_value: float
    max_value: float


@dataclass
class TestResult:
    """Mutable test result recorded during a campaign.

    Attributes
    ----------
    test_id : str
        Matching spec test_id.
    measured_value : float
        Recorded measurement.
    verdict : TestVerdict
        Auto-evaluated or overridden verdict.
    recorded_by : str
        Engineer who recorded the result.
    recorded_at : datetime
        UTC timestamp.
    notes : str
        Optional observations.
    """

    test_id: str
    measured_value: float
    verdict: TestVerdict = TestVerdict.NOT_TESTED
    recorded_by: str = ""
    recorded_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    notes: str = ""


# ── FAT Specifications ────────────────────────────────────────────

FAT_SPECS: tuple[TestSpecification, ...] = (
    TestSpecification(
        test_id="FAT-001",
        name="HV Withstand Test",
        standard="IEC 60060-1",
        description="Apply 460 kV AC for 60 s — no breakdown or flashover",
        unit="kV",
        min_value=460.0,
        max_value=float("inf"),
    ),
    TestSpecification(
        test_id="FAT-002",
        name="Partial Discharge Measurement",
        standard="IEC 60270",
        description="PD level during HV withstand must remain below 10 pC",
        unit="pC",
        min_value=float("-inf"),
        max_value=10.0,
    ),
    TestSpecification(
        test_id="FAT-003",
        name="Transformer Ratio Test",
        standard="IEC 60076-1",
        description="Turns ratio 220/66 kV = 3.333 within ±0.5%",
        unit="ratio",
        min_value=3.333 * 0.995,  # 3.317
        max_value=3.333 * 1.005,  # 3.350
    ),
    TestSpecification(
        test_id="FAT-004",
        name="Transformer Impedance Test",
        standard="IEC 60076-1",
        description="Short-circuit impedance within ±10% of nameplate",
        unit="%",
        min_value=12.0 * 0.90,  # 10.8% (nameplate 12%)
        max_value=12.0 * 1.10,  # 13.2%
    ),
    TestSpecification(
        test_id="FAT-005",
        name="Frequency Response Analysis (FRA) Baseline",
        standard="IEC 60076-18",
        description="Record FRA baseline fingerprint for transport comparison",
        unit="dB",
        min_value=float("-inf"),
        max_value=float("inf"),
    ),
    TestSpecification(
        test_id="FAT-006",
        name="Dissolved Gas Analysis (DGA) Baseline",
        standard="IEC 60567",
        description="Oil DGA baseline — all gas concentrations within normal",
        unit="ppm",
        min_value=float("-inf"),
        max_value=50.0,
    ),
    TestSpecification(
        test_id="FAT-007",
        name="Protection Relay Type Test",
        standard="IEC 60255",
        description="Relay pickup accuracy within ±5% at rated conditions",
        unit="%_error",
        min_value=-5.0,
        max_value=5.0,
    ),
    TestSpecification(
        test_id="FAT-008",
        name="GIS Gas Tightness",
        standard="IEC 62271-203",
        description="SF6 leakage rate < 0.5% per year",
        unit="%/year",
        min_value=float("-inf"),
        max_value=0.5,
    ),
)


# ── FAT Campaign ──────────────────────────────────────────────────


@dataclass
class FATCampaign:
    """Factory Acceptance Test campaign for a piece of equipment.

    Attributes
    ----------
    campaign_id : str
        Unique campaign identifier.
    equipment_tag : str
        Equipment being tested (e.g. 'TX-OSS-01').
    status : TestCampaignStatus
        Campaign lifecycle state.
    specs : dict[str, TestSpecification]
        Test specifications keyed by test_id.
    results : dict[str, TestResult]
        Recorded results keyed by test_id.
    created_at : datetime
        UTC timestamp of campaign creation.
    approved_by : str
        Who approved the campaign (empty until approved).
    approved_at : datetime | None
        UTC timestamp of approval.
    """

    campaign_id: str
    equipment_tag: str
    status: TestCampaignStatus = TestCampaignStatus.CREATED
    specs: dict[str, TestSpecification] = field(default_factory=dict)
    results: dict[str, TestResult] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    approved_by: str = ""
    approved_at: datetime | None = None


# ── Exceptions ────────────────────────────────────────────────────

from app.core.exceptions import DomainError, NotFoundError, StateTransitionError  # noqa: E402


class FATError(DomainError):
    """Base exception for FAT operations."""


class FATCampaignStateError(StateTransitionError):
    """Campaign is in wrong state for the requested operation."""


class FATTestNotFoundError(NotFoundError):
    """Test ID not found in campaign specs."""


# ── Pure Functions ────────────────────────────────────────────────


def evaluate_test_verdict(spec: TestSpecification, measured_value: float) -> TestVerdict:
    """Evaluate pass/fail against specification tolerance band.

    Parameters
    ----------
    spec : TestSpecification
        The test specification with acceptance bounds.
    measured_value : float
        The recorded measurement.

    Returns
    -------
    TestVerdict
        PASS if within bounds, FAIL otherwise.
    """
    if spec.min_value <= measured_value <= spec.max_value:
        return TestVerdict.PASS
    return TestVerdict.FAIL


# ── Campaign Functions ────────────────────────────────────────────


def create_fat_campaign(equipment_tag: str) -> FATCampaign:
    """Create a new FAT campaign with all 8 standard specs.

    Parameters
    ----------
    equipment_tag : str
        Equipment identifier (e.g. 'TX-OSS-01').

    Returns
    -------
    FATCampaign
        New campaign in CREATED state with all specs loaded.
    """
    campaign_id = f"FAT-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    specs = {spec.test_id: spec for spec in FAT_SPECS}

    return FATCampaign(
        campaign_id=campaign_id,
        equipment_tag=equipment_tag,
        specs=specs,
    )


def record_fat_result(
    campaign: FATCampaign,
    test_id: str,
    measured_value: float,
    recorded_by: str,
    notes: str = "",
) -> TestResult:
    """Record a test result and auto-evaluate the verdict.

    Parameters
    ----------
    campaign : FATCampaign
        The FAT campaign.
    test_id : str
        Test specification ID (e.g. 'FAT-001').
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
    FATCampaignStateError
        If campaign is already APPROVED.
    FATTestNotFoundError
        If test_id is not in the campaign specs.
    """
    if campaign.status == TestCampaignStatus.APPROVED:
        raise FATCampaignStateError(
            f"Cannot record results: campaign '{campaign.campaign_id}' is already approved."
        )

    if test_id not in campaign.specs:
        raise FATTestNotFoundError(
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


def all_fat_passed(campaign: FATCampaign) -> bool:
    """Check if all FAT tests passed.

    Returns
    -------
    bool
        True if every spec has a result with PASS or CONDITIONAL_PASS verdict.
    """
    if len(campaign.results) < len(campaign.specs):
        return False

    passing = {TestVerdict.PASS, TestVerdict.CONDITIONAL_PASS}
    return all(r.verdict in passing for r in campaign.results.values())


def approve_fat_campaign(campaign: FATCampaign, approved_by: str) -> None:
    """Approve a completed FAT campaign.

    Parameters
    ----------
    campaign : FATCampaign
        The campaign to approve.
    approved_by : str
        Name of the approver.

    Raises
    ------
    FATCampaignStateError
        If campaign is not COMPLETED or not all tests passed.
    """
    if campaign.status != TestCampaignStatus.COMPLETED:
        raise FATCampaignStateError(
            f"Cannot approve: campaign is '{campaign.status.value}', must be 'completed'."
        )

    if not all_fat_passed(campaign):
        raise FATCampaignStateError("Cannot approve: not all tests passed. Review failing tests.")

    campaign.status = TestCampaignStatus.APPROVED
    campaign.approved_by = approved_by
    campaign.approved_at = datetime.now(UTC)
