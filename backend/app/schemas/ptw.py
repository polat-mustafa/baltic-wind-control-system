"""
Pydantic schemas for Permit-to-Work and IEC 62443 RBAC (P3).

Request and response models for the RBAC permission system and
the 9-state Permit-to-Work lifecycle.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── RBAC Schemas ──────────────────────────────────────────────────


class PermissionCheckRequest(BaseModel):
    """Request to check a permission against a role level."""

    role_level: int = Field(
        ge=1,
        le=5,
        description=(
            "User role level (1=Viewer, 2=Operator, 3=Senior Operator, 4=Engineer, 5=Admin)"
        ),
    )
    permission: str = Field(
        description="Permission to check (e.g. 'ptw_approve', 'control_switchgear')",
    )


class PermissionCheckResponse(BaseModel):
    """Result of a permission check."""

    granted: bool = Field(description="True if permission is granted")
    role_level: int = Field(description="Role level that was checked")
    permission: str = Field(description="Permission that was checked")
    reason: str = Field(description="Human-readable explanation")
    mfa_required: bool = Field(description="True if MFA is required for this role level")


class RolePermissionSchema(BaseModel):
    """A single permission entry in a role definition."""

    permission: str = Field(description="Permission identifier")
    description: str = Field(default="", description="Human-readable description")


class RoleDefinitionResponse(BaseModel):
    """Complete role definition with permissions."""

    level: int = Field(description="Role level (1-5)")
    name: str = Field(description="Human-readable role name")
    description: str = Field(description="Role responsibilities description")
    permissions: list[str] = Field(description="All permissions (own + inherited)")
    mfa_required: bool = Field(description="True if MFA is mandatory")
    security_level: int = Field(description="IEC 62443 Security Level (SL 1-3)")


class IEC62443ZoneSchema(BaseModel):
    """IEC 62443-3-3 security zone definition."""

    zone: str = Field(description="Zone identifier")
    min_access_level: int = Field(description="Minimum RoleLevel to access this zone")
    description: str = Field(description="Zone purpose and boundaries")


# ── PtW Schemas ───────────────────────────────────────────────────


class CreatePermitRequest(BaseModel):
    """Request to create a new Permit-to-Work."""

    work_description: str = Field(
        min_length=10,
        description="Description of the work to be performed",
    )
    equipment_id: str = Field(
        min_length=1,
        description="Equipment identifier (IED name, bay, cable section)",
    )
    requested_by: str = Field(
        min_length=1,
        description="User requesting the permit",
    )
    person_in_charge: str = Field(
        default="",
        description="Person in Charge (PiC) for the work party",
    )


class TransitionPermitRequest(BaseModel):
    """Request to transition a permit to the next state."""

    target_status: str = Field(
        description="Target lifecycle state (e.g. 'risk_assessed', 'approved')",
    )
    performed_by: str = Field(
        min_length=1,
        description="User performing the transition",
    )
    user_level: int = Field(
        ge=1,
        le=5,
        description="RBAC level of the user (1-5)",
    )
    notes: str = Field(
        default="",
        description="Optional notes for the audit trail",
    )


class ExtendPermitRequest(BaseModel):
    """Request to extend a permit's validity period."""

    performed_by: str = Field(
        min_length=1,
        description="User requesting the extension",
    )
    user_level: int = Field(
        ge=1,
        le=5,
        description="RBAC level of the user (1-5)",
    )
    extension_hours: int = Field(
        default=12,
        ge=1,
        le=24,
        description="Hours to extend validity (default: 12)",
    )
    notes: str = Field(
        default="",
        description="Justification for extension",
    )


class TransitionLogSchema(BaseModel):
    """A single entry in the permit audit trail."""

    model_config = {"from_attributes": True}

    id: uuid.UUID = Field(description="Transition log entry ID")
    from_status: str = Field(description="State before transition")
    to_status: str = Field(description="State after transition")
    performed_by: str = Field(description="User who performed the transition")
    user_level: int = Field(description="RBAC level (1-5)")
    notes: str = Field(description="Notes or justification")
    created_at: datetime = Field(description="UTC timestamp")


class TransitionResponse(BaseModel):
    """Response after a successful state transition."""

    success: bool = Field(description="True if transition was applied")
    ptw_number: str = Field(description="Permit number")
    from_status: str = Field(description="Previous state")
    to_status: str = Field(description="New state")
    message: str = Field(description="Human-readable result description")
    step_number: int = Field(description="Current step number (1-9)")


class NextTransitionSchema(BaseModel):
    """An available next transition for a permit."""

    target_status: str = Field(description="Target state")
    required_permission: str = Field(description="RBAC permission needed")


class PermitDetailResponse(BaseModel):
    """Detailed permit response with computed fields and audit trail."""

    model_config = {"from_attributes": True}

    id: uuid.UUID = Field(description="Permit UUID")
    ptw_number: str = Field(description="Human-readable permit number")
    status: str = Field(description="Current lifecycle state")
    work_description: str = Field(description="Work description")
    equipment_id: str = Field(description="Equipment identifier")
    requested_by: str = Field(description="Requesting user")
    person_in_charge: str = Field(description="Person in Charge (PiC)")
    risk_level: str | None = Field(default=None, description="Risk severity")
    risk_categories: str | None = Field(default=None, description="Comma-separated risk categories")
    control_measures: str | None = Field(default=None, description="Hazard controls")
    approved_by: str | None = Field(default=None, description="Approving supervisor")
    valid_from: datetime | None = Field(default=None, description="Validity start")
    valid_until: datetime | None = Field(default=None, description="Validity end")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    # Computed fields
    current_step_number: int = Field(description="Current step (1-9, 0=cancelled)")
    next_allowed_transitions: list[NextTransitionSchema] = Field(
        description="Available next states with required permissions",
    )

    # Audit trail
    transition_log: list[TransitionLogSchema] = Field(
        default_factory=list,
        description="Complete transition audit trail",
    )


class PermitSummarySchema(BaseModel):
    """Summary permit for list responses."""

    model_config = {"from_attributes": True}

    id: uuid.UUID = Field(description="Permit UUID")
    ptw_number: str = Field(description="Permit number")
    status: str = Field(description="Current state")
    work_description: str = Field(description="Work description")
    equipment_id: str = Field(description="Equipment")
    requested_by: str = Field(description="Requester")
    created_at: datetime = Field(description="Created")


class PermitListResponse(BaseModel):
    """Paginated list of permits."""

    total: int = Field(description="Total permits matching filters")
    permits: list[PermitSummarySchema] = Field(description="Permit summaries")
