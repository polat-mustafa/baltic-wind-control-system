"""Shared helpers for the P5 commissioning tests."""

from __future__ import annotations

from app.services.p2.network_model import SB510, FarmSpec
from app.services.p5.fat import EquipmentClass, approve_campaign, create_fat_campaign, record_result
from app.services.p5.grid_code_testing import (
    ComplianceVerdict,
    NotificationStage,
    approve_notification,
    create_compliance_campaign,
    record_test_result,
    submit_notification,
)
from app.services.p5.sat import create_sat_campaign
from app.services.p5.switching_programme import (
    PiCDecisionRequiredError,
    ProgrammeStatus,
    StepType,
    SwitchingProgramme,
    approve_programme,
    create_oss_energisation_programme,
    execute_step,
    pic_go_decision,
    start_programme,
)

PIC = "Jan Kowalski"


def fill_typical(campaign) -> None:  # FATCampaign | SATCampaign
    for spec in campaign.specs.values():
        record_result(campaign, spec.test_id, spec.typical_value, "Test engineer")


def approved_fats():
    fats = []
    for cls in EquipmentClass:
        fat = create_fat_campaign(f"TAG-{cls.value}", cls)
        fill_typical(fat)
        approve_campaign(fat, "Owner's engineer")
        fats.append(fat)
    return fats


def issue(programme: SwitchingProgramme, stage: NotificationStage) -> None:
    """Make every item of ``stage`` compliant, submit and issue it."""
    if programme.compliance_campaign is None:
        programme.compliance_campaign = create_compliance_campaign(programme.programme_id)
    campaign = programme.compliance_campaign
    for item in campaign.stages[stage].tests:
        record_test_result(campaign, item.test_id, ComplianceVerdict.COMPLIANT, "ok", PIC)
    submit_notification(campaign, stage, programme.status == ProgrammeStatus.COMPLETED)
    approve_notification(campaign, stage)


def ready_programme(spec: FarmSpec = SB510) -> SwitchingProgramme:
    """Programme in progress with SAT approved, EON and ION issued."""
    programme = create_oss_energisation_programme(PIC, spec)
    sat = create_sat_campaign(programme.programme_id, approved_fats())
    fill_typical(sat)
    approve_campaign(sat, PIC)
    programme.sat_campaign = sat
    issue(programme, NotificationStage.EON)
    issue(programme, NotificationStage.ION)
    approve_programme(programme, PIC)
    start_programme(programme)
    return programme


def run_until(programme: SwitchingProgramme, step_id: str | None = None) -> None:
    """Execute steps (GO at every hold point) until ``step_id`` is current, or to the end."""
    while programme.status == ProgrammeStatus.IN_PROGRESS:
        step = programme.steps[programme.current_step_index]
        if step.step_id == step_id:
            return
        try:
            execute_step(programme, step.step_id, PIC)
        except PiCDecisionRequiredError:
            assert step.step_type == StepType.HOLD_POINT
            pic_go_decision(programme, PIC)
