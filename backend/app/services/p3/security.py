"""
Cybersecurity service — M07 (IEC 62443).

Implements:
1. Purdue Model (ISA-95) six-level zone hierarchy for Baltic Wind
2. Zone conduits with protocol/encryption/firewall definitions
3. Five educational attack scenarios with step-by-step narratives
4. Security event logging (in-memory for simulation)
5. IEC 62443-3-3:2013 compliance checklist (SL-1/SL-2/SL-3)

Standards references
--------------------
IEC 62443-1-1:2009  — Concepts and models
IEC 62443-2-1:2010  — Security management system requirements
IEC 62443-3-3:2013  — System security requirements and security levels
IEC 61850-90-15     — IEC 61850 and cybersecurity (GOOSE encryption)
NERC CIP-005-6      — Electronic Security Perimeter (North American reference)
BSI TR-02102-1      — Cryptographic recommendations (German BSI, relevant for Baltic)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

# ── Purdue Model zone definitions ──────────────────────────────────────────────

_ZONES: list[dict[str, Any]] = [
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000001")),
        "name": "PHYSICAL_PROCESS",
        "level": 0,
        "description": (
            "Level 0 — Physical process layer. "
            "Turbine mechanical components, sensors, actuators, "
            "blade pitch drives, yaw motors, and gearbox instrumentation. "
            "Physical protection: fenced turbine nacelles, locked access hatches."
        ),
        "security_level_target": "SL-1",
        "color": "#9E9E9E",
        "device_count": 170,  # 34 turbines * 5 sensors each
    },
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000002")),
        "name": "BASIC_CONTROL",
        "level": 1,
        "description": (
            "Level 1 — Basic control layer. "
            "Bay controllers (8x), protection relays (IEC 60255), "
            "turbine PLCs, local HMI panels. "
            "IEC 61850 GOOSE messaging (multicast, requires VLAN isolation). "
            "Highest availability requirement: must operate even if Level 2 disconnected."
        ),
        "security_level_target": "SL-2",
        "color": "#F44336",
        "device_count": 52,  # 8 bay controllers + 34 turbine controllers + 10 relays
    },
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000003")),
        "name": "SCADA",
        "level": 2,
        "description": (
            "Level 2 — Supervisory control. "
            "Baltic Wind SCADA server, SCADA HMI workstations, OPC-UA server (port 4840), "
            "PPC (Power Plant Controller), EMS (Energy Management System). "
            "Highest-value attack target: controls all 34 WTGs + OSS. "
            "IEC 62443 SL-2: requires authentication, audit trail, encrypted comms."
        ),
        "security_level_target": "SL-2",
        "color": "#FF9800",
        "device_count": 8,  # SCADA server, HMI x2, OPC-UA, PPC, EMS, NTP, historian
    },
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000004")),
        "name": "SITE_OPERATIONS",
        "level": 3,
        "description": (
            "Level 3 — Site operations and logistics. "
            "Historian (TimescaleDB), engineering workstations, patch management server, "
            "remote access gateway (VPN termination), asset management system. "
            "OT/IT boundary: DMZ connects this zone to Level 4 enterprise network."
        ),
        "security_level_target": "SL-2",
        "color": "#2196F3",
        "device_count": 6,  # Historian, 2x engineering WS, VPN gateway, asset mgmt, patch server
    },
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000005")),
        "name": "BUSINESS_NETWORK",
        "level": 4,
        "description": (
            "Level 4 — Corporate/enterprise IT. "
            "Market bidding systems (TGE portal), ERP, corporate email, finance systems. "
            "Separated from OT by DMZ with application-layer firewall. "
            "Remote operator access via authenticated VPN with MFA."
        ),
        "security_level_target": "SL-1",
        "color": "#4CAF50",
        "device_count": 15,  # Various corporate IT systems
    },
    {
        "id": str(uuid.UUID("00000000-0000-0000-0000-000000000006")),
        "name": "EXTERNAL",
        "level": 5,
        "description": (
            "Level 5 — External networks and cloud. "
            "PSE TSO WAMS telemetry connection (IEC 61968/61970 CIM), "
            "ERA5 reanalysis API (HTTPS), "
            "remote operations centre (ROC) VPN, "
            "equipment vendor remote diagnostic tunnels. "
            "Highest-risk zone: internet-facing, requires strict ingress filtering."
        ),
        "security_level_target": "SL-1",
        "color": "#9C27B0",
        "device_count": 0,  # External — not owned assets
    },
]

# ── Zone conduits ─────────────────────────────────────────────────────────────

_CONDUITS: list[dict[str, Any]] = [
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000001")),
        "name": "Turbine-to-Bay-Controller",
        "source_zone": "PHYSICAL_PROCESS",
        "dest_zone": "BASIC_CONTROL",
        "allowed_protocols": ["IEC 61850-8-1 (MMS)", "IEC 61850-9-2 (Sampled Values)", "Profibus"],
        "encryption": "NONE",  # Acceptable at Level 0-1: physical isolation provides security
        "bidirectional": True,
        "criticality": "HIGH",
        "firewall_rules": [
            {
                "rule_id": "FR-001",
                "action": "ALLOW",
                "protocol": "IEC 61850 MMS",
                "source_port": "ANY",
                "dest_port": "102",
                "description": "MMS to bay controller",
            },
            {
                "rule_id": "FR-002",
                "action": "ALLOW",
                "protocol": "IEC 61850 GOOSE",
                "source_port": "ANY",
                "dest_port": "MULTICAST",
                "description": "GOOSE trip signals",
            },
        ],
    },
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000002")),
        "name": "Bay-Controller-to-SCADA",
        "source_zone": "BASIC_CONTROL",
        "dest_zone": "SCADA",
        "allowed_protocols": ["IEC 61850-8-1 (MMS)", "OPC-UA (port 4840)", "IEC 60870-5-104"],
        "encryption": "OPC-UA SecurityChannel (AES-256)",
        "bidirectional": True,
        "criticality": "HIGH",
        "firewall_rules": [
            {
                "rule_id": "FR-010",
                "action": "ALLOW",
                "protocol": "OPC-UA",
                "source_port": "ANY",
                "dest_port": "4840",
                "description": "OPC-UA binary protocol",
            },
            {
                "rule_id": "FR-011",
                "action": "DENY",
                "protocol": "ALL",
                "source_port": "ANY",
                "dest_port": "ANY",
                "description": "Default deny all other",
            },
        ],
    },
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000003")),
        "name": "SCADA-to-Historian",
        "source_zone": "SCADA",
        "dest_zone": "SITE_OPERATIONS",
        "allowed_protocols": ["OPC-UA Historical Access", "PostgreSQL (TLS)", "SFTP"],
        "encryption": "TLS 1.3",
        "bidirectional": False,  # Data flows only SCADA → Historian (one-way diode logic)
        "criticality": "MEDIUM",
        "firewall_rules": [
            {
                "rule_id": "FR-020",
                "action": "ALLOW",
                "protocol": "PostgreSQL",
                "source_port": "ANY",
                "dest_port": "5432",
                "description": "Database replication",
            },
        ],
    },
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000004")),
        "name": "DMZ-OT-IT-Bridge",
        "source_zone": "SITE_OPERATIONS",
        "dest_zone": "BUSINESS_NETWORK",
        "allowed_protocols": ["HTTPS (443)", "SFTP (22)", "SMTP relay (filtered)"],
        "encryption": "TLS 1.3",
        "bidirectional": False,  # OT → IT only; no IT → OT write access
        "criticality": "HIGH",
        "firewall_rules": [
            {
                "rule_id": "FR-030",
                "action": "ALLOW",
                "protocol": "HTTPS",
                "source_port": "ANY",
                "dest_port": "443",
                "description": "KPI dashboard export",
            },
            {
                "rule_id": "FR-031",
                "action": "DENY",
                "protocol": "ALL",
                "source_port": "ANY",
                "dest_port": "ANY",
                "description": "Block IT→OT write traffic",
            },
        ],
    },
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000005")),
        "name": "Remote-Access-VPN",
        "source_zone": "EXTERNAL",
        "dest_zone": "SITE_OPERATIONS",
        "allowed_protocols": ["IPSec VPN (IKEv2)", "SSH (22)"],
        "encryption": "IPSec (AES-256-GCM, SHA-384)",
        "bidirectional": True,
        "criticality": "HIGH",
        "firewall_rules": [
            {
                "rule_id": "FR-040",
                "action": "ALLOW",
                "protocol": "IPSec",
                "source_port": "ANY",
                "dest_port": "500,4500",
                "description": "VPN tunnel",
            },
            {
                "rule_id": "FR-041",
                "action": "LOG",
                "protocol": "ALL",
                "source_port": "ANY",
                "dest_port": "ANY",
                "description": "Log all VPN activity",
            },
        ],
    },
    {
        "id": str(uuid.UUID("10000000-0000-0000-0000-000000000006")),
        "name": "PSE-WAMS-Telemetry",
        "source_zone": "SCADA",
        "dest_zone": "EXTERNAL",
        "allowed_protocols": ["IEC 61968/61970 (CIM/XML)", "ICCP (TASE.2)", "HTTPS"],
        "encryption": "TLS 1.3",
        "bidirectional": False,  # Telemetry only outbound; TSO cannot write to farm
        "criticality": "MEDIUM",
        "firewall_rules": [
            {
                "rule_id": "FR-050",
                "action": "ALLOW",
                "protocol": "HTTPS",
                "source_port": "ANY",
                "dest_port": "443",
                "description": "CIM/XML to PSE WAMS",
            },
        ],
    },
]

# ── Attack scenarios ───────────────────────────────────────────────────────────

_ATTACK_SCENARIOS: dict[str, dict[str, Any]] = {
    "REPLAY_ATTACK": {
        "name": "IEC 61850 GOOSE Replay Attack",
        "attack_vector": "Layer 2 network — multicast GOOSE frame capture and replay",
        "steps": [
            {
                "step": 1,
                "action": "Attacker gains physical access to OSS LAN switch port (maintenance room)",
                "result": "Connected to Ethernet segment carrying IEC 61850 GOOSE multicast",
                "detected": False,
                "mitigating_control": "802.1X port authentication on all switch ports",
            },
            {
                "step": 2,
                "action": "Wireshark capture of GOOSE trip frame: CB1 OPEN command from protection relay",
                "result": "Frame captured with StNum=1, SqNum=0, GoID=IED_REL101_GGIO1",
                "detected": False,
                "mitigating_control": "Network TAP detection, switch port mirroring alerts",
            },
            {
                "step": 3,
                "action": "Replay captured frame with same StNum after 30-second delay",
                "result": "Breaker CB1 incorrectly opens — partial blackout of WTG array",
                "detected": True,
                "mitigating_control": "GOOSE StNum monotonic counter validation (IEC 61850 Ed2)",
            },
            {
                "step": 4,
                "action": "SCADA generates SOE entry: CB1 unexpected OPEN, no operator command",
                "result": "Anomaly detected; operator initiates investigation",
                "detected": True,
                "mitigating_control": "SOE recorder + alarm rationalization (M02/M09)",
            },
        ],
        "overall_blocked": True,
        "lessons_learned": [
            "IEC 61850 Edition 2 GOOSE requires StNum/SqNum validation against last known state",
            "Physical access control to OSS LAN is a critical security control",
            "GOOSE encryption (IEC 61850-90-15) eliminates replay risk at protocol level",
            "SOE recorder is the primary forensic tool for electrical security incidents",
        ],
        "iec62443_references": ["SR-3.1 Communication Integrity", "SR-5.1 Network Segmentation"],
    },
    "MITM_GOOSE": {
        "name": "Man-in-the-Middle on SCADA-to-Bay-Controller Link",
        "attack_vector": "ARP poisoning on BASIC_CONTROL to SCADA Ethernet segment",
        "steps": [
            {
                "step": 1,
                "action": "Compromised engineering workstation (Level 3) sends ARP poison to bay controller",
                "result": "ARP cache of bay controller updated: SCADA IP -> attacker MAC",
                "detected": False,
                "mitigating_control": "Dynamic ARP inspection (DAI) on managed switches",
            },
            {
                "step": 2,
                "action": "Attacker intercepts MMS GetDataValues request and modifies CB state values",
                "result": "SCADA sees CB1 = CLOSED when CB1 is actually OPEN",
                "detected": False,
                "mitigating_control": "OPC-UA SecurityChannel with mutual certificate authentication",
            },
            {
                "step": 3,
                "action": "Operator issues CLOSE command to CB1 believing it is open — double-close attempt",
                "result": "Interlock engine detects illegal state transition, blocks command (ILK-001)",
                "detected": True,
                "mitigating_control": "Interlock engine (M01) independent of SCADA telemetry",
            },
            {
                "step": 4,
                "action": "Blocked command generates security event; OPC-UA certificate mismatch detected",
                "result": "Incident response triggered; engineering workstation isolated",
                "detected": True,
                "mitigating_control": "Certificate pinning + SIEM correlation rule",
            },
        ],
        "overall_blocked": True,
        "lessons_learned": [
            "Interlock engine must remain independent and not trust SCADA-provided state",
            "OPC-UA mutual TLS prevents MITM at application layer",
            "Network-level ARP inspection is the first line of defence",
            "Defence-in-depth: even if MITM succeeds at L2, application-layer controls stop harm",
        ],
        "iec62443_references": [
            "SR-2.1 Authorization Enforcement",
            "SR-3.1 Communication Integrity",
        ],
    },
    "CREDENTIAL_BRUTE_FORCE": {
        "name": "Brute Force Attack on SCADA Web Interface",
        "attack_vector": "HTTP POST /login — automated credential stuffing from external IP",
        "steps": [
            {
                "step": 1,
                "action": "Automated scanner discovers SCADA web portal on port 443 via shodan.io",
                "result": "Login page identified; no CAPTCHA visible",
                "detected": False,
                "mitigating_control": "Network perimeter: SCADA should NOT be internet-accessible",
            },
            {
                "step": 2,
                "action": "Credential list of 10,000 username:password combinations submitted",
                "result": "After 47 attempts, WAF detects >10 failures/minute from same IP",
                "detected": True,
                "mitigating_control": "Web Application Firewall (WAF) rate limiting",
            },
            {
                "step": 3,
                "action": "Source IP blocked; attacker switches to rotating proxy (Tor exit nodes)",
                "result": "Rate limiting evaded; attempts resume at slower rate",
                "detected": True,
                "mitigating_control": "MFA (TOTP) — even correct password is insufficient without OTP",
            },
            {
                "step": 4,
                "action": "Correct password found in credential database; MFA prompt displayed",
                "result": "Attack stopped — cannot generate TOTP without physical token",
                "detected": True,
                "mitigating_control": "IEC 62443 SR-1.1: Human user identification and authentication",
            },
        ],
        "overall_blocked": True,
        "lessons_learned": [
            "SCADA systems must NEVER be directly internet-accessible",
            "Multi-factor authentication (MFA) is mandatory for any remote access (IEC 62443 SL-2+)",
            "Account lockout after N failures prevents brute force in air-gapped environments",
            "Credential stuffing attacks use real leaked passwords — enforce unique passwords + MFA",
        ],
        "iec62443_references": ["SR-1.1 Human User Identification", "SR-1.2 Software Process ID"],
    },
    "ROGUE_DEVICE": {
        "name": "Rogue IED Injection on IEC 61850 LAN",
        "attack_vector": "Physical insertion of rogue Raspberry Pi IED on OSS control LAN",
        "steps": [
            {
                "step": 1,
                "action": "Rogue device plugged into unmanned switch port during maintenance window",
                "result": "Device acquires DHCP address on BASIC_CONTROL VLAN 10",
                "detected": False,
                "mitigating_control": "DHCP snooping + 802.1X: only authenticated devices get IP",
            },
            {
                "step": 2,
                "action": "Rogue device publishes fake GOOSE dataset: BRK01_ST=TRUE (overcurrent event)",
                "result": "Some relays accept the dataset (no certificate validation)",
                "detected": False,
                "mitigating_control": "IEC 61850 Ed3 GOOSE with X.509 certificate authentication",
            },
            {
                "step": 3,
                "action": "Protection relay P1 acts on fake overcurrent: trips CB1",
                "result": "Unplanned outage of feeder; SOE records trip without primary fault",
                "detected": True,
                "mitigating_control": "SOE cross-correlation: trip without fault current signature = anomaly",
            },
            {
                "step": 4,
                "action": "Network switch detects new MAC not in whitelist; generates alert",
                "result": "Security event generated; port disabled; rogue device isolated",
                "detected": True,
                "mitigating_control": "MAC address whitelist enforcement + port security",
            },
        ],
        "overall_blocked": False,  # Damage occurred (trip) before detection
        "lessons_learned": [
            "Unmanaged switch ports are a critical physical vulnerability in OT environments",
            "IEC 61850 GOOSE publisher authentication (Ed3 security) prevents rogue IEDs",
            "MAC whitelist + port security provides fast detection of new devices",
            "In ICS: 'detect before damage' is often not achievable — defence-in-depth is essential",
        ],
        "iec62443_references": ["SR-5.2 Zone Boundary Protection", "SR-1.3 Account Management"],
    },
    "RANSOMWARE_IT_LATERAL": {
        "name": "Ransomware Lateral Movement IT-to-OT",
        "attack_vector": "Phishing email → IT compromise → DMZ pivot → SCADA historian",
        "steps": [
            {
                "step": 1,
                "action": "Finance employee opens malicious Excel attachment (macro dropper)",
                "result": "Cobalt Strike beacon installed on finance workstation (Level 4)",
                "detected": False,
                "mitigating_control": "Email sandboxing, macro disabling, user awareness training",
            },
            {
                "step": 2,
                "action": "Lateral movement via SMB (MS17-010 unpatched) to engineering workstation",
                "result": "Engineering workstation (Level 3 access) compromised",
                "detected": False,
                "mitigating_control": "Network segmentation: IT/OT VLANs; patch management",
            },
            {
                "step": 3,
                "action": "Attacker enumerates Level 3 network; discovers historian on 192.168.30.10",
                "result": "TimescaleDB credentials found in config file; historian encrypted",
                "detected": True,
                "mitigating_control": "Database credentials in vault (HashiCorp Vault), not config files",
            },
            {
                "step": 4,
                "action": "Ransomware attempts to pivot from historian to SCADA server",
                "result": "Application firewall on DMZ blocks historian→SCADA port 4840",
                "detected": True,
                "mitigating_control": "Unidirectional gateway (data diode) historian → SCADA; no return path",
            },
            {
                "step": 5,
                "action": "SCADA continues operating; historian restored from immutable backup",
                "result": "4-hour data gap; SCADA operational throughout; no production loss",
                "detected": True,
                "mitigating_control": "Immutable backups + SCADA independence from historian",
            },
        ],
        "overall_blocked": True,
        "lessons_learned": [
            "IT/OT network segmentation with DMZ is the most important ransomware defence",
            "SCADA must operate independently of historian (historian is data, not control)",
            "Credentials must never be stored in config files — use a secrets vault",
            "Immutable backups (write-once S3 or tape) are the last line of defence",
            "The OT system was protected by the DMZ even though IT was fully compromised",
        ],
        "iec62443_references": [
            "SR-5.1 Network Segmentation",
            "SR-7.3 Control System Backup",
            "SR-1.4 Identifier Management",
        ],
    },
}

# ── IEC 62443 compliance checklist ────────────────────────────────────────────

_COMPLIANCE_CHECKS: list[dict[str, Any]] = [
    # SL-1 requirements
    {
        "requirement_id": "SR-1.1",
        "security_level": "SL-1",
        "category": "Identification & Authentication",
        "description": "Human user identification and authentication for all SCADA accounts",
        "compliant": True,
        "evidence": "FastAPI JWT + RBAC (P3 SCADA)",
        "risk_score": 8.0,
    },
    {
        "requirement_id": "SR-1.2",
        "security_level": "SL-1",
        "category": "Identification & Authentication",
        "description": "Software process and device identification",
        "compliant": True,
        "evidence": "OPC-UA client certificates",
        "risk_score": 6.0,
    },
    {
        "requirement_id": "SR-1.3",
        "security_level": "SL-1",
        "category": "Identification & Authentication",
        "description": "Account management — disable inactive accounts within 30 days",
        "compliant": False,
        "evidence": None,
        "risk_score": 5.0,
    },
    {
        "requirement_id": "SR-2.1",
        "security_level": "SL-1",
        "category": "Use Control",
        "description": "Authorization enforcement — role-based access control",
        "compliant": True,
        "evidence": "RBAC service in P3 (admin/operator/viewer roles)",
        "risk_score": 9.0,
    },
    {
        "requirement_id": "SR-3.1",
        "security_level": "SL-1",
        "category": "System Integrity",
        "description": "Communication integrity — detect modification of communications",
        "compliant": False,
        "evidence": None,
        "risk_score": 8.0,
    },
    {
        "requirement_id": "SR-3.2",
        "security_level": "SL-1",
        "category": "System Integrity",
        "description": "Malicious code protection on SCADA workstations",
        "compliant": True,
        "evidence": "CrowdStrike EDR on all OT workstations",
        "risk_score": 7.0,
    },
    # SL-2 requirements
    {
        "requirement_id": "SR-1.7",
        "security_level": "SL-2",
        "category": "Identification & Authentication",
        "description": "Strength of password-based authentication — MFA for remote access",
        "compliant": False,
        "evidence": None,
        "risk_score": 9.0,
    },
    {
        "requirement_id": "SR-2.4",
        "security_level": "SL-2",
        "category": "Use Control",
        "description": "Mobile code — no unauthorised mobile code execution in OT network",
        "compliant": True,
        "evidence": "Whitelisting applied to SCADA server processes",
        "risk_score": 6.0,
    },
    {
        "requirement_id": "SR-3.3",
        "security_level": "SL-2",
        "category": "System Integrity",
        "description": "Security functionality verification — periodic scan of ICS components",
        "compliant": False,
        "evidence": None,
        "risk_score": 7.0,
    },
    {
        "requirement_id": "SR-4.1",
        "security_level": "SL-2",
        "category": "Data Confidentiality",
        "description": "Information confidentiality — encrypt data in transit",
        "compliant": True,
        "evidence": "TLS 1.3 on all SCADA-to-Historian and VPN conduits",
        "risk_score": 8.0,
    },
    {
        "requirement_id": "SR-5.1",
        "security_level": "SL-2",
        "category": "Restricted Data Flow",
        "description": "Network segmentation — Purdue model zones with firewall between each",
        "compliant": True,
        "evidence": "6-zone Purdue architecture implemented",
        "risk_score": 9.0,
    },
    {
        "requirement_id": "SR-6.1",
        "security_level": "SL-2",
        "category": "Timely Response",
        "description": "Audit log capacity — minimum 90 days security event retention",
        "compliant": False,
        "evidence": None,
        "risk_score": 5.0,
    },
    {
        "requirement_id": "SR-7.3",
        "security_level": "SL-2",
        "category": "Resource Availability",
        "description": "Control system backup — automated daily backup with offsite copy",
        "compliant": True,
        "evidence": "Daily PostgreSQL dump to immutable S3",
        "risk_score": 8.0,
    },
    # SL-3 requirements
    {
        "requirement_id": "SR-1.5",
        "security_level": "SL-3",
        "category": "Identification & Authentication",
        "description": "Authenticator management — hardware tokens for operator remote access",
        "compliant": False,
        "evidence": None,
        "risk_score": 8.0,
    },
    {
        "requirement_id": "SR-2.8",
        "security_level": "SL-3",
        "category": "Use Control",
        "description": "Auditable events — SIEM integration with real-time correlation",
        "compliant": False,
        "evidence": None,
        "risk_score": 7.0,
    },
]

# ── In-memory security event log ──────────────────────────────────────────────

_events: list[dict[str, Any]] = []


def get_zones() -> dict[str, Any]:
    """Return all Purdue Model security zones."""
    return {
        "zones": _ZONES,
        "ot_it_boundary": "SITE_OPERATIONS",
        "total_zones": len(_ZONES),
    }


def get_conduits() -> dict[str, Any]:
    """Return all zone conduits with firewall rules."""
    unencrypted = sum(1 for c in _CONDUITS if c["encryption"] == "NONE")
    return {
        "conduits": _CONDUITS,
        "total_conduits": len(_CONDUITS),
        "unencrypted_count": unencrypted,
    }


def simulate_attack(scenario_id: str, target_zone: str) -> dict[str, Any]:
    """
    Run an educational attack scenario simulation.

    Logs security events for each detected step.
    Returns narrative with lessons learned.
    """
    if scenario_id not in _ATTACK_SCENARIOS:
        available = list(_ATTACK_SCENARIOS.keys())
        raise ValueError(f"Unknown scenario '{scenario_id}'. Available: {available}")

    scenario = _ATTACK_SCENARIOS[scenario_id]
    now = datetime.now(UTC)
    events_generated = 0

    for step in scenario["steps"]:
        if step["detected"]:
            _events.append(
                {
                    "id": len(_events) + 1,
                    "timestamp_utc": now.isoformat(),
                    "event_type": _infer_event_type(scenario_id, step["step"]),
                    "source_zone": "EXTERNAL",
                    "source_ip": "192.168.99." + str(step["step"]),
                    "target_zone": target_zone,
                    "description": f"[{scenario_id}] Step {step['step']}: {step['action'][:80]}",
                    "blocked": step["mitigating_control"] != "NONE",
                    "severity": "HIGH",
                    "scenario_id": scenario_id,
                }
            )
            events_generated += 1

    return {
        "scenario_id": scenario_id,
        "scenario_name": scenario["name"],
        "attack_vector": scenario["attack_vector"],
        "targeted_zone": target_zone,
        "steps": scenario["steps"],
        "overall_blocked": scenario["overall_blocked"],
        "lessons_learned": scenario["lessons_learned"],
        "iec62443_references": scenario["iec62443_references"],
        "events_generated": events_generated,
    }


def get_security_events(limit: int = 50) -> dict[str, Any]:
    """Return recent security events."""
    recent = list(reversed(_events))[:limit]
    critical_count = sum(1 for e in recent if e["severity"] == "CRITICAL")
    unblocked = sum(1 for e in recent if not e["blocked"])
    return {
        "events": recent,
        "total": len(_events),
        "critical_count": critical_count,
        "unblocked_count": unblocked,
    }


def get_compliance() -> dict[str, Any]:
    """Return IEC 62443-3-3 compliance summary."""
    sl1_checks = [c for c in _COMPLIANCE_CHECKS if c["security_level"] == "SL-1"]
    sl2_checks = [c for c in _COMPLIANCE_CHECKS if c["security_level"] == "SL-2"]
    sl3_checks = [c for c in _COMPLIANCE_CHECKS if c["security_level"] == "SL-3"]

    sl1_score = 100.0 * sum(1 for c in sl1_checks if c["compliant"]) / max(1, len(sl1_checks))
    sl2_score = 100.0 * sum(1 for c in sl2_checks if c["compliant"]) / max(1, len(sl2_checks))
    sl3_score = 100.0 * sum(1 for c in sl3_checks if c["compliant"]) / max(1, len(sl3_checks))

    open_gaps = sum(1 for c in _COMPLIANCE_CHECKS if not c["compliant"])
    critical_gaps = [
        f"{c['requirement_id']}: {c['description'][:60]}"
        for c in _COMPLIANCE_CHECKS
        if not c["compliant"] and c["risk_score"] >= 8.0
    ]

    if sl2_score >= 80.0:
        overall_assessment = "COMPLIANT — SL-2 achieved; proceed to SL-3 gap analysis"
    elif sl2_score >= 60.0:
        overall_assessment = "PARTIAL — Address critical SL-2 gaps before compliance claim"
    else:
        overall_assessment = "NON-COMPLIANT — Significant SL-2 gaps require remediation programme"

    return {
        "standard": "IEC 62443-3-3:2013 System Security Requirements",
        "sl1_score_pct": round(sl1_score, 1),
        "sl2_score_pct": round(sl2_score, 1),
        "sl3_score_pct": round(sl3_score, 1),
        "target_sl": "SL-2",
        "checks": _COMPLIANCE_CHECKS,
        "open_gaps": open_gaps,
        "critical_gaps": critical_gaps,
        "overall_assessment": overall_assessment,
    }


def _infer_event_type(scenario_id: str, step: int) -> str:
    mapping: dict[str, str] = {
        "REPLAY_ATTACK": "REPLAY_ATTACK",
        "MITM_GOOSE": "ANOMALY",
        "CREDENTIAL_BRUTE_FORCE": "AUTH_FAIL",
        "ROGUE_DEVICE": "ANOMALY",
        "RANSOMWARE_IT_LATERAL": "BREACH",
    }
    return mapping.get(scenario_id, "ANOMALY")
