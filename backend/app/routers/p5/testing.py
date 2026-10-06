"""P5 sub-router: FAT, SAT and grid-code compliance (EON / ION / FON)."""

from __future__ import annotations

import math
from dataclasses import asdict
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, StateTransitionError
from app.db import get_session
from app.schemas.commissioning import (
    ApproveCampaignRequest,
    ComplianceCampaignSchema,
    CreateFATCampaignRequest,
    FATCampaignSchema,
    GridCodeTestSchema,
    NotificationApplicationSchema,
    RecordComplianceResultRequest,
    RecordTestResultRequest,
    SATCampaignSchema,
    TestResultSchema,
    TestSpecificationSchema,
)
from app.services.p5.fat import (
    EquipmentClass,
    FATCampaign,
    TestResult,
    TestSpecification,
    all_passed,
    approve_campaign,
    create_fat_campaign,
    record_result,
)
from app.services.p5.grid_code_testing import (
    ComplianceCampaign,
    ComplianceVerdict,
    NotificationApplication,
    NotificationStage,
    approve_notification,
    create_compliance_campaign,
    record_test_result,
    submit_notification,
)
from app.services.p5.programme_repository import ProgrammeRepository
from app.services.p5.sat import SATCampaign, create_sat_campaign
from app.services.p5.switching_programme import ProgrammeStatus, SwitchingProgramme, add_audit

router = APIRouter()


def _bound(x: float) -> float | None:
    return None if math.isinf(x) else x


def _spec(s: TestSpecification) -> TestSpecificationSchema:
    return TestSpecificationSchema(
        **{**asdict(s), "min_value": _bound(s.min_value), "max_value": _bound(s.max_value)}
    )


def _result(r: TestResult) -> TestResultSchema:
    return TestResultSchema(**asdict(r))


def _fat(c: FATCampaign) -> FATCampaignSchema:
    return FATCampaignSchema(
        campaign_id=c.campaign_id,
        equipment_tag=c.equipment_tag,
        equipment_class=c.equipment_class.value,
        status=c.status.value,
        specs=[_spec(s) for s in c.specs.values()],
        results=[_result(r) for r in c.results.values()],
        all_passed=all_passed(c),
        created_at=c.created_at,
        approved_by=c.approved_by,
        approved_at=c.approved_at,
    )


def _sat(c: SATCampaign) -> SATCampaignSchema:
    return SATCampaignSchema(
        campaign_id=c.campaign_id,
        programme_id=c.programme_id,
        status=c.status.value,
        fat_campaign_id=c.fat_campaign_id,
        specs=[_spec(s) for s in c.specs.values()],
        results=[_result(r) for r in c.results.values()],
        all_passed=all_passed(c),
        created_at=c.created_at,
        approved_by=c.approved_by,
        approved_at=c.approved_at,
    )


def _stage(a: NotificationApplication) -> NotificationApplicationSchema:
    return NotificationApplicationSchema(
        **{**asdict(a), "tests": [GridCodeTestSchema(**asdict(t)) for t in a.tests]}
    )


def _campaign(c: ComplianceCampaign) -> ComplianceCampaignSchema:
    return ComplianceCampaignSchema(
        campaign_id=c.campaign_id,
        programme_id=c.programme_id,
        stages={k.value: _stage(v) for k, v in c.stages.items()},
        created_at=c.created_at,
        cod_achieved=c.cod_achieved,
        cod_date=c.cod_date,
    )


# ── FAT ──────────────────────────────────────────────────────────


@router.post("/fat", response_model=FATCampaignSchema, status_code=201)
async def create_fat(
    request: CreateFATCampaignRequest, session: AsyncSession = Depends(get_session)
) -> FATCampaignSchema:
    """Open a FAT campaign from the routine-test template of the equipment class."""
    campaign = create_fat_campaign(request.equipment_tag, EquipmentClass(request.equipment_class))
    await ProgrammeRepository(session).save_fat_campaign(campaign)
    await session.commit()
    return _fat(campaign)


@router.get("/fat", response_model=list[FATCampaignSchema])
async def list_fat(session: AsyncSession = Depends(get_session)) -> list[FATCampaignSchema]:
    return [_fat(c) for c in await ProgrammeRepository(session).list_fat_campaigns()]


@router.post("/fat/{campaign_id}/tests/{test_id}/record", response_model=FATCampaignSchema)
async def record_fat(
    campaign_id: str,
    test_id: str,
    request: RecordTestResultRequest,
    session: AsyncSession = Depends(get_session),
) -> FATCampaignSchema:
    repo = ProgrammeRepository(session)
    campaign = await repo.get_fat_campaign(campaign_id)
    record_result(campaign, test_id, request.measured_value, request.recorded_by, request.notes)
    await repo.save_fat_campaign(campaign)
    await session.commit()
    return _fat(campaign)


