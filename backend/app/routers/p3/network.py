"""
Communication Network Architecture API endpoints — M15.

Endpoints
---------
GET    /api/v1/scada/network/topology    — Full OT network topology (nodes + links)
GET    /api/v1/scada/network/opcua       — OPC-UA address space summary
GET    /api/v1/scada/network/latency     — IEC 61850 latency budget analysis

Standards
---------
IEC 61850-90-5 — WAN communication for SCADA
IEC 62541      — OPC-UA unified architecture
IEC 62443      — OT cybersecurity zones and conduits
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.network import (
    LatencyBudgetResponse,
    NetworkTopologyResponse,
    OPCUANamespaceResponse,
)
from app.services.p3 import network as svc

router = APIRouter(tags=["M15 Communication Network"])


@router.get(
    "/network/topology",
    response_model=NetworkTopologyResponse,
    summary="Full OT communication network topology",
)
async def get_network_topology() -> NetworkTopologyResponse:
    """
    Return the complete OT communication network topology for Baltic Wind Alpha.

    **Three-tier OT network architecture:**

    **Tier 1 — Field Bus (WTG to OSS):**
    Each of the 34 turbines has an IEC 61850 Bay Unit IED connected by dedicated
    fibre to the offshore substation LAN switches. The turbine fibres run along
    the 66 kV inter-array cables. Ring topology means a single fibre cut does not
    isolate any turbine.

    **Tier 2 — Station Bus (OSS LAN):**
    Managed Ethernet switches in a ring (RSTP fast spanning tree, <50 ms recovery).
    IEC 61850 GOOSE runs here for protection coordination — 4 ms class P3 latency.
    The OPC-UA server on the OSS gateway aggregates all turbine data and exposes
    it as a unified address space (urn:baltic-wind:scada).

    **Tier 3 — WAN (OSS to Onshore, 45 km):**
    Primary: dedicated OPGW fibre in the export cable jacket.
    Propagation delay: 45 km × 5 µs/km = 0.225 ms.
    Backup: licensed microwave link (L-band, 100 Mbps, <1 ms path).
    Both paths use IPsec AES-256 tunnels terminating at firewalls (IEC 62443 conduit).

    **Tier 4 — Corporate / PSE:**
    PSE SCADA has read-only access via IEC 61968 MMS (ICCP protocol).
    This is a regulatory requirement under PSE IRiESP — the DSO/TSO must be able
    to monitor real-time generation at the POC.
    """
    result = svc.get_network_topology()
    return NetworkTopologyResponse(**result)


@router.get(
    "/network/opcua",
    response_model=OPCUANamespaceResponse,
    summary="OPC-UA address space summary (wind farm SCADA namespace)",
)
async def get_opcua_namespace() -> OPCUANamespaceResponse:
    """
    Return OPC-UA address space definition for the Baltic Wind SCADA gateway.

    **Why OPC-UA over traditional SCADA protocols?**

    Traditional SCADA used proprietary protocols (DNP3, Modbus) that require
    separate drivers for each vendor. OPC-UA provides:
    - Unified information model (objects, variables, methods)
    - Built-in security (certificates, SignAndEncrypt mode)
    - Platform-independent (binary TCP or WebSocket transport)
    - Semantic data — tags know their engineering units and update rates

    **Security policy: Basic256Sha256 / SignAndEncrypt**
    Every OPC-UA session requires mutual X.509 certificate authentication.
    No anonymous sessions in production — IEC 62443 SR-1.1 requirement.

    **Address space structure:**
    - `WindFarm.WTG-01...WTG-34`: 5 tags per turbine × 34 = 170 nodes
    - `WindFarm.GridMeter`: POC power, voltage, frequency
    - `WindFarm.BESS`: SOC, active power
    - Total: ~185 data nodes in namespace ns=2

    **Update intervals:**
    - 100 ms: power, voltage, frequency (IEC 61850 P2 class)
    - 200 ms: rotor speed
    - 1 s: operational status (IEC 61400-26 availability state)
    - 60 s: temperatures, counters

    The OPC-UA publisher pushes all 100 ms nodes to the onshore historian
    via OPC-UA PubSub (UDP multicast over the IPsec WAN tunnel).
    """
    result = svc.get_opcua_namespace()
    return OPCUANamespaceResponse(**result)


@router.get(
    "/network/latency",
    response_model=LatencyBudgetResponse,
    summary="IEC 61850 latency budget analysis for a message path",
)
async def get_latency_budget(
    path: int = Query(
        default=0,
        ge=0,
        le=2,
        description=(
            "Message path index: 0=GOOSE trip (P3, 4 ms), "
            "1=Measurement update (P2, 100 ms), 2=SCADA WAN poll (P1, 1 s)"
        ),
    ),
) -> LatencyBudgetResponse:
    """
    Return end-to-end latency budget for an IEC 61850 message path.

    **IEC 61850 performance classes:**

    | Class | Max latency | Typical use |
    |-------|-------------|-------------|
    | P3 | 4 ms | GOOSE protection trip |
    | P2 | 100 ms | Measurements, interlocking |
    | P1 | 1 s | SCADA polling, status |

    **GOOSE (Class P3) — why 4 ms matters:**

    A GOOSE trip message travels: protection IED → LAN switch → relay IED
    The relay must open the breaker within 80 ms total fault clearing time:
    - Detection: 20 ms
    - GOOSE transmission: ≤ 4 ms
    - Relay processing: 10 ms
    - Breaker opening: 30-50 ms

    If GOOSE latency exceeds 4 ms, the fault clearing time budget overruns,
    potentially causing transformer overtemperature or cable damage.

    **Switch hop latency:**
    Managed Ethernet switches in cut-through mode: 0.5 µs per hop.
    Store-and-forward (standard): up to 5 µs per 64-byte frame.
    For GOOSE, cut-through mode is mandatory on all P3 paths.

    **Fibre propagation:**
    Speed of light in fibre: ~200,000 km/s (refractive index 1.5).
    1 km fibre ≈ 5 µs one-way. For 50 m OSS internal cabling: ~0.25 µs.
    """
    result = svc.get_latency_budget(path)
    return LatencyBudgetResponse(**result)
