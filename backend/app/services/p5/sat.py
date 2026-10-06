"""
Site acceptance tests (SAT) of circuit 1 — after installation, before energisation.

SAT shows that what passed FAT survived transport and installation and works
as an integrated system: cables tested in place, the transformer compared with
its factory fingerprints, instrument transformers and protection proven by
injection, the 87L scheme tested end-to-end over its channel, SCADA verified
point by point.

The cable's main-insulation after-installation test is not in this list: the
programme performs it as IEC 62067's alternative, 24 h at U0 (the soak step),
because the cable is energised from the grid anyway.

Gate: a SAT campaign can only be opened when an approved FAT campaign exists
for every equipment class of the circuit (transformer, 220 kV GIS, protection
panel). The switching programme checks that the SAT is approved (step 1.02).
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.core.exceptions import StateTransitionError
from app.services.p2.network_model import EXPORT_CABLE_1000, EXPORT_CABLE_LENGTH_KM, OLTC_STEPS
from app.services.p5.fat import (
    EquipmentClass,
    FATCampaign,
    TestCampaignStatus,
    TestResult,
    TestSpecification,
    pass_fail_spec,
)

_R = EXPORT_CABLE_1000.r_ac_ohm_per_km * EXPORT_CABLE_LENGTH_KM
_X = EXPORT_CABLE_1000.x_ohm_per_km * EXPORT_CABLE_LENGTH_KM
CABLE1_Z1_OHM = math.hypot(_R, _X)  # ≈ 5.3 Ω
OLTC_POSITIONS = 2 * OLTC_STEPS + 1  # −10 … +10

SAT_SPECS: tuple[TestSpecification, ...] = (
    pass_fail_spec(
        "SAT-01",
        "Export cable 1 oversheath DC test",
        "IEC 60229, IEC 62067",
        "Oversheath withstand after laying, both ends",
    ),
    pass_fail_spec(
        "SAT-02",
        "Array cables strings 1–3 after-installation AC test",
        "IEC 60840",
        "Main insulation AC test (tabulated voltage for 1 h, or U0 for 24 h)",
    ),
    TestSpecification(
        "SAT-03",
        "Export cable 1 positive-sequence impedance",
        "Project specification",
        f"Deviation from design |Z1| = {CABLE1_Z1_OHM:.2f} Ω ({_R:.2f} + j{_X:.2f} Ω at 90 °C)",
        "%",
        -5.0,
        5.0,
        1.6,
    ),
    TestSpecification(
        "SAT-04",
        "TX-OSS-01 voltage ratio after installation",
        "IEC 60076-1 Table 1",
        "Deviation from 220/66 kV at the principal tap",
        "%",
        -0.5,
        0.5,
        0.09,
    ),
    pass_fail_spec(
        "SAT-05",
        "TX-OSS-01 FRA compared with the FAT fingerprint",
        "IEC 60076-18",
        "No winding movement after sea transport and lifting",
    ),
    pass_fail_spec(
        "SAT-06",
        "TX-OSS-01 dissolved gas analysis after filling",
        "IEC 60599",
        "Gas levels consistent with a new, un-energised unit",
    ),
    TestSpecification(
        "SAT-07",
        "TX-OSS-01 OLTC full-range operation",
        "IEC 60214-1",
        f"All {OLTC_POSITIONS} positions (−{OLTC_STEPS}…+{OLTC_STEPS}) reached, local and remote",
        "positions",
        OLTC_POSITIONS,
        OLTC_POSITIONS,
        OLTC_POSITIONS,
    ),
    TestSpecification(
        "SAT-08",
        "Protection CT ratio error, class 5P",
        "IEC 61869-2",
        "Ratio error at rated primary current",
        "%",
        -1.0,
        1.0,
        0.3,
    ),
    TestSpecification(
        "SAT-09",
        "VT ratio error, class 0.5",
        "IEC 61869-3",
        "Ratio error at rated voltage",
        "%",
        -0.5,
        0.5,
        0.12,
    ),
    pass_fail_spec(
        "SAT-10",
        "Circuit-breaker timing",
        "IEC 62271-100",
        "Opening/closing times of circuit-1 breakers within tolerance of the FAT values",
    ),
    TestSpecification(
        "SAT-11",
        "Protection secondary injection",
        "IEC 60255-151",
        "Largest pickup error of the circuit-1 relays (project: declared ±5 %)",
        "%",
        -5.0,
        5.0,
        1.5,
    ),
    pass_fail_spec(
        "SAT-12",
        "87L end-to-end test",
        "Project specification",
        "Line differential tested from both ends over the communication channel",
    ),
    TestSpecification(
        "SAT-13",
        "GOOSE trip transfer time",
        "IEC 61850-5 (TT6)",
        "Measured on the station bus",
        "ms",
        0.0,
        3.0,
        1.6,
    ),
    TestSpecification(
        "SAT-14",
        "SCADA point-to-point verification",
        "IEC 61850, IEC 60870-5-104",
        "Points of circuit 1 verified at the OSS HMI and the control centre",
        "%",
        100.0,
        100.0,
        100.0,
    ),
    pass_fail_spec(
        "SAT-15",
        "Earthing system",
        "EN 50522",
        "Touch and step voltages within the permissible values",
    ),
    pass_fail_spec(
        "SAT-16",
        "Fire detection and suppression",
        "EN 54 (detection)",
        "Detection, alarm and release signals of the transformer and GIS rooms",
    ),
    pass_fail_spec(
        "SAT-17",
        "Emergency trip",
        "Project specification",
        "Every emergency-stop station opens all circuit-1 breakers",
    ),
)


@dataclass
class SATCampaign:
    campaign_id: str
    programme_id: str
    status: TestCampaignStatus = TestCampaignStatus.CREATED
    fat_campaign_id: str = ""  # comma-separated approved FAT campaigns it relies on
    specs: dict[str, TestSpecification] = field(default_factory=dict)
    results: dict[str, TestResult] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    approved_by: str = ""
    approved_at: datetime | None = None


class SATFATGateError(StateTransitionError):
    """An equipment class has no approved FAT campaign."""


def create_sat_campaign(programme_id: str, fat_campaigns: list[FATCampaign]) -> SATCampaign:
    """Open the SAT once every equipment class has an approved FAT."""
    approved = {
        c.equipment_class: c for c in fat_campaigns if c.status == TestCampaignStatus.APPROVED
    }
    missing = [cls.value for cls in EquipmentClass if cls not in approved]
    if missing:
        raise SATFATGateError(f"No approved FAT for: {', '.join(missing)}.")
    return SATCampaign(
        campaign_id=f"SAT-{datetime.now(UTC):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
        programme_id=programme_id,
        fat_campaign_id=",".join(c.campaign_id for c in approved.values()),
        specs={s.test_id: s for s in SAT_SPECS},
    )
