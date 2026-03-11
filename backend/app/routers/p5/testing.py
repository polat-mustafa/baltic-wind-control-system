"""P5 sub-router: FAT, SAT, and grid code compliance testing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, StateTransitionError
from app.core.exceptions import ValidationError as DomainValidationError
from app.db import get_session
from app.schemas.commissioning import (
    ApproveCampaignRequest,
    ComplianceCampaignSchema,
    CreateFATCampaignRequest,
    CreateSATCampaignRequest,
    FATCampaignSchema,
    GridCodeTestSchema,
    NotificationApplicationSchema,
    RecordComplianceResultRequest,
    RecordTestResultRequest,
    SATCampaignSchema,
    StageSummarySchema,
    SubmitNotificationRequest,
    TestResultSchema,
    TestSpecificationSchema,
)
from app.services.p5.fat import (
    FATCampaign,
    all_fat_passed,
    approve_fat_campaign,
    create_fat_campaign,
    record_fat_result,
)
from app.services.p5.grid_code_testing import (
    ComplianceCampaign,
    ComplianceVerdict,
    NotificationStage,
    approve_notification,
    create_compliance_campaign,
    get_compliance_campaign,
    get_stage_summary,
    record_test_result,
    submit_notification,
)
from app.services.p5.programme_repository import ProgrammeRepository
from app.services.p5.sat import (
    SATCampaign,
    all_sat_passed,
    approve_sat_campaign,
    create_sat_campaign,
    record_sat_result,
)

router = APIRouter()


# ── FAT Helper ──────────────────────────────────────────────────


def _build_fat_schema(campaign: FATCampaign) -> FATCampaignSchema:
    """Build a FAT campaign schema from domain object."""
    specs = [
        TestSpecificationSchema(
            test_id=s.test_id,
            name=s.name,
            standard=s.standard,
            description=s.description,
            unit=s.unit,
            min_value=s.min_value,
            max_value=s.max_value,
        )
        for s in campaign.specs.values()
    ]
    results = [
        TestResultSchema(
            test_id=r.test_id,
            measured_value=r.measured_value,
            verdict=r.verdict.value,
            recorded_by=r.recorded_by,
            recorded_at=r.recorded_at,
            notes=r.notes,
        )
        for r in campaign.results.values()
    ]
    return FATCampaignSchema(
        campaign_id=campaign.campaign_id,
        equipment_tag=campaign.equipment_tag,
        status=campaign.status.value,
        specs=specs,
        results=results,
        all_passed=all_fat_passed(campaign),
        created_at=campaign.created_at,
        approved_by=campaign.approved_by,
        approved_at=campaign.approved_at,
    )


# ── FAT Endpoints ──────────────────────────────────────────────


@router.post("/fat", response_model=FATCampaignSchema, status_code=201)
async def create_fat_campaign_endpoint(
    request: CreateFATCampaignRequest,
    session: AsyncSession = Depends(get_session),
) -> FATCampaignSchema:
    """Create a new FAT campaign with 8 IEC-standard test specs."""
    repo = ProgrammeRepository(session)
    campaign = create_fat_campaign(request.equipment_tag)
    await repo.save_fat_campaign(campaign)
    await session.commit()
    return _build_fat_schema(campaign)


@router.get("/fat", response_model=list[FATCampaignSchema])
async def list_fat_campaigns(
    session: AsyncSession = Depends(get_session),
) -> list[FATCampaignSchema]:
    """List all FAT campaigns."""
    repo = ProgrammeRepository(session)
    campaigns = await repo.list_fat_campaigns()
    return [_build_fat_schema(c) for c in campaigns]


@router.get("/fat/{campaign_id}", response_model=FATCampaignSchema)
async def get_fat_campaign(
    campaign_id: str,
    session: AsyncSession = Depends(get_session),
) -> FATCampaignSchema:
    """Get FAT campaign detail."""
    repo = ProgrammeRepository(session)
    campaign = await repo.get_fat_campaign(campaign_id)
    return _build_fat_schema(campaign)


@router.post(
    "/fat/{campaign_id}/tests/{test_id}/record",
    response_model=TestResultSchema,
)
async def record_fat_result_endpoint(
    campaign_id: str,
    test_id: str,
    request: RecordTestResultRequest,
    session: AsyncSession = Depends(get_session),
) -> TestResultSchema:
    """Record a FAT test result. Auto-evaluates pass/fail against spec."""
    repo = ProgrammeRepository(session)
    campaign = await repo.get_fat_campaign(campaign_id)
    result = record_fat_result(
        campaign, test_id, request.measured_value, request.recorded_by, request.notes
    )
    await repo.save_fat_campaign(campaign)
    await session.commit()

    return TestResultSchema(
        test_id=result.test_id,
        measured_value=result.measured_value,
        verdict=result.verdict.value,
        recorded_by=result.recorded_by,
        recorded_at=result.recorded_at,
        notes=result.notes,
    )


@router.post("/fat/{campaign_id}/approve", response_model=FATCampaignSchema)
async def approve_fat_campaign_endpoint(
    campaign_id: str,
    request: ApproveCampaignRequest,
    session: AsyncSession = Depends(get_session),
) -> FATCampaignSchema:
    """Approve a completed FAT campaign (all tests must pass)."""
    repo = ProgrammeRepository(session)
    campaign = await repo.get_fat_campaign(campaign_id)
    approve_fat_campaign(campaign, request.approved_by)
    await repo.save_fat_campaign(campaign)
    await session.commit()

    return _build_fat_schema(campaign)


# ── SAT Helper ──────────────────────────────────────────────────


def _build_sat_schema(campaign: SATCampaign) -> SATCampaignSchema:
    """Build a SAT campaign schema from domain object."""
    specs = [
        TestSpecificationSchema(
            test_id=s.test_id,
            name=s.name,
            standard=s.standard,
            description=s.description,
            unit=s.unit,
            min_value=s.min_value,
            max_value=s.max_value,
        )
        for s in campaign.specs.values()
    ]
    results = [
        TestResultSchema(
            test_id=r.test_id,
            measured_value=r.measured_value,
            verdict=r.verdict.value,
            recorded_by=r.recorded_by,
            recorded_at=r.recorded_at,
            notes=r.notes,
        )
        for r in campaign.results.values()
    ]
    return SATCampaignSchema(
        campaign_id=campaign.campaign_id,
        programme_id=campaign.programme_id,
        status=campaign.status.value,
        fat_campaign_id=campaign.fat_campaign_id,
        specs=specs,
        results=results,
        all_passed=all_sat_passed(campaign),
        created_at=campaign.created_at,
        approved_by=campaign.approved_by,
        approved_at=campaign.approved_at,
    )


# ── SAT Endpoints (nested under programme) ─────────────────────


@router.post(
    "/programmes/{programme_id}/sat",
    response_model=SATCampaignSchema,
    status_code=201,
)
async def create_sat_campaign_endpoint(
    programme_id: str,
    request: CreateSATCampaignRequest,
    session: AsyncSession = Depends(get_session),
) -> SATCampaignSchema:
    """Create a SAT campaign for a switching programme.

    If require_fat=true, the programme must have a linked FAT campaign
    that is approved.
    """
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)

    if programme.sat_campaign is not None:
        raise StateTransitionError(f"Programme '{programme_id}' already has a SAT campaign.")

    fat_campaign = None
    if request.require_fat:
        if programme.fat_campaign_id is None:
            raise DomainValidationError(
                "require_fat=true but programme has no linked FAT campaign."
            )
        fat_campaign = await repo.get_fat_campaign(programme.fat_campaign_id)

    sat = create_sat_campaign(programme_id, fat_campaign)
    programme.sat_campaign = sat
    await repo.save_programme(programme)
    await session.commit()
    return _build_sat_schema(sat)


@router.get(
    "/programmes/{programme_id}/sat",
    response_model=SATCampaignSchema,
)
async def get_sat_campaign_endpoint(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> SATCampaignSchema:
    """Get SAT campaign status for a programme."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.sat_campaign is None:
        raise NotFoundError(f"No SAT campaign for programme '{programme_id}'.")
    return _build_sat_schema(programme.sat_campaign)


