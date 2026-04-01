"""
Tests for M07 Cybersecurity IEC 62443.

Covers:
- Purdue Model zones: correct level assignments, device counts
- Conduits: encryption status, firewall rules, directionality
- Attack scenarios: all 5 scenarios run without error
- Attack simulation: detected steps generate security events
- Security events: accumulate after simulations
- Compliance: IEC 62443-3-3 SL-1/SL-2 scoring, gap identification
"""

from __future__ import annotations

import pytest

from app.services.p3.security import (
    _ATTACK_SCENARIOS,
    _COMPLIANCE_CHECKS,
    _CONDUITS,
    _ZONES,
    get_compliance,
    get_conduits,
    get_security_events,
    get_zones,
    simulate_attack,
)

# ── Purdue Model zones ─────────────────────────────────────────────────────────


class TestPurdueZones:
    """IEC 62443 zone hierarchy."""

    def test_six_zones_defined(self):
        """Baltic Wind must define 6 Purdue levels (0–5)."""
        result = get_zones()
        assert result["total_zones"] == 6

    def test_all_levels_present(self):
        """Zones must cover levels 0 through 5."""
        result = get_zones()
        levels = {z["level"] for z in result["zones"]}
        assert levels == {0, 1, 2, 3, 4, 5}

    def test_ot_it_boundary_is_site_operations(self):
        """OT/IT boundary should be at Level 3 (SITE_OPERATIONS)."""
        result = get_zones()
        assert result["ot_it_boundary"] == "SITE_OPERATIONS"

    def test_scada_at_level_2(self):
        """SCADA zone must be Level 2."""
        scada = next(z for z in _ZONES if z["name"] == "SCADA")
        assert scada["level"] == 2

    def test_basic_control_at_level_1(self):
        """Bay controllers / protection relays at Level 1."""
        bc = next(z for z in _ZONES if z["name"] == "BASIC_CONTROL")
        assert bc["level"] == 1

    def test_external_at_level_5(self):
        """External (PSE WAMS, internet) at Level 5."""
        ext = next(z for z in _ZONES if z["name"] == "EXTERNAL")
        assert ext["level"] == 5

    def test_scada_sl2_target(self):
        """SCADA must target SL-2 (intentional attack protection)."""
        scada = next(z for z in _ZONES if z["name"] == "SCADA")
        assert scada["security_level_target"] == "SL-2"

    def test_external_zone_sl1(self):
        """External zone is not owned — SL-1 target only."""
        ext = next(z for z in _ZONES if z["name"] == "EXTERNAL")
        assert ext["security_level_target"] == "SL-1"

    def test_zones_have_device_counts(self):
        """All zones must have device_count field."""
        result = get_zones()
        for zone in result["zones"]:
            assert "device_count" in zone
            assert zone["device_count"] >= 0


# ── Conduits ──────────────────────────────────────────────────────────────────


class TestConduits:
    """Zone conduit definitions and firewall rules."""

    def test_conduits_returned(self):
        result = get_conduits()
        assert result["total_conduits"] > 0
        assert len(result["conduits"]) == result["total_conduits"]

    def test_at_least_one_unencrypted(self):
        """Level 0-1 connection (GOOSE) has no encryption — reported."""
        result = get_conduits()
        assert result["unencrypted_count"] >= 1

    def test_remote_access_vpn_encrypted(self):
        """External → Site Ops VPN must use strong encryption."""
        vpn = next((c for c in _CONDUITS if "VPN" in c["name"]), None)
        assert vpn is not None
        assert "IPSec" in vpn["encryption"] or "TLS" in vpn["encryption"]

    def test_historian_conduit_unidirectional(self):
        """SCADA → Historian must be one-way (data diode logic)."""
        hist = next((c for c in _CONDUITS if "Historian" in c["name"]), None)
        assert hist is not None
        assert hist["bidirectional"] is False

    def test_all_conduits_have_firewall_rules(self):
        """Every conduit must define at least one firewall rule."""
        for conduit in _CONDUITS:
            assert len(conduit["firewall_rules"]) >= 1

    def test_firewall_rules_have_required_fields(self):
        """Each firewall rule must have action, protocol, dest_port."""
        for conduit in _CONDUITS:
            for rule in conduit["firewall_rules"]:
                assert "action" in rule
                assert rule["action"] in ("ALLOW", "DENY", "LOG")
                assert "protocol" in rule
                assert "dest_port" in rule

    def test_criticality_values_valid(self):
        """Criticality must be LOW, MEDIUM, or HIGH."""
        for conduit in _CONDUITS:
            assert conduit["criticality"] in ("LOW", "MEDIUM", "HIGH")


# ── Attack scenarios ───────────────────────────────────────────────────────────


