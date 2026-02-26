"""
Unit tests for IEC 62443 RBAC permission system (P3 — rbac.py).

Tests validate the 5-level role hierarchy, permission inheritance,
MFA requirements, and IEC 62443-3-3 zone access controls.

Test Strategy
-------------
- Exhaustive: every role level checked against every permission
- Inheritance verified: higher levels always include lower permissions
- MFA boundary: Level 3+ requires MFA, Level 1-2 does not
- Zone coverage: all 6 zones have defined minimum access levels
- Edge cases: boundary between Level 2 and Level 3 (MFA threshold)
"""

import pytest

from app.services.p3.rbac import (
    MFA_REQUIRED_LEVEL,
    PERMISSION_MATRIX,
    IEC62443Zone,
    Permission,
    RoleLevel,
    check_permission,
    get_all_roles,
    get_role_definition,
    get_zone_definitions,
)

# ── Role Permission Tests ────────────────────────────────────────


class TestRolePermissions:
    """Tests for the RBAC permission matrix and role hierarchy."""

    def test_viewer_can_only_view(self):
        """Level 1 (Viewer) has VIEW_DATA and nothing else."""
        permissions = PERMISSION_MATRIX[RoleLevel.VIEWER]
        assert Permission.VIEW_DATA in permissions
        assert len(permissions) == 1

    def test_viewer_cannot_acknowledge_alarms(self):
        """Level 1 cannot acknowledge alarms — read-only access."""
        result = check_permission(RoleLevel.VIEWER, Permission.ACK_ALARM)
        assert result.granted is False

    def test_viewer_cannot_control_switchgear(self):
        """Level 1 cannot operate switchgear — safety critical."""
        result = check_permission(RoleLevel.VIEWER, Permission.CONTROL_SWITCHGEAR)
        assert result.granted is False

    def test_operator_can_view_and_ack(self):
        """Level 2 (Operator) inherits VIEW_DATA and adds ACK_ALARM."""
        result_view = check_permission(RoleLevel.OPERATOR, Permission.VIEW_DATA)
        result_ack = check_permission(RoleLevel.OPERATOR, Permission.ACK_ALARM)
        assert result_view.granted is True
        assert result_ack.granted is True

    def test_operator_can_control_switchgear(self):
        """Level 2 can perform basic switchgear control under supervision."""
        result = check_permission(RoleLevel.OPERATOR, Permission.CONTROL_SWITCHGEAR)
        assert result.granted is True

    def test_operator_cannot_approve_ptw(self):
        """Level 2 cannot approve permits — requires Senior Operator (Level 3)."""
        result = check_permission(RoleLevel.OPERATOR, Permission.PTW_APPROVE)
        assert result.granted is False

    def test_operator_cannot_configure_ied(self):
        """Level 2 cannot configure IEDs — requires Engineer (Level 4)."""
        result = check_permission(RoleLevel.OPERATOR, Permission.CONFIG_IED)
        assert result.granted is False

    def test_senior_operator_can_approve_ptw(self):
        """Level 3 (Senior Operator) can approve Permits-to-Work."""
        result = check_permission(RoleLevel.SENIOR_OPERATOR, Permission.PTW_APPROVE)
        assert result.granted is True

    def test_senior_operator_can_isolate(self):
        """Level 3 can confirm equipment isolation."""
        result = check_permission(RoleLevel.SENIOR_OPERATOR, Permission.PTW_ISOLATE)
        assert result.granted is True

    def test_senior_operator_can_apply_loto(self):
        """Level 3 can apply LOTO — personal lock and tag."""
        result = check_permission(RoleLevel.SENIOR_OPERATOR, Permission.PTW_LOTO)
        assert result.granted is True

    def test_senior_operator_inherits_operator_permissions(self):
        """Level 3 inherits all Level 2 permissions (view, ack, switchgear)."""
        for perm in PERMISSION_MATRIX[RoleLevel.OPERATOR]:
            result = check_permission(RoleLevel.SENIOR_OPERATOR, perm)
            assert result.granted is True, f"Level 3 should inherit {perm}"

    def test_engineer_can_configure_ied(self):
        """Level 4 (Engineer) can configure IED protection settings."""
        result = check_permission(RoleLevel.ENGINEER, Permission.CONFIG_IED)
        assert result.granted is True

    def test_engineer_can_activate_permit(self):
        """Level 4 can activate a permit — work may commence."""
        result = check_permission(RoleLevel.ENGINEER, Permission.PTW_ACTIVATE)
        assert result.granted is True

    def test_engineer_inherits_all_lower_permissions(self):
        """Level 4 inherits all Level 1-3 permissions."""
        level_3_perms = PERMISSION_MATRIX[RoleLevel.SENIOR_OPERATOR]
        for perm in level_3_perms:
            result = check_permission(RoleLevel.ENGINEER, perm)
            assert result.granted is True, f"Level 4 should inherit {perm}"

    def test_admin_has_all_permissions(self):
        """Level 5 (Admin) has every permission in the system."""
        admin_perms = PERMISSION_MATRIX[RoleLevel.ADMIN]
        all_perms = set(Permission)
        assert admin_perms == frozenset(all_perms), f"Admin missing: {all_perms - admin_perms}"

    def test_admin_can_manage_users(self):
        """Level 5 can manage user accounts."""
        result = check_permission(RoleLevel.ADMIN, Permission.ADMIN_USERS)
        assert result.granted is True

    def test_admin_can_close_permit(self):
        """Level 5 can close a permit — final archive step."""
        result = check_permission(RoleLevel.ADMIN, Permission.PTW_CLOSE)
        assert result.granted is True

    @pytest.mark.parametrize("level", list(RoleLevel))
    def test_all_levels_can_view_data(self, level: RoleLevel):
        """Every role level must have VIEW_DATA (minimum permission)."""
        result = check_permission(level, Permission.VIEW_DATA)
        assert result.granted is True, f"Level {level} cannot view data"

    def test_higher_level_inherits_lower(self):
        """Permission sets are strictly cumulative: P(n) ⊇ P(n-1)."""
        levels = sorted(RoleLevel)
        for i in range(1, len(levels)):
            lower = PERMISSION_MATRIX[levels[i - 1]]
            higher = PERMISSION_MATRIX[levels[i]]
            assert lower.issubset(higher), (
                f"Level {levels[i]} does not inherit all of Level {levels[i - 1]}. "
                f"Missing: {lower - higher}"
            )

    def test_permission_count_increases_with_level(self):
        """Each higher level has strictly more permissions than the one below."""
        levels = sorted(RoleLevel)
        for i in range(1, len(levels)):
            lower_count = len(PERMISSION_MATRIX[levels[i - 1]])
            higher_count = len(PERMISSION_MATRIX[levels[i]])
            assert higher_count > lower_count, (
                f"Level {levels[i]} ({higher_count}) should have more permissions "
                f"than Level {levels[i - 1]} ({lower_count})"
            )

    def test_total_permission_count(self):
        """The system must have exactly 13 distinct permissions."""
        all_perms = set(Permission)
        assert len(all_perms) == 13

    def test_check_permission_returns_reason(self):
        """Permission check result always includes a human-readable reason."""
        result = check_permission(RoleLevel.VIEWER, Permission.ADMIN_USERS)
        assert result.reason
        assert "Level 5" in result.reason or "Admin" in result.reason


