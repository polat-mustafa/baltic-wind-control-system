"""
Pydantic schemas for P5 HV Commissioning Simulation.

Request and response models for the equipment state machine,
switching programme execution, LOTO tracking, and PiC decisions.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

# ── Equipment Schemas ────────────────────────────────────────────


class EquipmentStateSchema(BaseModel):
    """Current state of a single piece of equipment."""

    equipment_id: str = Field(description="Equipment identifier")
    equipment_type: str = Field(description="Equipment type (circuit_breaker, etc.)")
    voltage_kv: float = Field(description="Rated voltage in kV")
    location: str = Field(description="Physical location")
    state: str = Field(description="Current state (open, closed, earthed, etc.)")


class InterlockViolationSchema(BaseModel):
    """A safety interlock violation."""

    interlock_id: str = Field(description="Interlock code (e.g. ILK-001)")
    description: str = Field(description="Human-readable explanation")
    blocking_equipment: str = Field(description="Equipment causing the block")
    blocking_state: str = Field(description="State of the blocking equipment")


# ── Programme Schemas ────────────────────────────────────────────


class CreateProgrammeRequest(BaseModel):
    """Request to create a new switching programme."""

    pic_name: str = Field(
        min_length=1,
        description="Person in Control (PiC) name",
    )


class StepSchema(BaseModel):
    """A single step in the switching programme."""

    step_id: str = Field(description="Step identifier (e.g. S-001)")
    step_number: int = Field(description="Sequential position")
    phase: int = Field(description="Programme phase (1-3)")
    step_type: str = Field(description="Step type (check, switching, etc.)")
    action: str = Field(description="Action description")
    equipment_id: str = Field(description="Target equipment (empty if N/A)")
    responsible: str = Field(description="Who performs (PiC, Local, SCADA)")
    pic_confirmation: bool = Field(description="PiC confirmation required")
    verification: str = Field(description="How to verify success")
    notes: str = Field(description="Safety notes")
    status: str = Field(description="Execution status")
    executed_at: datetime | None = Field(default=None, description="Execution timestamp")
    executed_by: str = Field(default="", description="Who executed")


class ProgrammeSummarySchema(BaseModel):
    """Summary of a switching programme for list responses."""

    programme_id: str = Field(description="Programme identifier")
    title: str = Field(description="Programme title")
    pic_name: str = Field(description="Person in Control")
    status: str = Field(description="Programme lifecycle state")
    total_steps: int = Field(description="Total number of steps")
    completed_steps: int = Field(description="Steps completed so far")
    current_step_index: int = Field(description="Next step index (0-based)")
    created_at: datetime = Field(description="Creation timestamp")


class ProgrammeDetailSchema(BaseModel):
    """Detailed programme view with steps and system state."""

    programme_id: str = Field(description="Programme identifier")
    title: str = Field(description="Programme title")
    pic_name: str = Field(description="Person in Control")
    status: str = Field(description="Programme lifecycle state")
    steps: list[StepSchema] = Field(description="All programme steps")
    current_step_index: int = Field(description="Next step index (0-based)")
    equipment_states: list[EquipmentStateSchema] = Field(
        description="Current equipment states",
    )
    created_at: datetime = Field(description="Creation timestamp")


# ── Execution Schemas ────────────────────────────────────────────


class ExecuteStepRequest(BaseModel):
    """Request to execute a step."""

    executed_by: str = Field(
        min_length=1,
        description="Person executing the step",
    )
    pic_confirmed: bool = Field(
        default=True,
        description="PiC has verbally confirmed this step",
    )


class ExecuteStepResponse(BaseModel):
    """Response after executing a step."""

    success: bool = Field(description="True if step completed")
    step_id: str = Field(description="Step that was executed")
    status: str = Field(description="Step status after execution")
    message: str = Field(description="Human-readable result")
    programme_status: str = Field(description="Programme status after step")


class PiCDecisionRequest(BaseModel):
    """Request for PiC GO/NO-GO decision at a hold point."""

    pic_name: str = Field(
        min_length=1,
        description="PiC making the decision",
    )
    decision: str = Field(
        description="Decision: 'go' or 'nogo'",
        pattern="^(go|nogo)$",
    )
    reason: str = Field(
        default="",
        description="Reason (mandatory for NO-GO)",
    )


class PiCDecisionResponse(BaseModel):
    """Response after PiC decision."""

    decision: str = Field(description="Decision made (go/nogo)")
    programme_status: str = Field(description="Programme status after decision")
    message: str = Field(description="Human-readable result")


class EmergencyStopRequest(BaseModel):
    """Request for emergency stop."""

    initiated_by: str = Field(
        min_length=1,
        description="Person initiating emergency stop",
    )
    reason: str = Field(
        min_length=1,
        description="Reason for emergency stop",
    )


class EmergencyStopResponse(BaseModel):
    """Response after emergency stop."""

    success: bool = Field(description="True if stop was executed")
    programme_status: str = Field(description="Programme status (aborted)")
    message: str = Field(description="Human-readable result")


# ── LOTO Schemas ─────────────────────────────────────────────────


class LOTOPointSchema(BaseModel):
    """A single LOTO isolation point."""

    point_id: str = Field(description="LOTO point identifier")
    equipment_id: str = Field(description="Associated earth switch")
    status: str = Field(description="LOTO status (not_applied, applied, removed)")
    locked_by: str = Field(default="", description="Who applied the lock")
    tag_number: str = Field(description="Danger tag number")
    applied_at: datetime | None = Field(default=None, description="Lock application time")
    removed_at: datetime | None = Field(default=None, description="Lock removal time")
    removed_by: str = Field(default="", description="Who removed the lock")


class LOTOSetSchema(BaseModel):
    """LOTO set for a programme."""

    programme_id: str = Field(description="Associated programme")
    points: list[LOTOPointSchema] = Field(description="All isolation points")
    all_applied: bool = Field(description="True if all points are APPLIED")
    all_removed: bool = Field(description="True if all points are REMOVED")


class LOTOActionRequest(BaseModel):
    """Request to apply or remove LOTO."""

    performed_by: str = Field(
        min_length=1,
        description="Person performing the action",
    )


class LOTOActionResponse(BaseModel):
    """Response after LOTO action."""

    success: bool = Field(description="True if action succeeded")
    point_id: str = Field(description="Affected LOTO point")
    status: str = Field(description="New LOTO status")
    message: str = Field(description="Human-readable result")


# ── Audit Trail Schema ──────────────────────────────────────────


class AuditRecordSchema(BaseModel):
    """A single audit trail entry."""

    record_id: str = Field(description="Record identifier")
    timestamp: datetime = Field(description="UTC timestamp")
    action: str = Field(description="Action description")
    performed_by: str = Field(description="Who performed")
    step_id: str = Field(default="", description="Associated step")
    details: str = Field(default="", description="Additional context")


class AuditTrailResponse(BaseModel):
    """Complete audit trail for a programme."""

    programme_id: str = Field(description="Programme identifier")
    total_records: int = Field(description="Total audit entries")
    records: list[AuditRecordSchema] = Field(description="All audit records")
