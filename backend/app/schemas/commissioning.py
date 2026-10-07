"""Pydantic schemas for the P5 commissioning API (/api/v1/commissioning)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── Plant ────────────────────────────────────────────────────────


class EquipmentStateSchema(BaseModel):
    equipment_id: str
    equipment_type: str = Field(
        description="circuit_breaker, disconnector, earth_switch, wtg_group"
    )
    voltage_kv: float
    location: str
    state: str = Field(description="open | closed (earth switch closed = earthed)")
    zones: list[str] = Field(description="Zones the device joins (one for an earth switch)")
    locked: bool = Field(description="Held by an isolation lock")


class BusReadingSchema(BaseModel):
    name: str
    zone: str
    vn_kv: float
    vm_pu: float
    kv: float


class NetworkSnapshotSchema(BaseModel):
    """Load flow of the live part of circuit 1 (generator convention: Q > 0 generating)."""

    zones: dict[str, str] = Field(description="Zone → live | earthed | dead")
    buses: list[BusReadingSchema]
    poc_p_mw: float = Field(description="Active power into PSE 400 kV [MW]")
    poc_q_mvar: float = Field(description="Reactive power into PSE 400 kV [Mvar]")
    generation_mw: float
    cable_i_send_a: float | None = None
    cable_i_recv_a: float | None = None
    cable_loading_pct: float | None = None
    reactor_q_mvar: float | None = None
    statcom_q_mvar: float | None = None
    tx1_i_hv_a: float | None = None
    tx1_loading_pct: float | None = None


# ── Programme ────────────────────────────────────────────────────


class CreateProgrammeRequest(BaseModel):
    pic_name: str = Field(min_length=1, max_length=100, description="Person in Control")


class StepSchema(BaseModel):
    step_id: str = Field(description="phase.sequence, e.g. 2.08")
    step_number: int
    phase: int
    step_type: str = Field(
        description="check | gate | isolation | switching | verification | hold_point | declaration"
    )
    action: str
    equipment_id: str
    responsible: str
    pic_confirmation: bool
    verification: str
    notes: str
    status: str
    executed_at: datetime | None = None
    executed_by: str = ""
    reading: str = Field(default="", description="What was found when the step was executed")


class ProgrammeSummarySchema(BaseModel):
    programme_id: str
    title: str
    pic_name: str
    status: str
    total_steps: int
    completed_steps: int
    current_step_index: int
    created_at: datetime


class AuditRecordSchema(BaseModel):
    record_id: str
    timestamp: datetime
    action: str
    performed_by: str
    step_id: str = ""
    details: str = ""


class EmergencyEventSchema(BaseModel):
    event_id: str
    emergency_type: str
    severity: str
    effect: str = Field(description="trip | suspend")
    triggered_by: str
    triggered_at: str
    breakers_opened: list[str]
    programme_status: str


class ProgrammeFarmSchema(BaseModel):
    """The farm the programme energises (p2.network_model.FarmSpec)."""

    name: str
    string_layout: list[int] = Field(description="Turbines per string, string 1 first")
    section_a_strings: int = Field(description="Strings 1…n on 66 kV section A (circuit 1)")
    export_length_km: float
    oss_trafo_mva: float = Field(description="Rating of TX-OSS-01 [MVA]")
    statcom_mvar: float
    reactor_unit_mvar: float | None = Field(description="Reactor 1 [Mvar]; null: no reactors")
    output_limit_mw: float = Field(description="Output with circuit 1 only [MW]")
    onshore_tap: int = Field(description="Onshore OLTC pre-set (0 = neutral)")
    reactor_energisation: bool = Field(description="Cable 1 energised with reactor 1")


class ProgrammeDetailSchema(ProgrammeSummarySchema):
    farm: ProgrammeFarmSchema
    phases: dict[int, str]
    steps: list[StepSchema]
    equipment_states: list[EquipmentStateSchema]
    network: NetworkSnapshotSchema
    audit_trail: list[AuditRecordSchema]
    emergency_log: list[EmergencyEventSchema]


class ExecuteStepRequest(BaseModel):
    executed_by: str = Field(min_length=1, max_length=100)
    pic_confirmed: bool = Field(default=True, description="PiC has confirmed the step")


class ExecuteStepResponse(BaseModel):
    success: bool
    step_id: str
    status: str = Field(description="Step status, or 'hold_point'")
    message: str
    programme_status: str
    reading: str = ""


class PiCDecisionRequest(BaseModel):
    pic_name: str = Field(min_length=1, max_length=100)
    decision: str = Field(pattern="^(go|nogo)$")
    reason: str = Field(default="", max_length=500)


class PiCDecisionResponse(BaseModel):
    decision: str
    programme_status: str
    message: str


class EmergencyStopRequest(BaseModel):
    initiated_by: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=500)


class EmergencyStopResponse(BaseModel):
    programme_status: str
    breakers_opened: list[str]
    message: str


# ── Isolation locks ──────────────────────────────────────────────


class LOTOPointSchema(BaseModel):
    point_id: str
    equipment_id: str
    secured_state: str = Field(description="Position the lock holds: open (DS) / closed (ES)")
    status: str = Field(description="applied | removed")
    tag_number: str
    locked_by: str = ""
    applied_at: datetime | None = None
    removed_by: str = ""
    removed_at: datetime | None = None


class LOTOSetSchema(BaseModel):
    programme_id: str
    points: list[LOTOPointSchema]
    applied_count: int


class LOTOActionRequest(BaseModel):
    performed_by: str = Field(min_length=1, max_length=100)


# ── FAT / SAT ────────────────────────────────────────────────────


class TestSpecificationSchema(BaseModel):
    test_id: str
    name: str
    standard: str
    description: str
    unit: str = Field(description="Measurement unit, or 'pass/fail' (1 = pass, 0 = fail)")
    min_value: float | None = Field(description="Lower acceptance bound (null = none)")
    max_value: float | None = Field(description="Upper acceptance bound (null = none)")
    typical_value: float


class TestResultSchema(BaseModel):
    test_id: str
    measured_value: float
    verdict: str = Field(description="pass | fail")
    recorded_by: str
    recorded_at: datetime
    notes: str = ""


class CreateFATCampaignRequest(BaseModel):
    equipment_tag: str = Field(min_length=1, max_length=100, examples=["TX-OSS-01"])
    equipment_class: str = Field(pattern="^(power_transformer|gis_220kv|protection_panel)$")


class RecordTestResultRequest(BaseModel):
    measured_value: float
    recorded_by: str = Field(min_length=1, max_length=100)
    notes: str = Field(default="", max_length=500)


class ApproveCampaignRequest(BaseModel):
    approved_by: str = Field(min_length=1, max_length=100)


class FATCampaignSchema(BaseModel):
    campaign_id: str
    equipment_tag: str
    equipment_class: str
    status: str
    specs: list[TestSpecificationSchema]
    results: list[TestResultSchema]
    all_passed: bool
    created_at: datetime
    approved_by: str = ""
    approved_at: datetime | None = None


class SATCampaignSchema(BaseModel):
    campaign_id: str
    programme_id: str
    status: str
    fat_campaign_id: str = Field(default="", description="Approved FAT campaigns relied upon")
    specs: list[TestSpecificationSchema]
    results: list[TestResultSchema]
    all_passed: bool
    created_at: datetime
    approved_by: str = ""
    approved_at: datetime | None = None


# ── Grid-code compliance ─────────────────────────────────────────


class GridCodeTestSchema(BaseModel):
    test_id: str
    stage: str
    kind: str = Field(description="document | test | simulation")
    name: str
    description: str
    standard: str
    acceptance_criteria: str
    verdict: str = Field(description="pending | compliant | non_compliant")
    evidence: str = ""
    tested_by: str = ""
    tested_at: str | None = None


class NotificationApplicationSchema(BaseModel):
    stage: str
    status: str = Field(description="open | submitted | issued")
    tests: list[GridCodeTestSchema]
    submitted_to: str
    submitted_at: str | None = None
    approved_at: str | None = None
    valid_until: str | None = Field(default=None, description="ION expiry (NC RfG Art. 35(4))")


class ComplianceCampaignSchema(BaseModel):
    campaign_id: str
    programme_id: str
    stages: dict[str, NotificationApplicationSchema]
    created_at: str
    cod_achieved: bool
    cod_date: str | None = None


class RecordComplianceResultRequest(BaseModel):
    verdict: str = Field(pattern="^(compliant|non_compliant|pending)$")
    evidence: str = Field(default="", max_length=500)
    tested_by: str = Field(min_length=1, max_length=100)


# ── Emergencies ──────────────────────────────────────────────────


class EmergencyProcedureSchema(BaseModel):
    emergency_type: str
    title: str
    severity: str
    effect: str = Field(description="trip (all breakers open, programme aborted) | suspend")
    immediate_actions: list[str]
    responsible: str
    reference_document: str
    communication_protocol: list[str]


class TriggerEmergencyRequest(BaseModel):
    emergency_type: str
    triggered_by: str = Field(min_length=1, max_length=100)
