"""
Pydantic schemas for the bay controller API (M01 — Interlock Engine).

Request/response models for:
  - Bay state queries
  - Switch command execution
  - Interlock dry-run validation
  - Interlock status listing
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Shared value types ────────────────────────────────────────────


class SynchroCheckSchema(BaseModel):
    """Synchrocheck measurements for ILK-007 (tie CB close validation).

    Physics: Before closing a bus coupler to parallel two live busbars,
    both sides must be in synchronism:
      ΔV   < 5%     — voltage magnitude difference
      Δf   < 0.1 Hz — frequency difference
      Δφ   < 10°    — phase angle difference

    Reference: IEC 60909-3 synchronising conditions.
    """

    delta_voltage_percent: float = Field(
        ge=0.0,
        description="Voltage magnitude difference [%] — limit 5%",
    )
    delta_frequency_hz: float = Field(
        ge=0.0,
        description="Frequency difference [Hz] — limit 0.1 Hz",
    )
    delta_phase_deg: float = Field(
        ge=0.0,
        le=360.0,
        description="Phase angle difference [°] — limit 10°",
    )
    is_in_sync: bool = Field(
        description="True if all three conditions are within limits",
    )


# ── Bay state ─────────────────────────────────────────────────────


class BayStateResponse(BaseModel):
    """Current state of a single bay controller.

    Returned by GET /api/v1/scada/bays/{bay_id}/state
    """

    bay_id: uuid.UUID
    name: str
    display_name: str
    voltage_kv: float
    bay_type: str
    bay_mode: str = Field(description="local / remote / maintenance")
    circuit_breaker: str = Field(description="open / closed / tripped / failed / intermediate")
    disconnector_bus: str = Field(description="open / closed / intermediate")
    disconnector_line: str = Field(description="open / closed / intermediate")
    earth_switch: str = Field(description="open / closed")
    protection_relay: str = Field(description="armed / tripped / blocked / test")
    manual_isolation_active: bool
    is_tie_cb: bool
    synchrocheck: SynchroCheckSchema | None = None
    last_updated: datetime


class AllBaysResponse(BaseModel):
    """Current state of all OSS bays.

    Returned by GET /api/v1/scada/bays
    """

    bays: list[BayStateResponse]
    total: int
    energised_count: int = Field(description="Bays with CB in CLOSED state")
    earthed_count: int = Field(description="Bays with earth switch CLOSED")
    alarm_count: int = Field(description="Bays with relay TRIPPED or CB FAILED")


# ── Switch commands ───────────────────────────────────────────────


class SwitchCommandRequest(BaseModel):
    """Request body for POST /api/v1/scada/bays/{bay_id}/command.

    The command is validated through the 7-rule interlock engine before
    execution. If any interlock fires the command is rejected with 409.
    """

    equipment_id: str = Field(
        description="Equipment to operate, e.g. 'CB-STR-01' or 'ES-STR-01'",
        examples=["CB-STR-01"],
    )
    action: str = Field(
        description="Switching action: open / close / earth / unearth / rack_in / rack_out",
        examples=["close"],
    )
    operator_id: str = Field(
        description="Operator identifier for audit trail",
        examples=["operator_kaan"],
    )
    is_auto_reclose: bool = Field(
        default=False,
        description="True if command originates from auto-reclose logic (ILK-006 check)",
    )
    synchrocheck: SynchroCheckSchema | None = Field(
        default=None,
        description="Required for tie CB close commands (ILK-007 check)",
    )


class CommandExecutionResponse(BaseModel):
    """Result of a switching command execution.

    Returned by POST /api/v1/scada/bays/{bay_id}/command
    """

    success: bool
    equipment_id: str
    action: str
    previous_state: str
    new_state: str
    message: str
    timestamp: datetime
    soe_event_id: int | None = Field(
        default=None,
        description="SOE recorder event ID for this operation",
    )


# ── Interlock status ──────────────────────────────────────────────


class InterlockRuleStatus(BaseModel):
    """Status of a single interlock rule for a given bay.

    Returned as part of GET /api/v1/scada/bays/{bay_id}/interlocks
    """

    interlock_id: str = Field(description="e.g. 'ILK-001'")
    description: str = Field(description="Plain-English rule description")
    currently_active: bool = Field(description="True if this rule is currently blocking operations")
    blocking_equipment: str | None = Field(
        default=None,
        description="Equipment ID causing the interlock to fire",
    )
    blocking_state: str | None = Field(
        default=None,
        description="State of the blocking equipment",
    )


class InterlockStatusResponse(BaseModel):
    """All interlock rule statuses for a bay.

    Returned by GET /api/v1/scada/bays/{bay_id}/interlocks
    """

    bay_id: uuid.UUID
    bay_name: str
    rules: list[InterlockRuleStatus]
    all_clear: bool = Field(description="True if no interlocks currently active")


# ── Interlock dry-run ─────────────────────────────────────────────


class ValidateCommandRequest(BaseModel):
    """Request body for POST /api/v1/scada/interlocks/validate (dry-run).

    Same fields as SwitchCommandRequest but no state change is made.
    Used by the SCADA UI to colour equipment green/red before operator
    executes the real command.
    """

    bay_id: uuid.UUID
    equipment_id: str = Field(examples=["CB-STR-01"])
    action: str = Field(examples=["close"])
    operator_id: str = Field(examples=["operator_kaan"])
    is_auto_reclose: bool = False
    synchrocheck: SynchroCheckSchema | None = None


class CommandValidationResponse(BaseModel):
    """Dry-run result from POST /api/v1/scada/interlocks/validate.

    The UI shows this before the operator clicks the confirmation button:
      allowed=True  → button is green, command will succeed
      allowed=False → button is red, blocked_by shows which rules fire
    """

    allowed: bool
    blocked_by: list[str] = Field(
        description="Interlock IDs that would block this command, e.g. ['ILK-001']"
    )
    reasons: list[str] = Field(description="Human-readable block reason for each blocked_by entry")
    equipment_id: str
    action: str
