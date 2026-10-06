"""EON → ION → FON operational notification (services/p5/grid_code_testing.py)."""

from datetime import datetime

import pytest

from app.services.p5.grid_code_testing import (
    ION_MAX_VALIDITY_DAYS,
    ComplianceGateError,
    ComplianceTestNotFoundError,
    ComplianceVerdict,
    NotificationStage,
    StageStatus,
    approve_notification,
    create_compliance_campaign,
    record_test_result,
    submit_notification,
)

EON, ION, FON = NotificationStage.EON, NotificationStage.ION, NotificationStage.FON


def all_compliant(campaign, stage):
    for t in campaign.stages[stage].tests:
        record_test_result(campaign, t.test_id, ComplianceVerdict.COMPLIANT, "evidence", "Engineer")


def test_items_reference_nc_rfg_articles():
    c = create_compliance_campaign("P")
    refs = {t.test_id: t.standard for s in c.stages.values() for t in s.tests}
    assert refs["EON-01"] == "NC RfG Art. 34(2)"
    assert all(
        refs[f"ION-0{i}"].startswith(f"NC RfG Art. 35(3)({chr(96 + i)})") for i in range(1, 7)
    )
    assert "Art. 56" in refs["FON-10"]  # FRT by simulation for a type D PPM
    fon = {t.test_id: t for t in c.stages[FON].tests}
    assert "0 pu for 150 ms" in fon["FON-10"].acceptance_criteria
    assert "−0.35 to +0.40" in fon["FON-06"].acceptance_criteria  # PSE Q/Pmax


def test_sequence_and_gates():
    c = create_compliance_campaign("P")
    with pytest.raises(ComplianceGateError, match="Not compliant"):
        submit_notification(c, EON, programme_completed=False)
    all_compliant(c, ION)
    with pytest.raises(ComplianceGateError, match="EON must be issued"):
        submit_notification(c, ION, programme_completed=False)
    all_compliant(c, EON)
    with pytest.raises(ComplianceGateError, match="not been submitted"):
        approve_notification(c, EON)
    submit_notification(c, EON, programme_completed=False)
    with pytest.raises(ComplianceGateError, match="frozen"):
        record_test_result(c, "EON-01", ComplianceVerdict.NON_COMPLIANT, "", "x")
    approve_notification(c, EON)
    submit_notification(c, ION, programme_completed=False)
    ion = approve_notification(c, ION)
    days = (datetime.fromisoformat(ion.valid_until) - datetime.fromisoformat(ion.approved_at)).days
    assert days == ION_MAX_VALIDITY_DAYS == 730  # NC RfG Art. 35(4)
    all_compliant(c, FON)
    with pytest.raises(ComplianceGateError, match="programme to be complete"):
        submit_notification(c, FON, programme_completed=False)
    submit_notification(c, FON, programme_completed=True)
    approve_notification(c, FON)
    assert c.cod_achieved and c.stages[FON].status == StageStatus.ISSUED


def test_unknown_item():
    with pytest.raises(ComplianceTestNotFoundError):
        record_test_result(
            create_compliance_campaign("P"), "X-1", ComplianceVerdict.COMPLIANT, "", "x"
        )