# ── MFA Requirement Tests ────────────────────────────────────────


class TestMFARequirement:
    """Tests for multi-factor authentication requirements per IEC 62443."""

    def test_mfa_threshold_is_level_3(self):
        """MFA is required starting at Level 3 (Senior Operator)."""
        assert MFA_REQUIRED_LEVEL == RoleLevel.SENIOR_OPERATOR

    def test_viewer_no_mfa(self):
        """Level 1 does not require MFA — read-only access."""
        result = check_permission(RoleLevel.VIEWER, Permission.VIEW_DATA)
        assert result.mfa_required is False

    def test_operator_no_mfa(self):
        """Level 2 does not require MFA — supervised operations."""
        result = check_permission(RoleLevel.OPERATOR, Permission.ACK_ALARM)
        assert result.mfa_required is False

    def test_senior_operator_requires_mfa(self):
        """Level 3 requires MFA — can approve permits and control HV."""
        result = check_permission(RoleLevel.SENIOR_OPERATOR, Permission.PTW_APPROVE)
        assert result.mfa_required is True

    def test_engineer_requires_mfa(self):
        """Level 4 requires MFA — can configure protection relays."""
        result = check_permission(RoleLevel.ENGINEER, Permission.CONFIG_IED)
        assert result.mfa_required is True

    def test_admin_requires_mfa(self):
        """Level 5 requires MFA — full system access."""
        result = check_permission(RoleLevel.ADMIN, Permission.ADMIN_USERS)
        assert result.mfa_required is True

    def test_mfa_reported_even_when_denied(self):
        """MFA requirement is reported regardless of permission grant status."""
        # Level 3 user requesting Level 5 permission — denied but MFA still true
        result = check_permission(RoleLevel.SENIOR_OPERATOR, Permission.ADMIN_USERS)
        assert result.granted is False
        assert result.mfa_required is True


