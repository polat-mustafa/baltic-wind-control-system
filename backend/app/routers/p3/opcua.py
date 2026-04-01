"""
OPC-UA server management API endpoints — M03.

Endpoints
---------
GET  /api/v1/scada/opcua/status         — Server status (running/stopped, connected clients)
GET  /api/v1/scada/opcua/address-space  — Browse address space as JSON tree
POST /api/v1/scada/opcua/restart        — Restart the OPC-UA server

The actual OPC-UA communication happens on port 4840 via the binary UA
protocol. These HTTP endpoints expose management and monitoring only.

To connect a UA client (e.g. UaExpert):
    Endpoint: opc.tcp://localhost:4840/baltic-wind/
    Security Policy: None (development) or Basic256Sha256 (production)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.opcua import OPCUAAddressSpaceResponse, OPCUAStatusResponse
from app.services.p3 import opcua_server as svc

router = APIRouter(tags=["M03 OPC-UA Server"])


@router.get(
    "/opcua/status",
    response_model=OPCUAStatusResponse,
    summary="OPC-UA server status",
)
async def get_opcua_status() -> OPCUAStatusResponse:
    """Return current OPC-UA server runtime status.

    Provides:
    - Running/stopped state
    - Number of connected UA clients
    - Total nodes in the address space
    - Startup time and last tag-push time

    A stopped server indicates asyncua is not installed or startup failed.
    The REST API continues to work regardless — OPC-UA is an optional
    integration layer on top of the HTTP API.
    """
    return svc.get_status()


@router.get(
    "/opcua/address-space",
    response_model=OPCUAAddressSpaceResponse,
    summary="Browse OPC-UA address space",
)
async def get_address_space() -> OPCUAAddressSpaceResponse:
    """Return the complete OPC-UA address space as a JSON tree.

    The address space mirrors the Baltic Wind Alpha physical topology:
    - WindFarm/Substation/Bay01..Bay08/ — OSS 66 kV switchboard bays
    - WindFarm/Turbines/WTG01..WTG34/ — individual wind turbine controllers

    Each leaf Variable node carries:
    - node_id: OPC-UA NodeId (can be used directly in UA client subscriptions)
    - data_type: UA data type (Double, Boolean, String)
    - value: current tag value

    IEC 61400-25 specifies the wind turbine information model (WTTR, WTUR,
    WNAC, WROT logical nodes) which this address space approximates.
    """
    return svc.get_address_space()


@router.post(
    "/opcua/restart",
    response_model=OPCUAStatusResponse,
    summary="Restart OPC-UA server",
)
async def restart_opcua_server() -> OPCUAStatusResponse:
    """Stop and restart the OPC-UA server background task.

    Use this after configuration changes or to recover from a fault
    condition. The server task is re-created as a new asyncio task;
    connected clients will be dropped and must reconnect.

    Production systems typically handle this via a watchdog daemon
    rather than an HTTP endpoint — this endpoint is provided for the
    SCADA training environment.
    """
    await svc.stop_server()
    await svc.start_server()
    return svc.get_status()
