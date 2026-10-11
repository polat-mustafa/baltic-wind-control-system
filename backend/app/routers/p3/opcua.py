"""
OPC-UA server management API endpoints — M03.

Endpoints
---------
GET  /api/v1/scada/opcua/status         — Server status (running/stopped, connected clients)
GET  /api/v1/scada/opcua/address-space  — Browse address space as JSON tree

The actual OPC-UA communication happens on port 4840 via the binary UA
protocol. These HTTP endpoints expose management and monitoring only.

To connect a UA client (e.g. UaExpert):
    Endpoint: opc.tcp://localhost:4840/offshoreforge/
    Security Policy: None (development) or Basic256Sha256 (production)
"""

from __future__ import annotations

from fastapi import APIRouter

from app.routers.farm_spec import FarmSpecDep
from app.schemas.opcua import OPCUAAddressSpaceResponse, OPCUAStatusResponse
from app.services.p3 import opcua_server as svc
from app.services.p3.historian import prefetch_site_wind

router = APIRouter(tags=["M03 OPC-UA Server"])


@router.get(
    "/opcua/status",
    response_model=OPCUAStatusResponse,
    summary="OPC-UA server status",
)
async def get_opcua_status(spec: FarmSpecDep) -> OPCUAStatusResponse:
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
    return svc.get_status(spec)


@router.get(
    "/opcua/address-space",
    response_model=OPCUAAddressSpaceResponse,
    summary="Browse OPC-UA address space",
)
async def get_address_space(spec: FarmSpecDep) -> OPCUAAddressSpaceResponse:
    """Return the complete OPC-UA address space as a JSON tree.

    The address space mirrors the SB-510 physical topology:
    - WindFarm/Substation/Bay01..Bay08/ — OSS 66 kV switchboard bays
    - WindFarm/Turbines/WTG01..WTG34/ — individual wind turbine controllers

    Each leaf Variable node carries:
    - node_id: OPC-UA NodeId (can be used directly in UA client subscriptions)
    - data_type: UA data type (Double, Boolean, String)
    - value: current tag value

    IEC 61400-25 specifies the wind turbine information model (WTTR, WTUR,
    WNAC, WROT logical nodes) which this address space approximates.
    """
    await prefetch_site_wind()
    return svc.get_address_space(spec)