@router.post(
    "/programmes/{programme_id}/sat/tests/{test_id}/record",
    response_model=TestResultSchema,
)
async def record_sat_result_endpoint(
    programme_id: str,
    test_id: str,
    request: RecordTestResultRequest,
    session: AsyncSession = Depends(get_session),
) -> TestResultSchema:
    """Record a SAT test result. Auto-evaluates pass/fail against spec."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.sat_campaign is None:
        raise NotFoundError(f"No SAT campaign for programme '{programme_id}'.")

    result = record_sat_result(
        programme.sat_campaign,
        test_id,
        request.measured_value,
        request.recorded_by,
        request.notes,
    )

    await repo.save_programme(programme)
    await session.commit()
    return TestResultSchema(
        test_id=result.test_id,
        measured_value=result.measured_value,
        verdict=result.verdict.value,
        recorded_by=result.recorded_by,
        recorded_at=result.recorded_at,
        notes=result.notes,
    )


@router.post(
    "/programmes/{programme_id}/sat/approve",
    response_model=SATCampaignSchema,
)
async def approve_sat_campaign_endpoint(
    programme_id: str,
    request: ApproveCampaignRequest,
    session: AsyncSession = Depends(get_session),
) -> SATCampaignSchema:
    """Approve a completed SAT campaign (all tests must pass)."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if programme.sat_campaign is None:
        raise NotFoundError(f"No SAT campaign for programme '{programme_id}'.")

    approve_sat_campaign(programme.sat_campaign, request.approved_by)
    await repo.save_programme(programme)
    await session.commit()
    return _build_sat_schema(programme.sat_campaign)