@router.post("/fat/{campaign_id}/approve", response_model=FATCampaignSchema)
async def approve_fat(
    campaign_id: str, request: ApproveCampaignRequest, session: AsyncSession = Depends(get_session)
) -> FATCampaignSchema:
    repo = ProgrammeRepository(session)
    campaign = await repo.get_fat_campaign(campaign_id)
    approve_campaign(campaign, request.approved_by)
    await repo.save_fat_campaign(campaign)
    await session.commit()
    return _fat(campaign)


# ── SAT (per programme) ──────────────────────────────────────────


def _sat_of(programme: SwitchingProgramme) -> SATCampaign:
    if programme.sat_campaign is None:
        raise NotFoundError(f"No SAT campaign for programme {programme.programme_id}.")
    return programme.sat_campaign


@router.post("/programmes/{programme_id}/sat", response_model=SATCampaignSchema, status_code=201)
async def create_sat(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> SATCampaignSchema:
    """Open the SAT of circuit 1 — needs an approved FAT for every equipment class."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.sat_campaign is not None:
        raise StateTransitionError("This programme already has a SAT campaign.")
    sat = create_sat_campaign(programme_id, await repo.list_fat_campaigns())
    programme.sat_campaign = sat
    add_audit(programme, "SAT campaign opened", programme.pic_name, details=sat.fat_campaign_id)
    await repo.save_programme(programme)
    await session.commit()
    return _sat(sat)


@router.get("/programmes/{programme_id}/sat", response_model=SATCampaignSchema)
async def get_sat(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> SATCampaignSchema:
    return _sat(_sat_of(await ProgrammeRepository(session).get_programme(programme_id)))


@router.post(
    "/programmes/{programme_id}/sat/tests/{test_id}/record", response_model=SATCampaignSchema
)
async def record_sat(
    programme_id: str,
    test_id: str,
    request: RecordTestResultRequest,
    session: AsyncSession = Depends(get_session),
) -> SATCampaignSchema:
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    sat = _sat_of(programme)
    record_result(sat, test_id, request.measured_value, request.recorded_by, request.notes)
    await repo.save_programme(programme)
    await session.commit()
    return _sat(sat)


@router.post("/programmes/{programme_id}/sat/approve", response_model=SATCampaignSchema)
async def approve_sat(
    programme_id: str, request: ApproveCampaignRequest, session: AsyncSession = Depends(get_session)
) -> SATCampaignSchema:
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    sat = _sat_of(programme)
    approve_campaign(sat, request.approved_by)
    add_audit(programme, "SAT approved", request.approved_by)
    await repo.save_programme(programme)
    await session.commit()
    return _sat(sat)


# ── Grid-code compliance ─────────────────────────────────────────


def _compliance_of(programme: SwitchingProgramme) -> ComplianceCampaign:
    if programme.compliance_campaign is None:
        raise NotFoundError("No compliance campaign for this programme.")
    return programme.compliance_campaign


@router.post(
    "/programmes/{programme_id}/compliance",
    response_model=ComplianceCampaignSchema,
    status_code=201,
)
async def create_compliance(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> ComplianceCampaignSchema:
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.compliance_campaign is not None:
        raise StateTransitionError("This programme already has a compliance campaign.")
    programme.compliance_campaign = create_compliance_campaign(programme_id)
    await repo.save_programme(programme)
    await session.commit()
    return _campaign(programme.compliance_campaign)


@router.get("/programmes/{programme_id}/compliance", response_model=ComplianceCampaignSchema)
async def get_compliance(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> ComplianceCampaignSchema:
    programme = await ProgrammeRepository(session).get_programme(programme_id)
    return _campaign(_compliance_of(programme))


@router.post(
    "/programmes/{programme_id}/compliance/tests/{test_id}",
    response_model=ComplianceCampaignSchema,
)
async def record_compliance(
    programme_id: str,
    test_id: str,
    body: RecordComplianceResultRequest,
    session: AsyncSession = Depends(get_session),
) -> ComplianceCampaignSchema:
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    campaign = _compliance_of(programme)
    verdict = ComplianceVerdict(body.verdict)
    record_test_result(campaign, test_id, verdict, body.evidence, body.tested_by)
    await repo.save_programme(programme)
    await session.commit()
    return _campaign(campaign)


@router.post(
    "/programmes/{programme_id}/compliance/{stage}/{action}",
    response_model=ComplianceCampaignSchema,
)
async def stage_action(
    programme_id: str,
    stage: NotificationStage,
    action: Literal["submit", "approve"],
    session: AsyncSession = Depends(get_session),
) -> ComplianceCampaignSchema:
    """``submit`` a stage to PSE, or ``approve`` it (PSE issues it — simulated)."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    campaign = _compliance_of(programme)
    name = stage.value.upper()
    if action == "submit":
        submit_notification(campaign, stage, programme.status == ProgrammeStatus.COMPLETED)
        add_audit(programme, f"{name} submitted to PSE", programme.pic_name)
    else:
        approve_notification(campaign, stage)
        add_audit(programme, f"{name} issued by PSE", "PSE S.A.")
    await repo.save_programme(programme)
    await session.commit()
    return _campaign(campaign)
