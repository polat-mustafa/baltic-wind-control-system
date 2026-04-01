"""
Pydantic schemas for Cybersecurity / IEC 62443 API — M07.

Covers Purdue Model zone segmentation, conduit definitions,
security event logging, attack simulation scenarios, and IEC 62443 compliance.
"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

# ── Zones ─────────────────────────────────────────────────────────────────────


class SecurityZoneResponse(BaseModel):
    """A single Purdue Model security zone."""

    id: uuid.UUID
    name: str
    level: int = Field(
        description="Purdue level 0-5: 0=Process, 1=Control, 2=SCADA, 3=Site, 4=Business, 5=External"
    )
    description: str
    security_level_target: str = Field(description="IEC 62443 SL-0 to SL-4")
    color: str = Field(description="UI display colour (hex)")
    device_count: int = Field(description="Number of devices in this zone")


class ZonesResponse(BaseModel):
    """Complete Purdue Model zone hierarchy for Baltic Wind."""

    zones: list[SecurityZoneResponse]
    ot_it_boundary: str = Field(description="Zone name at OT/IT boundary (typically Level 3)")
    total_zones: int


# ── Conduits ──────────────────────────────────────────────────────────────────


class FirewallRule(BaseModel):
    """A single firewall rule on a conduit."""

    rule_id: str
    action: str = Field(description="ALLOW / DENY / LOG")
    protocol: str
    source_port: str = Field(default="ANY")
    dest_port: str
    description: str


class SecurityConduitResponse(BaseModel):
    """Data path between two security zones."""

    id: uuid.UUID
    name: str
    source_zone: str
    dest_zone: str
    allowed_protocols: list[str]
    encryption: str
    bidirectional: bool
    criticality: str = Field(description="LOW / MEDIUM / HIGH")
    firewall_rules: list[FirewallRule]


class ConduitsResponse(BaseModel):
    """All zone conduits with firewall rules."""

    conduits: list[SecurityConduitResponse]
    total_conduits: int
    unencrypted_count: int = Field(description="Conduits without encryption (security gap)")


# ── Attack simulation ─────────────────────────────────────────────────────────


class AttackScenarioRequest(BaseModel):
    """Request to simulate a specific attack scenario."""

    scenario_id: str = Field(
        description=(
            "Attack scenario identifier. Available: "
            "REPLAY_ATTACK, MITM_GOOSE, CREDENTIAL_BRUTE_FORCE, "
            "ROGUE_DEVICE, RANSOMWARE_IT_LATERAL"
        )
    )
    target_zone: str = Field(
        default="SCADA",
        description="Zone being targeted in the simulation",
    )


class AttackStepResult(BaseModel):
    """One step in an attack simulation narrative."""

    step: int
    action: str
    result: str
    detected: bool
    mitigating_control: str


class AttackSimulationResponse(BaseModel):
    """Educational attack scenario simulation result."""

    scenario_id: str
    scenario_name: str
    attack_vector: str
    targeted_zone: str
    steps: list[AttackStepResult]
    overall_blocked: bool
    lessons_learned: list[str] = Field(description="Key security lessons from this scenario")
    iec62443_references: list[str] = Field(description="Relevant IEC 62443 requirements")
    events_generated: int = Field(description="Number of security events logged during simulation")


# ── Security events ───────────────────────────────────────────────────────────


class SecurityEventResponse(BaseModel):
    """A single security event."""

    id: int
    timestamp_utc: str
    event_type: str = Field(
        description="AUTH_FAIL / BLOCKED_CMD / ANOMALY / REPLAY_ATTACK / SCAN / BREACH"
    )
    source_zone: str
    source_ip: str
    target_zone: str | None
    description: str
    blocked: bool
    severity: str = Field(description="LOW / MEDIUM / HIGH / CRITICAL")
    scenario_id: str | None


class SecurityEventsResponse(BaseModel):
    """Paginated security event log."""

    events: list[SecurityEventResponse]
    total: int
    critical_count: int
    unblocked_count: int = Field(description="Events that were NOT blocked (potential breach)")


# ── Compliance ────────────────────────────────────────────────────────────────


class ComplianceCheckResponse(BaseModel):
    """Single IEC 62443 requirement check result."""

    requirement_id: str
    security_level: str = Field(description="SL-1 / SL-2 / SL-3 / SL-4")
    category: str
    description: str
    compliant: bool
    evidence: str | None
    risk_score: float = Field(description="1.0 (low risk) - 10.0 (critical)")


class ComplianceSummaryResponse(BaseModel):
    """IEC 62443 overall compliance posture."""

    standard: str = Field(default="IEC 62443-3-3:2013 System Security Requirements")
    sl1_score_pct: float = Field(description="SL-1 requirements met [%]")
    sl2_score_pct: float = Field(description="SL-2 requirements met [%]")
    sl3_score_pct: float = Field(description="SL-3 requirements met [%]")
    target_sl: str = Field(description="Target security level for Baltic Wind (SL-2 for OT)")
    checks: list[ComplianceCheckResponse]
    open_gaps: int = Field(description="Requirements not yet met at target SL")
    critical_gaps: list[str] = Field(description="High-risk open gaps")
    overall_assessment: str