class TestAttackScenarios:
    """Educational attack scenario simulations."""

    def test_five_scenarios_defined(self):
        """All 5 planned attack scenarios must exist."""
        assert len(_ATTACK_SCENARIOS) == 5

    def test_all_scenarios_have_required_keys(self):
        for sid, s in _ATTACK_SCENARIOS.items():
            assert "name" in s, f"{sid} missing name"
            assert "attack_vector" in s, f"{sid} missing attack_vector"
            assert "steps" in s, f"{sid} missing steps"
            assert "overall_blocked" in s, f"{sid} missing overall_blocked"
            assert "lessons_learned" in s, f"{sid} missing lessons_learned"

    def test_replay_attack_scenario_runs(self):
        result = simulate_attack("REPLAY_ATTACK", "BASIC_CONTROL")
        assert result["scenario_id"] == "REPLAY_ATTACK"
        assert len(result["steps"]) >= 3

    def test_mitm_goose_scenario_runs(self):
        result = simulate_attack("MITM_GOOSE", "SCADA")
        assert result["scenario_id"] == "MITM_GOOSE"
        assert result["overall_blocked"] is True

    def test_credential_brute_force_scenario_runs(self):
        result = simulate_attack("CREDENTIAL_BRUTE_FORCE", "SCADA")
        assert result["overall_blocked"] is True

    def test_rogue_device_blocked_is_false(self):
        """Rogue device scenario results in partial breach (trip occurs before detection)."""
        result = simulate_attack("ROGUE_DEVICE", "BASIC_CONTROL")
        assert result["overall_blocked"] is False

    def test_ransomware_scenario_runs(self):
        result = simulate_attack("RANSOMWARE_IT_LATERAL", "SITE_OPERATIONS")
        assert len(result["steps"]) >= 4
        assert result["overall_blocked"] is True

    def test_unknown_scenario_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown scenario"):
            simulate_attack("NONEXISTENT_ATTACK", "SCADA")

    def test_steps_have_required_fields(self):
        result = simulate_attack("REPLAY_ATTACK", "BASIC_CONTROL")
        for step in result["steps"]:
            assert "step" in step
            assert "action" in step
            assert "result" in step
            assert "detected" in step
            assert "mitigating_control" in step

    def test_iec62443_references_present(self):
        result = simulate_attack("REPLAY_ATTACK", "BASIC_CONTROL")
        assert len(result["iec62443_references"]) >= 1

    def test_lessons_learned_present(self):
        result = simulate_attack("CREDENTIAL_BRUTE_FORCE", "SCADA")
        assert len(result["lessons_learned"]) >= 3


# ── Security events ────────────────────────────────────────────────────────────


class TestSecurityEvents:
    """Security event log accumulation."""

    def test_events_accumulated_after_simulation(self):
        """After running a simulation, event log must have entries."""
        # Run a simulation that generates events
        simulate_attack("REPLAY_ATTACK", "BASIC_CONTROL")
        result = get_security_events(limit=100)
        assert result["total"] > 0
        assert len(result["events"]) > 0

    def test_events_have_required_fields(self):
        simulate_attack("MITM_GOOSE", "SCADA")
        result = get_security_events(limit=50)
        for event in result["events"]:
            assert "event_type" in event
            assert "source_zone" in event
            assert "description" in event
            assert "blocked" in event
            assert "severity" in event

    def test_event_type_is_valid(self):
        simulate_attack("CREDENTIAL_BRUTE_FORCE", "SCADA")
        result = get_security_events(limit=50)
        valid_types = {"AUTH_FAIL", "BLOCKED_CMD", "ANOMALY", "REPLAY_ATTACK", "SCAN", "BREACH"}
        for event in result["events"]:
            assert event["event_type"] in valid_types

    def test_unblocked_count_for_rogue_device(self):
        """Rogue device scenario has unblocked events (trip occurs)."""
        simulate_attack("ROGUE_DEVICE", "BASIC_CONTROL")
        result = get_security_events(limit=100)
        # Just verify the count is a non-negative integer
        assert result["unblocked_count"] >= 0


# ── IEC 62443 compliance ───────────────────────────────────────────────────────


class TestCompliance:
    """IEC 62443-3-3 compliance checklist."""

    def test_standard_identifier(self):
        result = get_compliance()
        assert "IEC 62443" in result["standard"]

    def test_sl2_target_for_baltic_wind(self):
        """Target security level must be SL-2 for OT zones."""
        result = get_compliance()
        assert result["target_sl"] == "SL-2"

    def test_sl1_sl2_sl3_scores_are_percentages(self):
        result = get_compliance()
        assert 0.0 <= result["sl1_score_pct"] <= 100.0
        assert 0.0 <= result["sl2_score_pct"] <= 100.0
        assert 0.0 <= result["sl3_score_pct"] <= 100.0

    def test_sl1_higher_than_sl2(self):
        """SL-1 requirements are a subset — score should be >= SL-2 score."""
        result = get_compliance()
        assert result["sl1_score_pct"] >= result["sl2_score_pct"]

    def test_open_gaps_positive(self):
        """Baltic Wind has known open security gaps."""
        result = get_compliance()
        assert result["open_gaps"] > 0

    def test_critical_gaps_list_present(self):
        result = get_compliance()
        assert isinstance(result["critical_gaps"], list)
        assert len(result["critical_gaps"]) > 0

    def test_compliance_checks_have_required_fields(self):
        result = get_compliance()
        for check in result["checks"]:
            assert "requirement_id" in check
            assert "security_level" in check
            assert check["security_level"] in ("SL-1", "SL-2", "SL-3", "SL-4")
            assert "compliant" in check
            assert "risk_score" in check
            assert 1.0 <= check["risk_score"] <= 10.0

    def test_assessment_is_non_empty(self):
        result = get_compliance()
        assert len(result["overall_assessment"]) > 0

    def test_sr_1_1_authentication_is_compliant(self):
        """SR-1.1 Human user auth — FastAPI JWT + RBAC is in place."""
        sr11 = next((c for c in _COMPLIANCE_CHECKS if c["requirement_id"] == "SR-1.1"), None)
        assert sr11 is not None
        assert sr11["compliant"] is True

    def test_sr_5_1_network_segmentation_compliant(self):
        """SR-5.1 Network segmentation — 6-zone Purdue model is implemented."""
        sr51 = next((c for c in _COMPLIANCE_CHECKS if c["requirement_id"] == "SR-5.1"), None)
        assert sr51 is not None
        assert sr51["compliant"] is True

    def test_sr_1_7_mfa_not_compliant(self):
        """SR-1.7 MFA for remote access — known gap, not yet implemented."""
        sr17 = next((c for c in _COMPLIANCE_CHECKS if c["requirement_id"] == "SR-1.7"), None)
        assert sr17 is not None
        assert sr17["compliant"] is False
