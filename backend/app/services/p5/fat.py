"""
Factory acceptance tests (FAT) — routine tests at the manufacturer's works.

A FAT campaign is opened per equipment item and uses the template of its class:

- ``power_transformer`` (TX-OSS-01/02, SB-510: 300 MVA 220/66 kV; another farm:
  its own rating, ``transformer_tests(spec)``) — routine tests of
  IEC 60076-1 §11.1.2 with the tolerances of its Table 1, applied to the design
  values of ``p2.network_model`` (vk 12.5 %, vkr 0.25 % → load loss 750 kW,
  P0 60 kW, i0 0.05 %):
    ratio: the lower of ±0.5 % and ±1/10 of vk (= ±1.25 %) → ±0.5 %
    impedance (vk ≥ 10 %, principal tap): ±7.5 %
    each loss component: +15 % (total losses +10 %)
    no-load current: +30 %
  and the dielectric tests of IEC 60076-3:2013 (IVPD ≤ 250 pC at 1.58 Ur/√3).
- ``gis_220kv`` — routine tests of IEC 62271-203 / IEC 62271-1 for Ur = 245 kV
  (Ud 460 kV, Up 1050 kV; main-circuit resistance ≤ 1.2 Ru).
- ``protection_panel`` — relay accuracy against the declared class (IEC 60255-151)
  and GOOSE trip transfer time (IEC 61850-5 class TT6, ≤ 3 ms).

Limits marked "project" are purchase-specification values, not figures from a
standard. ``typical_value`` is a realistic passing measurement used to fill a
demonstration campaign.

Lifecycle: CREATED → IN_PROGRESS (first result) → COMPLETED (all recorded) →
APPROVED (all passed). A failed test can be re-recorded after repair.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol

from app.core.exceptions import NotFoundError, StateTransitionError, ValidationError
from app.services.p2.network_model import (
    SB510,
    TRAFO_66_220_I0_PERCENT,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_66_220_VKR_PERCENT,
    FarmSpec,
)

PASS_FAIL = "pass/fail"  # unit of a test recorded as 1 (pass) / 0 (fail)


class TestVerdict(StrEnum):
    __test__ = False  # not a pytest class

    NOT_TESTED = "not_tested"
    PASS = "pass"
    FAIL = "fail"


class TestCampaignStatus(StrEnum):
    __test__ = False  # not a pytest class

    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    APPROVED = "approved"


class EquipmentClass(StrEnum):
    POWER_TRANSFORMER = "power_transformer"
    GIS_220KV = "gis_220kv"
    PROTECTION_PANEL = "protection_panel"


@dataclass(frozen=True)
class TestSpecification:
    """Acceptance criterion: PASS if min_value ≤ measured ≤ max_value."""

    __test__ = False

    test_id: str
    name: str
    standard: str
    description: str
    unit: str
    min_value: float
    max_value: float
    typical_value: float = 1.0


@dataclass
class TestResult:
    __test__ = False

    test_id: str
    measured_value: float
    verdict: TestVerdict = TestVerdict.NOT_TESTED
    recorded_by: str = ""
    recorded_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    notes: str = ""


def pass_fail_spec(test_id: str, name: str, standard: str, description: str) -> TestSpecification:
    return TestSpecification(test_id, name, standard, description, PASS_FAIL, 1.0, 1.0, 1.0)


def transformer_tests(spec: FarmSpec = SB510) -> tuple[TestSpecification, ...]:
    """Routine tests of an OSS transformer of ``spec``: load and no-load loss limits
    follow its rating (SB-510: 300 MVA → 750 kW, 60 kW); typical values pass."""
    p_load = TRAFO_66_220_VKR_PERCENT / 100 * spec.oss_trafo_mva * 1e3
    return (
        TestSpecification(
            "FAT-T01",
            "Voltage ratio, principal tap",
            "IEC 60076-1 §11.3, Table 1",
            "Deviation from 220/66 kV; limit = lower of ±0.5 % and ±vk/10",
            "%",
            -0.5,
            0.5,
            0.08,
        ),
        TestSpecification(
            "FAT-T02",
            "Short-circuit impedance, principal tap",
            "IEC 60076-1 §11.4, Table 1",
            f"Declared vk {TRAFO_66_220_VK_PERCENT} %, tolerance ±7.5 % (vk ≥ 10 %)",
            "%",
            TRAFO_66_220_VK_PERCENT * 0.925,
            TRAFO_66_220_VK_PERCENT * 1.075,
            12.62,
        ),
        TestSpecification(
            "FAT-T03",
            "Load loss at rated current (75 °C)",
            "IEC 60076-1 §11.4, Table 1",
            f"Declared {p_load:.0f} kW, component tolerance +15 % (total +10 %)",
            "kW",
            0.0,
            p_load * 1.15,
            round(0.984 * p_load, 1),
        ),
        TestSpecification(
            "FAT-T04",
            "No-load loss at rated voltage",
            "IEC 60076-1 §11.5, Table 1",
            f"Declared {spec.oss_pfe_kw:.0f} kW, component tolerance +15 %",
            "kW",
            0.0,
            spec.oss_pfe_kw * 1.15,
            round(0.957 * spec.oss_pfe_kw, 1),
        ),
        TestSpecification(
            "FAT-T05",
            "No-load current at rated voltage",
            "IEC 60076-1 §11.5, Table 1",
            f"Design {TRAFO_66_220_I0_PERCENT} % of rated current, tolerance +30 %",
            "%",
            0.0,
            TRAFO_66_220_I0_PERCENT * 1.3,
            0.047,
        ),
        TestSpecification(
            "FAT-T06",
            "Induced voltage test with PD (IVPD)",
            "IEC 60076-3:2013",
            "Continuous PD level during the 1 h at 1.58 Ur/√3",
            "pC",
            0.0,
            250.0,
            85.0,
        ),
        pass_fail_spec(
            "FAT-T07",
            "Lightning impulse test",
            "IEC 60076-3:2013",
            "Full-wave LI at 1050 kV peak (Um 245 kV) — no breakdown, waveforms agree",
        ),
        pass_fail_spec(
            "FAT-T08",
            "FRA fingerprint recorded",
            "IEC 60076-18:2012",
            "Sweep-frequency response of all windings stored as the transport baseline",
        ),
        pass_fail_spec(
            "FAT-T09",
            "Dissolved gas analysis before/after tests",
            "IEC 60076-1 §11.1.2.2 d)",
            "No significant gas generation during the test programme (Um > 72.5 kV)",
        ),
    )


FAT_TEMPLATES: dict[EquipmentClass, tuple[TestSpecification, ...]] = {
    EquipmentClass.POWER_TRANSFORMER: transformer_tests(),
    EquipmentClass.GIS_220KV: (
        pass_fail_spec(
            "FAT-G01",
            "Power-frequency withstand, main circuit",
            "IEC 62271-203, IEC 62271-1",
            "460 kV r.m.s. for 1 min (Ur 245 kV) — no disruptive discharge",
        ),
        TestSpecification(
            "FAT-G02",
            "Partial discharge",
            "IEC 62271-203, IEC 60270",
            "PD after the withstand test (project limit 5 pC)",
            "pC",
            0.0,
            5.0,
            1.8,
        ),
        TestSpecification(
            "FAT-G03",
            "Main-circuit resistance",
            "IEC 62271-1",
            "Ratio to the type-test value Ru; limit 1.2 Ru",
            "% of Ru",
            0.0,
            120.0,
            96.0,
        ),
        TestSpecification(
            "FAT-G04",
            "Gas tightness",
            "IEC 62271-203",
            "SF6 leakage rate per gas compartment",
            "%/year",
            0.0,
            0.5,
            0.1,
        ),
        pass_fail_spec(
            "FAT-G05",
            "Mechanical operating test",
            "IEC 62271-100, IEC 62271-102",
            "CB, disconnector and earthing switch operations; interlocks; position signals",
        ),
        TestSpecification(
            "FAT-G06",
            "CB opening time",
            "IEC 62271-100",
            "Fingerprint for SAT (project: manufacturer range 20–30 ms)",
            "ms",
            20.0,
            30.0,
            24.0,
        ),
    ),
    EquipmentClass.PROTECTION_PANEL: (
        TestSpecification(
            "FAT-P01",
            "Overcurrent pickup accuracy",
            "IEC 60255-151",
            "Error at setting (project: declared ±5 %)",
            "%",
            -5.0,
            5.0,
            1.2,
        ),
        TestSpecification(
            "FAT-P02",
            "IDMT operate time at 5 × setting",
            "IEC 60255-151",
            "Error against the SI curve (project: declared class E5, ±5 %)",
            "%",
            -5.0,
            5.0,
            2.1,
        ),
        TestSpecification(
            "FAT-P03",
            "GOOSE trip transfer time",
            "IEC 61850-5 (TT6)",
            "Publisher application to subscriber application",
            "ms",
            0.0,
            3.0,
            1.4,
        ),
        pass_fail_spec(
            "FAT-P04",
            "IED configuration matches the SCD",
            "IEC 61850-6",
            "CID files of every IED consistent with the substation configuration description",
        ),
        pass_fail_spec(
            "FAT-P05",
            "Trip and interlock logic",
            "Project specification",
            "Every trip matrix entry and bay interlock verified with simulated inputs",
        ),
    ),
}


@dataclass
class FATCampaign:
    campaign_id: str
    equipment_tag: str
    equipment_class: EquipmentClass = EquipmentClass.POWER_TRANSFORMER
    status: TestCampaignStatus = TestCampaignStatus.CREATED
    specs: dict[str, TestSpecification] = field(default_factory=dict)
    results: dict[str, TestResult] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    approved_by: str = ""
    approved_at: datetime | None = None


class Campaign(Protocol):
    """What FAT and SAT campaigns share (SATCampaign lives in sat.py)."""

    campaign_id: str
    status: TestCampaignStatus
    specs: dict[str, TestSpecification]
    results: dict[str, TestResult]
    approved_by: str
    approved_at: datetime | None


class FATCampaignStateError(StateTransitionError):
    """Campaign is in the wrong state for the requested operation."""


class FATTestNotFoundError(NotFoundError):
    """Test ID not in the campaign."""


def evaluate_test_verdict(spec: TestSpecification, measured_value: float) -> TestVerdict:
    return (
        TestVerdict.PASS if spec.min_value <= measured_value <= spec.max_value else TestVerdict.FAIL
    )


def record_result(
    campaign: Campaign,
    test_id: str,
    measured_value: float,
    recorded_by: str,
    notes: str = "",
) -> TestResult:
    """Record (or re-record) a measurement and update the campaign status."""
    if campaign.status == TestCampaignStatus.APPROVED:
        raise FATCampaignStateError(f"{campaign.campaign_id} is approved; results are frozen.")
    spec = campaign.specs.get(test_id)
    if spec is None:
        raise FATTestNotFoundError(f"Test '{test_id}' is not part of {campaign.campaign_id}.")
    if spec.unit == PASS_FAIL and measured_value not in (0.0, 1.0):
        raise ValidationError("A pass/fail test is recorded as 1 (pass) or 0 (fail).")
    result = TestResult(test_id, measured_value, evaluate_test_verdict(spec, measured_value),
                        recorded_by, notes=notes)  # fmt: skip
    campaign.results[test_id] = result
    campaign.status = (
        TestCampaignStatus.COMPLETED
        if len(campaign.results) == len(campaign.specs)
        else TestCampaignStatus.IN_PROGRESS
    )
    return result


def all_passed(campaign: Campaign) -> bool:
    return len(campaign.results) == len(campaign.specs) and all(
        r.verdict == TestVerdict.PASS for r in campaign.results.values()
    )


def approve_campaign(campaign: Campaign, approved_by: str) -> None:
    if campaign.status != TestCampaignStatus.COMPLETED or not all_passed(campaign):
        raise FATCampaignStateError(
            "Only a completed campaign with every test passed can be approved."
        )
    campaign.status = TestCampaignStatus.APPROVED
    campaign.approved_by = approved_by
    campaign.approved_at = datetime.now(UTC)


def create_fat_campaign(
    equipment_tag: str, equipment_class: EquipmentClass, spec: FarmSpec = SB510
) -> FATCampaign:
    specs = (
        transformer_tests(spec)
        if equipment_class == EquipmentClass.POWER_TRANSFORMER
        else FAT_TEMPLATES[equipment_class]
    )
    return FATCampaign(
        campaign_id=f"FAT-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
        equipment_tag=equipment_tag,
        equipment_class=equipment_class,
        specs={s.test_id: s for s in specs},
    )
