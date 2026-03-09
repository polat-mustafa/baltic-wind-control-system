"""P3 sub-router: RBAC — IEC 62443 role-based access control endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.ptw import (
    IEC62443ZoneSchema,
    PermissionCheckRequest,
    PermissionCheckResponse,
    RoleDefinitionResponse,
)
from app.services.p3.rbac import (
    Permission,
    RoleLevel,
    check_permission,
    get_all_roles,
    get_zone_definitions,
)

router = APIRouter()


@router.get("/rbac/roles", response_model=list[RoleDefinitionResponse])
async def list_roles() -> list[RoleDefinitionResponse]:
    """List all 5 IEC 62443 role definitions with permissions.

    Returns the complete RBAC matrix: role name, level, permissions
    (own + inherited), MFA requirement, and IEC 62443 Security Level.
    """
    roles = get_all_roles()
    return [
        RoleDefinitionResponse(
            level=r.level,
            name=r.name,
            description=r.description,
            permissions=sorted(p.value for p in r.permissions),
            mfa_required=r.mfa_required,
            security_level=r.security_level,
        )
        for r in roles
    ]


@router.post("/rbac/check", response_model=PermissionCheckResponse)
async def check_role_permission(request: PermissionCheckRequest) -> PermissionCheckResponse:
    """Check whether a role level has a specific permission.

    Validates the role level and permission, then looks up the RBAC
    matrix to determine access.
    """
    try:
        role_level = RoleLevel(request.role_level)
    except ValueError as err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role_level: {request.role_level}. Valid: 1-5.",
        ) from err

    try:
        permission = Permission(request.permission)
    except ValueError as err:
        valid_perms = [p.value for p in Permission]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid permission: '{request.permission}'. Valid: {valid_perms}",
        ) from err

    result = check_permission(role_level, permission)
    return PermissionCheckResponse(
        granted=result.granted,
        role_level=result.role_level,
        permission=result.permission.value,
        reason=result.reason,
        mfa_required=result.mfa_required,
    )


@router.get("/rbac/zones", response_model=list[IEC62443ZoneSchema])
async def list_zones() -> list[IEC62443ZoneSchema]:
    """List all IEC 62443-3-3 security zone definitions.

    Returns zone name, minimum access level, and engineering description.
    """
    zones = get_zone_definitions()
    return [
        IEC62443ZoneSchema(
            zone=z.zone.value,
            min_access_level=z.min_access_level,
            description=z.description,
        )
        for z in zones
    ]
