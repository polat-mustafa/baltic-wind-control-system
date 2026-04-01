"""
Cybersecurity API endpoints — M07 (IEC 62443).

Endpoints
---------
GET    /api/v1/scada/security/zones              — Purdue Model zone hierarchy
GET    /api/v1/scada/security/conduits           — Zone conduits + firewall rules
POST   /api/v1/scada/security/simulate-attack    — Educational attack scenario
GET    /api/v1/scada/security/events             — Security event log
GET    /api/v1/scada/security/compliance         — IEC 62443-3-3 compliance checklist

All scenarios are educational simulations — no real attacks are performed.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.security import (
    AttackScenarioRequest,
    AttackSimulationResponse,
    ComplianceSummaryResponse,
    ConduitsResponse,
    SecurityEventsResponse,
    ZonesResponse,
)
from app.services.p3 import security as svc

router = APIRouter(tags=["M07 Cybersecurity IEC 62443"])


@router.get(
    "/security/zones",
    response_model=ZonesResponse,
    summary="Purdue Model security zones (IEC 62443)",
)
async def get_zones() -> ZonesResponse:
    """
    Return the Baltic Wind Purdue Model zone hierarchy.

    **What is the Purdue Model?**

    The Purdue Enterprise Reference Architecture (ISA-95 / ISA-99) divides
    industrial systems into 6 levels based on function and required access:

    ```
    Level 5: EXTERNAL        (internet, cloud, PSE WAMS)
    Level 4: BUSINESS        (ERP, market bidding, corporate IT)
    === OT/IT BOUNDARY (DMZ) ===
    Level 3: SITE OPERATIONS (historian, engineering WS, patch server)
    Level 2: SCADA           (SCADA server, HMI, OPC-UA, PPC)
    Level 1: BASIC CONTROL   (bay controllers, PLCs, protection relays)
    Level 0: PHYSICAL PROCESS (turbine sensors, actuators, meters)
    ```

    **Why zones matter for Baltic Wind:**

    IEC 62443 requires that each zone has a defined Security Level (SL-0 to SL-4).
    The SCADA zone (Level 2) is the highest-value target — it can command
    all 34 WTGs and the OSS. It therefore requires SL-2:
    - Role-based access control (RBAC)
    - Audit trail of all commands
    - Encrypted communications (OPC-UA SecureChannel)
    - Account lockout and MFA for remote access

    The Basic Control zone (Level 1) must be hardened to SL-2 as well,
    because a compromised bay controller can directly trip circuit breakers
    without going through the SCADA layer.
    """
    result = svc.get_zones()
    return ZonesResponse(**result)


@router.get(
    "/security/conduits",
    response_model=ConduitsResponse,
    summary="Zone conduits and firewall rules",
)
async def get_conduits() -> ConduitsResponse:
    """
    Return all data paths between security zones with their firewall rules.

    **IEC 62443 conduit definition:**

    A conduit is a communication channel between two security zones.
    Each conduit must be explicitly defined, with:
    - Allowed protocols (whitelist — deny all others)
    - Encryption requirements
    - Firewall rules (source/dest port, action)
    - Directionality (unidirectional data diodes are the most secure)

    **Key conduits for Baltic Wind:**

    | Conduit | Direction | Encryption |
    |---------|-----------|------------|
    | Turbine → Bay Controller | Bidirectional | NONE (physical isolation) |
    | Bay Controller ↔ SCADA | Bidirectional | OPC-UA SecureChannel AES-256 |
    | SCADA → Historian | One-way | TLS 1.3 |
    | Historian → Business | One-way | TLS 1.3 (data diode logic) |
    | External → Site Ops | VPN only | IPSec AES-256-GCM |

    **Unidirectional conduits:**
    Where data must flow only one way (e.g., SCADA metrics to Historian),
    a data diode (hardware unidirectional gateway) provides the strongest
    assurance — physically impossible to send commands backwards.

    **Unencrypted conduits:**
    Level 0-1 connections (Profibus, GOOSE multicast) are not encrypted —
    acceptable because they are on physically isolated VLANs and short-range.
    IEC 61850 Edition 3 adds GOOSE encryption for environments requiring it.
    """
    result = svc.get_conduits()
    return ConduitsResponse(**result)


@router.post(
    "/security/simulate-attack",
    response_model=AttackSimulationResponse,
    summary="Educational attack scenario simulation",
)
async def simulate_attack(body: AttackScenarioRequest) -> AttackSimulationResponse:
    """
    Run an educational attack scenario step-by-step.

    **Available scenarios:**

    | ID | Name | Attack Vector |
    |----|------|---------------|
    | REPLAY_ATTACK | GOOSE Replay | Layer 2 GOOSE frame replay |
    | MITM_GOOSE | MITM on SCADA link | ARP poisoning |
    | CREDENTIAL_BRUTE_FORCE | Brute force | HTTP credential stuffing |
    | ROGUE_DEVICE | Rogue IED | Physical device injection |
    | RANSOMWARE_IT_LATERAL | IT→OT ransomware | Phishing → lateral movement |

    **What happens during simulation:**
    1. Steps are narrated: action taken by attacker and result
    2. Each detected step generates a security event in the event log
    3. Overall result: BLOCKED or PARTIAL BREACH
    4. Lessons learned + IEC 62443 requirement references

    **Educational purpose:**
    These scenarios demonstrate why each security control in the Purdue
    architecture exists. The interlock engine (M01), SOE recorder (M02),
    RBAC (P3), and OPC-UA encryption all appear as defences.

    **Try the scenarios in order of sophistication:**
    1. REPLAY_ATTACK — simple, demonstrates GOOSE vulnerability
    2. CREDENTIAL_BRUTE_FORCE — demonstrates MFA value
    3. RANSOMWARE_IT_LATERAL — most realistic, demonstrates IT/OT segmentation

    **No real attacks are performed.** All data is simulated in memory.
    Security events are logged to the in-memory event store (M07).
    """
    try:
        result = svc.simulate_attack(body.scenario_id, body.target_zone)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AttackSimulationResponse(**result)


@router.get(
    "/security/events",
    response_model=SecurityEventsResponse,
    summary="Security event log",
)
async def get_security_events(limit: int = 50) -> SecurityEventsResponse:
    """
    Return recent security events from the in-memory event log.

    Events are generated by:
    - Attack simulations (POST /simulate-attack)
    - Future: SCADA command validation failures
    - Future: OPC-UA certificate errors

    **Event types:**
    - AUTH_FAIL: Failed authentication attempt
    - BLOCKED_CMD: Interlock or authorization block
    - ANOMALY: Unexpected device behaviour
    - REPLAY_ATTACK: Duplicate frame detection
    - SCAN: Network port scan detected
    - BREACH: Potential unauthorised access

    **For a realistic demo:** run 2-3 attack simulations first, then call this
    endpoint to see the accumulated security event log.
    """
    result = svc.get_security_events(limit=limit)
    return SecurityEventsResponse(**result)


@router.get(
    "/security/compliance",
    response_model=ComplianceSummaryResponse,
    summary="IEC 62443-3-3 compliance checklist",
)
async def get_compliance() -> ComplianceSummaryResponse:
    """
    Return IEC 62443-3-3 system security requirements compliance status.

    **IEC 62443 Security Levels:**

    | Level | Description | Baltic Wind Target |
    |-------|-------------|-------------------|
    | SL-0  | No security requirements | N/A |
    | SL-1  | Protection against casual/coincidental violation | Level 3-5 zones |
    | SL-2  | Protection against intentional violation with simple means | Level 1-2 zones (OT) |
    | SL-3  | Protection against sophisticated means | Not currently required |
    | SL-4  | Protection against state-sponsored APT | Not in scope |

    **Baltic Wind target: SL-2 for all OT zones (Level 1 + Level 2).**

    The compliance checklist covers the 7 IEC 62443-3-3 Foundational Requirements:
    - FR1: Identification and Authentication Control
    - FR2: Use Control
    - FR3: System Integrity
    - FR4: Data Confidentiality
    - FR5: Restricted Data Flow
    - FR6: Timely Response to Events
    - FR7: Resource Availability

    **Key gaps for Baltic Wind (SL-2 target):**
    - SR-1.7: MFA for remote access (not yet implemented)
    - SR-3.1: GOOSE communication integrity (requires IEC 61850 Ed3)
    - SR-6.1: 90-day security log retention (TimescaleDB retention policy needed)

    **Roadmap to full SL-2:**
    1. Deploy TOTP MFA on all SCADA operator accounts
    2. Enable OPC-UA security mode: SignAndEncrypt (already supported in M03)
    3. Configure TimescaleDB retention policy: 90-day event log
    4. Annual penetration test (IEC 62443 SR-3.3)
    """
    result = svc.get_compliance()
    return ComplianceSummaryResponse(**result)