# ── Grid Code Compliance ────────────────────────────────────────


def _build_campaign_schema(campaign: ComplianceCampaign) -> ComplianceCampaignSchema:
    """Convert a ComplianceCampaign dataclass to its Pydantic schema."""
    stages = {}
    for stage_key, stage_app in campaign.stages.items():
        stages[stage_key.value] = NotificationApplicationSchema(
            stage=stage_app.stage.value,
            status=stage_app.status.value,
            tests=[
                GridCodeTestSchema(
                    test_id=t.test_id,
                    stage=t.stage.value,
                    name=t.name,
                    description=t.description,
                    standard=t.standard,
                    acceptance_criteria=t.acceptance_criteria,
                    verdict=t.verdict.value,
                    evidence=t.evidence,
                    tested_by=t.tested_by,
                    tested_at=t.tested_at,
                )
                for t in stage_app.tests
            ],
            submitted_to=stage_app.submitted_to,
            submitted_at=stage_app.submitted_at,
            approved_at=stage_app.approved_at,
        )
    return ComplianceCampaignSchema(
        campaign_id=campaign.campaign_id,
        programme_id=campaign.programme_id,
        stages=stages,
        created_at=campaign.created_at,
        cod_achieved=campaign.cod_achieved,
        cod_date=campaign.cod_date,
    )