# ── IEC 62443 Zone Tests ─────────────────────────────────────────


class TestIEC62443Zones:
    """Tests for IEC 62443-3-3 network security zone definitions."""

    def test_all_zones_defined(self):
        """All 6 security zones must have definitions."""
        zones = get_zone_definitions()
        zone_ids = {z.zone for z in zones}
        expected = set(IEC62443Zone)
        assert zone_ids == expected, f"Missing zones: {expected - zone_ids}"

    def test_zone_count(self):
        """There must be exactly 6 zones (5 + DMZ)."""
        zones = get_zone_definitions()
        assert len(zones) == 6

    def test_all_zones_have_min_access_level(self):
        """Every zone must define a minimum access level >= 1."""
        zones = get_zone_definitions()
        for zone in zones:
            assert zone.min_access_level >= 1, (
                f"Zone {zone.zone} has invalid min_access_level: {zone.min_access_level}"
            )

    def test_process_zone_highest_security(self):
        """Process zone (IEC 61850 GOOSE/MMS) requires the highest access level."""
        zones = get_zone_definitions()
        process = next(z for z in zones if z.zone == IEC62443Zone.PROCESS)
        max_level = max(z.min_access_level for z in zones)
        assert process.min_access_level == max_level

    def test_enterprise_zone_lowest_security(self):
        """Enterprise zone (corporate IT) requires the lowest access level."""
        zones = get_zone_definitions()
        enterprise = next(z for z in zones if z.zone == IEC62443Zone.ENTERPRISE)
        min_level = min(z.min_access_level for z in zones)
        assert enterprise.min_access_level == min_level

    def test_all_zones_have_descriptions(self):
        """Every zone must have a non-empty engineering description."""
        zones = get_zone_definitions()
        for zone in zones:
            assert zone.description, f"Zone {zone.zone} has no description"


# ── Role Definition Tests ────────────────────────────────────────


class TestRoleDefinitions:
    """Tests for role metadata and definition retrieval."""

    def test_get_all_roles_returns_five(self):
        """There must be exactly 5 role levels."""
        roles = get_all_roles()
        assert len(roles) == 5

    def test_roles_ordered_by_level(self):
        """Roles are returned in ascending level order."""
        roles = get_all_roles()
        levels = [r.level for r in roles]
        assert levels == sorted(levels)

    def test_each_role_has_name(self):
        """Every role must have a non-empty human-readable name."""
        roles = get_all_roles()
        for role in roles:
            assert role.name, f"Level {role.level} has no name"

    def test_each_role_has_description(self):
        """Every role must have a non-empty engineering description."""
        roles = get_all_roles()
        for role in roles:
            assert role.description, f"Level {role.level} has no description"

    def test_each_role_has_security_level(self):
        """Every role maps to an IEC 62443 Security Level (1-3)."""
        roles = get_all_roles()
        for role in roles:
            assert 1 <= role.security_level <= 4, (
                f"Level {role.level} has invalid SL: {role.security_level}"
            )

    @pytest.mark.parametrize("level", list(RoleLevel))
    def test_get_role_definition(self, level: RoleLevel):
        """get_role_definition returns a valid definition for each level."""
        role = get_role_definition(level)
        assert role.level == level
        assert role.permissions == PERMISSION_MATRIX[level]
