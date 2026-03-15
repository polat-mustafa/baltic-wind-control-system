"""
Repository layer for P5 commissioning domain objects.

Handles serialisation/deserialisation between rich domain dataclasses
and SQLAlchemy models with JSONB columns. Follows the aggregate pattern:
each domain object is loaded and saved as a complete unit.

Usage in routers::

    async def some_endpoint(session: AsyncSession = Depends(get_session)):
        repo = ProgrammeRepository(session)
        programme = await repo.get_programme(programme_id)
        execute_step(programme, ...)
        await repo.save_programme(programme)
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.programme import (
    FATCampaignModel,
    ProtectionGradingModel,
    SwitchingProgrammeModel,
)
from app.services.p5.equipment_state import EquipmentState, SwitchingAction
from app.services.p5.fat import (
    FATCampaign,
    TestCampaignStatus,
    TestResult,
    TestSpecification,
    TestVerdict,
)
from app.services.p5.loto import IsolationPoint, LOTOSet, LOTOStatus
from app.services.p5.protection_relay import GradingResult, SelectivityVerdict
from app.services.p5.sat import SATCampaign
from app.services.p5.switching_programme import (
    AuditRecord,
    ProgrammeStatus,
    StepStatus,
    StepType,
    SwitchingProgramme,
    SwitchingStep,
)

# ── Serialisation Helpers ────────────────────────────────────────


def _dt_to_iso(dt: datetime | None) -> str | None:
    """Convert datetime to ISO string for JSON storage."""
    return dt.isoformat() if dt else None


def _iso_to_dt(s: str | None) -> datetime | None:
    """Convert ISO string back to datetime."""
    return datetime.fromisoformat(s) if s else None


def _serialise_step(step: SwitchingStep) -> dict[str, Any]:
    """Serialise a SwitchingStep to a JSON-safe dict."""
    return {
        "step_id": step.step_id,
        "step_number": step.step_number,
        "phase": step.phase,
        "step_type": step.step_type.value,
        "action": step.action,
        "equipment_id": step.equipment_id,
        "switching_action": step.switching_action.value if step.switching_action else None,
        "expected_state_before": (
            step.expected_state_before.value if step.expected_state_before else None
        ),
        "expected_state_after": (
            step.expected_state_after.value if step.expected_state_after else None
        ),
        "responsible": step.responsible,
        "pic_confirmation": step.pic_confirmation,
        "verification": step.verification,
        "notes": step.notes,
        "status": step.status.value,
        "executed_at": _dt_to_iso(step.executed_at),
        "executed_by": step.executed_by,
    }


def _deserialise_step(d: dict[str, Any]) -> SwitchingStep:
    """Deserialise a SwitchingStep from a JSON dict."""
    return SwitchingStep(
        step_id=d["step_id"],
        step_number=d["step_number"],
        phase=d["phase"],
        step_type=StepType(d["step_type"]),
        action=d["action"],
        equipment_id=d.get("equipment_id", ""),
        switching_action=(
            SwitchingAction(d["switching_action"]) if d.get("switching_action") else None
        ),
        expected_state_before=(
            EquipmentState(d["expected_state_before"]) if d.get("expected_state_before") else None
        ),
        expected_state_after=(
            EquipmentState(d["expected_state_after"]) if d.get("expected_state_after") else None
        ),
        responsible=d.get("responsible", "PiC"),
        pic_confirmation=d.get("pic_confirmation", True),
        verification=d.get("verification", ""),
        notes=d.get("notes", ""),
        status=StepStatus(d["status"]),
        executed_at=_iso_to_dt(d.get("executed_at")),
        executed_by=d.get("executed_by", ""),
    )


def _serialise_audit(record: AuditRecord) -> dict[str, Any]:
    """Serialise an AuditRecord to a JSON-safe dict."""
    return {
        "record_id": record.record_id,
        "timestamp": record.timestamp.isoformat(),
        "action": record.action,
        "performed_by": record.performed_by,
        "step_id": record.step_id,
        "details": record.details,
    }


def _deserialise_audit(d: dict[str, Any]) -> AuditRecord:
    """Deserialise an AuditRecord from a JSON dict."""
    return AuditRecord(
        record_id=d["record_id"],
        timestamp=datetime.fromisoformat(d["timestamp"]),
        action=d["action"],
        performed_by=d["performed_by"],
        step_id=d.get("step_id", ""),
        details=d.get("details", ""),
    )


def _serialise_loto_set(loto: LOTOSet) -> dict[str, Any]:
    """Serialise a LOTOSet to a JSON-safe dict."""
    return {
        "programme_id": loto.programme_id,
        "created_at": loto.created_at.isoformat(),
        "points": {
            pid: {
                "point_id": pt.point_id,
                "equipment_id": pt.equipment_id,
                "status": pt.status.value,
                "locked_by": pt.locked_by,
                "tag_number": pt.tag_number,
                "applied_at": _dt_to_iso(pt.applied_at),
                "removed_at": _dt_to_iso(pt.removed_at),
                "removed_by": pt.removed_by,
            }
            for pid, pt in loto.points.items()
        },
    }


def _deserialise_loto_set(d: dict[str, Any]) -> LOTOSet:
    """Deserialise a LOTOSet from a JSON dict."""
    loto = LOTOSet(
        programme_id=d["programme_id"],
        created_at=datetime.fromisoformat(d["created_at"]),
    )
    for pid, pt_data in d["points"].items():
        loto.points[pid] = IsolationPoint(
            point_id=pt_data["point_id"],
            equipment_id=pt_data["equipment_id"],
            status=LOTOStatus(pt_data["status"]),
            locked_by=pt_data.get("locked_by", ""),
            tag_number=pt_data.get("tag_number", ""),
            applied_at=_iso_to_dt(pt_data.get("applied_at")),
            removed_at=_iso_to_dt(pt_data.get("removed_at")),
            removed_by=pt_data.get("removed_by", ""),
        )
    return loto


def _serialise_test_spec(spec: TestSpecification) -> dict[str, Any]:
    """Serialise a TestSpecification to a JSON-safe dict."""
    return {
        "test_id": spec.test_id,
        "name": spec.name,
        "standard": spec.standard,
        "description": spec.description,
        "unit": spec.unit,
        "min_value": spec.min_value,
        "max_value": spec.max_value,
    }


def _deserialise_test_spec(d: dict[str, Any]) -> TestSpecification:
    """Deserialise a TestSpecification from a JSON dict."""
    return TestSpecification(
        test_id=d["test_id"],
        name=d["name"],
        standard=d["standard"],
        description=d["description"],
        unit=d["unit"],
        min_value=d["min_value"],
        max_value=d["max_value"],
    )


def _serialise_test_result(result: TestResult) -> dict[str, Any]:
    """Serialise a TestResult to a JSON-safe dict."""
    return {
        "test_id": result.test_id,
        "measured_value": result.measured_value,
        "verdict": result.verdict.value,
        "recorded_by": result.recorded_by,
        "recorded_at": result.recorded_at.isoformat(),
        "notes": result.notes,
    }


def _deserialise_test_result(d: dict[str, Any]) -> TestResult:
    """Deserialise a TestResult from a JSON dict."""
    return TestResult(
        test_id=d["test_id"],
        measured_value=d["measured_value"],
        verdict=TestVerdict(d["verdict"]),
        recorded_by=d.get("recorded_by", ""),
        recorded_at=datetime.fromisoformat(d["recorded_at"]),
        notes=d.get("notes", ""),
    )


def _serialise_sat_campaign(sat: SATCampaign) -> dict[str, Any]:
    """Serialise a SATCampaign to a JSON-safe dict."""
    return {
        "campaign_id": sat.campaign_id,
        "programme_id": sat.programme_id,
        "status": sat.status.value,
        "fat_campaign_id": sat.fat_campaign_id,
        "specs": {k: _serialise_test_spec(v) for k, v in sat.specs.items()},
        "results": {k: _serialise_test_result(v) for k, v in sat.results.items()},
        "created_at": sat.created_at.isoformat(),
        "approved_by": sat.approved_by,
        "approved_at": _dt_to_iso(sat.approved_at),
    }


def _deserialise_sat_campaign(d: dict[str, Any]) -> SATCampaign:
    """Deserialise a SATCampaign from a JSON dict."""
    return SATCampaign(
        campaign_id=d["campaign_id"],
        programme_id=d["programme_id"],
        status=TestCampaignStatus(d["status"]),
        fat_campaign_id=d.get("fat_campaign_id", ""),
        specs={k: _deserialise_test_spec(v) for k, v in d["specs"].items()},
        results={k: _deserialise_test_result(v) for k, v in d["results"].items()},
        created_at=datetime.fromisoformat(d["created_at"]),
        approved_by=d.get("approved_by", ""),
        approved_at=_iso_to_dt(d.get("approved_at")),
    )


# ── Repository ───────────────────────────────────────────────────


class ProgrammeRepository:
    """Async repository for P5 commissioning domain objects.

    Encapsulates all DB access for switching programmes, FAT campaigns,
    and protection grading results. Each method operates within the
    caller's session/transaction scope.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Switching Programmes ─────────────────────────────────────

    async def save_programme(self, programme: SwitchingProgramme) -> None:
        """Upsert a switching programme (insert or update)."""
        now = datetime.now(UTC)
        existing = await self.session.get(SwitchingProgrammeModel, programme.programme_id)

        if existing:
            existing.title = programme.title
            existing.pic_name = programme.pic_name
            existing.status = programme.status.value
            existing.current_step_index = programme.current_step_index
            existing.fat_campaign_id = programme.fat_campaign_id
            existing.steps = [_serialise_step(s) for s in programme.steps]
            existing.system_state = {k: v.value for k, v in programme.system_state.items()}
            existing.loto_set = (
                _serialise_loto_set(programme.loto_set) if programme.loto_set else None
            )
            existing.audit_trail = [_serialise_audit(r) for r in programme.audit_trail]
            existing.sat_campaign = (
                _serialise_sat_campaign(programme.sat_campaign) if programme.sat_campaign else None
            )
            existing.updated_at = now
        else:
            model = SwitchingProgrammeModel(
                programme_id=programme.programme_id,
                title=programme.title,
                pic_name=programme.pic_name,
                status=programme.status.value,
                current_step_index=programme.current_step_index,
                fat_campaign_id=programme.fat_campaign_id,
                steps=[_serialise_step(s) for s in programme.steps],
                system_state={k: v.value for k, v in programme.system_state.items()},
                loto_set=(_serialise_loto_set(programme.loto_set) if programme.loto_set else None),
                audit_trail=[_serialise_audit(r) for r in programme.audit_trail],
                sat_campaign=(
                    _serialise_sat_campaign(programme.sat_campaign)
                    if programme.sat_campaign
                    else None
                ),
                created_at=programme.created_at,
                updated_at=now,
            )
            self.session.add(model)

        await self.session.flush()

    async def get_programme(self, programme_id: str) -> SwitchingProgramme:
        """Load a switching programme by ID. Raises NotFoundError if missing."""
        model = await self.session.get(SwitchingProgrammeModel, programme_id)
        if model is None:
            raise NotFoundError(f"Programme '{programme_id}' not found.")
        return self._to_programme(model)

    async def list_programmes(self) -> list[SwitchingProgramme]:
        """Load all switching programmes."""
        result = await self.session.execute(
            select(SwitchingProgrammeModel).order_by(SwitchingProgrammeModel.created_at.desc())
        )
        return [self._to_programme(m) for m in result.scalars().all()]

    async def delete_programme(self, programme_id: str) -> None:
        """Delete a switching programme. Raises NotFoundError if missing."""
        model = await self.session.get(SwitchingProgrammeModel, programme_id)
        if model is None:
            raise NotFoundError(f"Programme '{programme_id}' not found.")
        await self.session.delete(model)
        await self.session.flush()

    def _to_programme(self, model: SwitchingProgrammeModel) -> SwitchingProgramme:
        """Reconstruct a SwitchingProgramme domain object from its DB model."""
        return SwitchingProgramme(
            programme_id=model.programme_id,
            title=model.title,
            pic_name=model.pic_name,
            status=ProgrammeStatus(model.status),
            steps=[_deserialise_step(s) for s in model.steps],
            current_step_index=model.current_step_index,
            system_state={k: EquipmentState(v) for k, v in model.system_state.items()},
            loto_set=_deserialise_loto_set(model.loto_set) if model.loto_set else None,
            audit_trail=[_deserialise_audit(r) for r in model.audit_trail],
            created_at=model.created_at,
            sat_campaign=(
                _deserialise_sat_campaign(model.sat_campaign) if model.sat_campaign else None
            ),
            fat_campaign_id=model.fat_campaign_id,
        )

    # ── FAT Campaigns ────────────────────────────────────────────

    async def save_fat_campaign(self, campaign: FATCampaign) -> None:
        """Upsert a FAT campaign."""
        now = datetime.now(UTC)
        existing = await self.session.get(FATCampaignModel, campaign.campaign_id)

        if existing:
            existing.equipment_tag = campaign.equipment_tag
            existing.status = campaign.status.value
            existing.specs = {k: _serialise_test_spec(v) for k, v in campaign.specs.items()}
            existing.results = {k: _serialise_test_result(v) for k, v in campaign.results.items()}
            existing.approved_by = campaign.approved_by
            existing.approved_at = campaign.approved_at
            existing.updated_at = now
        else:
            model = FATCampaignModel(
                campaign_id=campaign.campaign_id,
                equipment_tag=campaign.equipment_tag,
                status=campaign.status.value,
                specs={k: _serialise_test_spec(v) for k, v in campaign.specs.items()},
                results={k: _serialise_test_result(v) for k, v in campaign.results.items()},
                approved_by=campaign.approved_by,
                approved_at=campaign.approved_at,
                created_at=campaign.created_at,
                updated_at=now,
            )
            self.session.add(model)

        await self.session.flush()

    async def get_fat_campaign(self, campaign_id: str) -> FATCampaign:
        """Load a FAT campaign by ID. Raises NotFoundError if missing."""
        model = await self.session.get(FATCampaignModel, campaign_id)
        if model is None:
            raise NotFoundError(f"FAT campaign '{campaign_id}' not found.")
        return self._to_fat_campaign(model)

    async def list_fat_campaigns(self) -> list[FATCampaign]:
        """Load all FAT campaigns."""
        result = await self.session.execute(
            select(FATCampaignModel).order_by(FATCampaignModel.created_at.desc())
        )
        return [self._to_fat_campaign(m) for m in result.scalars().all()]

    def _to_fat_campaign(self, model: FATCampaignModel) -> FATCampaign:
        """Reconstruct a FATCampaign domain object from its DB model."""
        return FATCampaign(
            campaign_id=model.campaign_id,
            equipment_tag=model.equipment_tag,
            status=TestCampaignStatus(model.status),
            specs={k: _deserialise_test_spec(v) for k, v in model.specs.items()},
            results={k: _deserialise_test_result(v) for k, v in model.results.items()},
            created_at=model.created_at,
            approved_by=model.approved_by,
            approved_at=model.approved_at,
        )

    # ── Protection Grading ───────────────────────────────────────

    async def save_protection_results(self, results: list[GradingResult]) -> None:
        """Save a grading run as a new immutable record."""
        now = datetime.now(UTC)
        model = ProtectionGradingModel(
            results=[asdict(r) for r in results],
            created_at=now,
        )
        self.session.add(model)
        await self.session.flush()

    async def get_latest_protection_results(self) -> list[GradingResult]:
        """Load the most recent grading run. Returns empty list if none."""
        result = await self.session.execute(
            select(ProtectionGradingModel)
            .order_by(ProtectionGradingModel.created_at.desc())
            .limit(1)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return []
        return [
            GradingResult(
                pair_id=r["pair_id"],
                downstream_id=r["downstream_id"],
                upstream_id=r["upstream_id"],
                downstream_delay_s=r["downstream_delay_s"],
                upstream_delay_s=r["upstream_delay_s"],
                actual_margin_ms=r["actual_margin_ms"],
                required_margin_ms=r["required_margin_ms"],
                verdict=SelectivityVerdict(r["verdict"]),
            )
            for r in model.results
        ]