@router.post(
    "/programmes/{programme_id}/compliance",
    response_model=ComplianceCampaignSchema,
    summary="Create a grid code compliance campaign",
)
async def create_programme_compliance(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> ComplianceCampaignSchema:
    """Create a new EON/ION/FON compliance campaign for a programme."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    existing = get_compliance_campaign(programme_id)
    if existing is not None:
        raise StateTransitionError("Compliance campaign already exists for this programme")
    campaign = create_compliance_campaign(programme_id)
    return _build_campaign_schema(campaign)


@router.get(
    "/programmes/{programme_id}/compliance",
    response_model=ComplianceCampaignSchema,
    summary="Get compliance campaign with all stages",
)
async def get_programme_compliance(
    programme_id: str,
    session: AsyncSession = Depends(get_session),
) -> ComplianceCampaignSchema:
    """Return the compliance campaign for a programme."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    campaign = get_compliance_campaign(programme_id)
    if campaign is None:
        raise NotFoundError("No compliance campaign found")
    return _build_campaign_schema(campaign)


@router.post(
    "/programmes/{programme_id}/compliance/tests/{test_id}",
    response_model=GridCodeTestSchema,
    summary="Record a compliance test result",
)
async def record_compliance_test(
    programme_id: str,
    test_id: str,
    body: RecordComplianceResultRequest,
    session: AsyncSession = Depends(get_session),
) -> GridCodeTestSchema:
    """Record the result of a grid code compliance test."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    try:
        verdict = ComplianceVerdict(body.verdict)
    except ValueError:
        raise DomainValidationError(f"Invalid verdict: '{body.verdict}'") from None
    test = record_test_result(programme_id, test_id, verdict, body.evidence, body.tested_by)
    return GridCodeTestSchema(
        test_id=test.test_id,
        stage=test.stage.value,
        name=test.name,
        description=test.description,
        standard=test.standard,
        acceptance_criteria=test.acceptance_criteria,
        verdict=test.verdict.value,
        evidence=test.evidence,
        tested_by=test.tested_by,
        tested_at=test.tested_at,
    )


@router.post(
    "/programmes/{programme_id}/compliance/{stage}/submit",
    response_model=NotificationApplicationSchema,
    summary="Submit a notification stage to PSE",
)
async def submit_compliance_notification(
    programme_id: str,
    stage: str,
    body: SubmitNotificationRequest,
    session: AsyncSession = Depends(get_session),
) -> NotificationApplicationSchema:
    """Submit a notification stage (EON/ION/FON) to PSE for approval."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise DomainValidationError(f"Invalid stage: {stage}") from None
    stage_app = submit_notification(programme_id, ns, body.submitted_by)
    return NotificationApplicationSchema(
        stage=stage_app.stage.value,
        status=stage_app.status.value,
        tests=[
            GridCodeTestSchema(
                test_id=t.test_id,
                stage=t.stage.value,
                name=t.name,
                description=t.description,
                standard=t.standard,
                acceptance_criteria=t.acceptance_criteria,
                verdict=t.verdict.value,
                evidence=t.evidence,
                tested_by=t.tested_by,
                tested_at=t.tested_at,
            )
            for t in stage_app.tests
        ],
        submitted_to=stage_app.submitted_to,
        submitted_at=stage_app.submitted_at,
        approved_at=stage_app.approved_at,
    )


@router.post(
    "/programmes/{programme_id}/compliance/{stage}/approve",
    response_model=NotificationApplicationSchema,
    summary="Approve a notification stage",
)
async def approve_compliance_notification(
    programme_id: str,
    stage: str,
    session: AsyncSession = Depends(get_session),
) -> NotificationApplicationSchema:
    """Approve a notification stage (simulates PSE approval)."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise DomainValidationError(f"Invalid stage: {stage}") from None
    stage_app = approve_notification(programme_id, ns)
    return NotificationApplicationSchema(
        stage=stage_app.stage.value,
        status=stage_app.status.value,
        tests=[
            GridCodeTestSchema(
                test_id=t.test_id,
                stage=t.stage.value,
                name=t.name,
                description=t.description,
                standard=t.standard,
                acceptance_criteria=t.acceptance_criteria,
                verdict=t.verdict.value,
                evidence=t.evidence,
                tested_by=t.tested_by,
                tested_at=t.tested_at,
            )
            for t in stage_app.tests
        ],
        submitted_to=stage_app.submitted_to,
        submitted_at=stage_app.submitted_at,
        approved_at=stage_app.approved_at,
    )


@router.get(
    "/programmes/{programme_id}/compliance/{stage}/summary",
    response_model=StageSummarySchema,
    summary="Get stage compliance summary",
)
async def get_compliance_stage_summary(
    programme_id: str,
    stage: str,
    session: AsyncSession = Depends(get_session),
) -> StageSummarySchema:
    """Return a summary of a stage's compliance status with test counts."""
    repo = ProgrammeRepository(session)
    await repo.get_programme(programme_id)
    try:
        ns = NotificationStage(stage)
    except ValueError:
        raise DomainValidationError(f"Invalid stage: {stage}") from None
    summary = get_stage_summary(programme_id, ns)
    return StageSummarySchema(**summary)
