"""
OPC-UA server service — M03.

Exposes the Baltic Wind Alpha control system over OPC-UA so that any
compliant SCADA client (Ignition, WinCC, UaExpert) can browse, read,
and write tags via the standardised UA binary protocol.

Physics — Why OPC-UA?
----------------------
IEC 61400-25 mandates OPC-UA as the interoperability layer for wind farm
data exchange. Unlike Modbus (register-based, no semantics) or SOAP-based
web services (fire-and-forget), OPC-UA provides:

  1. Unified address space — tags are self-describing nodes with type,
     unit, engineering range, and alarm limits embedded in the model.
  2. Subscriptions — client registers interest in a node; server only
     sends updates when value changes (Δ-trigger or time-trigger).
     This is critical for bandwidth-limited satellite links to offshore
     substations (typically 10–100 Mbit/s, shared).
  3. Security — each session has a security policy (None / Basic256Sha256)
     and user authentication. IEC 62443 SL-2 requires encryption for
     remote connections.
  4. Historical access — OPC-UA HDA lets clients query time-series data
     from the historian without a separate API.

Address Space Layout (Baltic Wind Alpha)
-----------------------------------------
WindFarm/
  ├── Substation/
  │     ├── Bay01/ … Bay08/
  │     │     ├── CB_State        (Boolean)
  │     │     ├── DS_Bus_State    (Boolean)
  │     │     ├── DS_Line_State   (Boolean)
  │     │     ├── ES_State        (Boolean)
  │     │     ├── ActivePower_MW  (Double)
  │     │     └── BayMode         (String)
  │     └── Busbar_Voltage_kV    (Double)
  └── Turbines/
        ├── WTG01/ … WTG34/
        │     ├── ActivePower_MW   (Double)
        │     ├── ReactivePower_MVAR (Double)
        │     ├── WindSpeed_ms     (Double)
        │     ├── RotorSpeed_rpm   (Double)
        │     └── State            (String)
        └── TotalPower_MW         (Double)

Standard: IEC 61400-25, OPC UA Part 8 (IEC 62541-8), IEC 62443-3-3 SL-2.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from datetime import UTC, datetime

from app.schemas.opcua import OPCUAAddressSpaceResponse, OPCUANodeInfo, OPCUAStatusResponse

log = logging.getLogger(__name__)

# OPC-UA endpoint configuration
_ENDPOINT = "opc.tcp://0.0.0.0:4840/baltic-wind/"
_NAMESPACE = "https://baltic-wind-alpha.example.com/scada"

# ── Server singleton state ────────────────────────────────────────

_server_task: asyncio.Task | None = None  # type: ignore[type-arg]
_server_running: bool = False
_connected_clients: int = 0
_node_count: int = 0
_started_at: datetime | None = None
_last_update: datetime | None = None

# Holds a reference to the asyncua Server object (if available)
_ua_server = None


# ── Address-space definition ──────────────────────────────────────


def _build_address_space_spec() -> list[OPCUANodeInfo]:
    """
    Build a declarative specification of every node in the address space.

    Returns the tree as plain Python objects so the REST API can serve
    it without requiring asyncua to be running (graceful degradation).
    """
    bay_nodes = []
    for bay_num in range(1, 9):
        bay_id = f"BAY-OSS-66-{bay_num:02d}"
        bay_nodes.append(
            OPCUANodeInfo(
                node_id=f"ns=2;s=WindFarm.Substation.{bay_id}",
                browse_name=bay_id,
                node_class="Object",
                children=[
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.CB_State",
                        browse_name="CB_State",
                        node_class="Variable",
                        data_type="Boolean",
                        value=False,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.DS_Bus_State",
                        browse_name="DS_Bus_State",
                        node_class="Variable",
                        data_type="Boolean",
                        value=False,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.DS_Line_State",
                        browse_name="DS_Line_State",
                        node_class="Variable",
                        data_type="Boolean",
                        value=False,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.ES_State",
                        browse_name="ES_State",
                        node_class="Variable",
                        data_type="Boolean",
                        value=True,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.ActivePower_MW",
                        browse_name="ActivePower_MW",
                        node_class="Variable",
                        data_type="Double",
                        value=0.0,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Substation.{bay_id}.BayMode",
                        browse_name="BayMode",
                        node_class="Variable",
                        data_type="String",
                        value="REMOTE",
                    ),
                ],
            )
        )

    turbine_nodes = []
    for wtg_num in range(1, 35):
        wtg_id = f"WTG{wtg_num:02d}"
        turbine_nodes.append(
            OPCUANodeInfo(
                node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}",
                browse_name=wtg_id,
                node_class="Object",
                children=[
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}.ActivePower_MW",
                        browse_name="ActivePower_MW",
                        node_class="Variable",
                        data_type="Double",
                        value=0.0,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}.ReactivePower_MVAR",
                        browse_name="ReactivePower_MVAR",
                        node_class="Variable",
                        data_type="Double",
                        value=0.0,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}.WindSpeed_ms",
                        browse_name="WindSpeed_ms",
                        node_class="Variable",
                        data_type="Double",
                        value=0.0,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}.RotorSpeed_rpm",
                        browse_name="RotorSpeed_rpm",
                        node_class="Variable",
                        data_type="Double",
                        value=0.0,
                    ),
                    OPCUANodeInfo(
                        node_id=f"ns=2;s=WindFarm.Turbines.{wtg_id}.State",
                        browse_name="State",
                        node_class="Variable",
                        data_type="String",
                        value="STOPPED",
                    ),
                ],
            )
        )

    return [
        OPCUANodeInfo(
            node_id="ns=2;s=WindFarm",
            browse_name="WindFarm",
            node_class="Object",
            children=[
                OPCUANodeInfo(
                    node_id="ns=2;s=WindFarm.Substation",
                    browse_name="Substation",
                    node_class="Object",
                    children=[
                        OPCUANodeInfo(
                            node_id="ns=2;s=WindFarm.Substation.Busbar_Voltage_kV",
                            browse_name="Busbar_Voltage_kV",
                            node_class="Variable",
                            data_type="Double",
                            value=0.0,
                        ),
                        *bay_nodes,
                    ],
                ),
                OPCUANodeInfo(
                    node_id="ns=2;s=WindFarm.Turbines",
                    browse_name="Turbines",
                    node_class="Object",
                    children=[
                        OPCUANodeInfo(
                            node_id="ns=2;s=WindFarm.Turbines.TotalPower_MW",
                            browse_name="TotalPower_MW",
                            node_class="Variable",
                            data_type="Double",
                            value=0.0,
                        ),
                        *turbine_nodes,
                    ],
                ),
            ],
        )
    ]


def _count_nodes(nodes: list[OPCUANodeInfo]) -> int:
    """Recursively count all nodes in the address space."""
    total = len(nodes)
    for node in nodes:
        total += _count_nodes(node.children)
    return total


# ── asyncua server implementation ────────────────────────────────


async def _run_ua_server() -> None:
    """
    Background asyncio task that starts and runs the OPC-UA server.

    Attempts to import asyncua. If unavailable (e.g. not yet installed),
    logs a warning and marks server as unavailable without crashing the
    FastAPI application — the REST API still works, OPC-UA is just disabled.
    """
    global _server_running, _connected_clients, _started_at, _last_update, _ua_server

    try:
        from asyncua import Server
    except ImportError:
        log.warning(
            "asyncua not installed — OPC-UA server disabled. "
            "Install with: pip install asyncua>=1.1.0"
        )
        return

    server = Server()
    _ua_server = server

    await server.init()
    server.set_endpoint(_ENDPOINT)
    server.set_server_name("Baltic Wind Alpha SCADA OPC-UA Server")

    # Register our application namespace
    idx = await server.register_namespace(_NAMESPACE)

    # Build the address space from the declarative spec
    objects = server.get_objects_node()
    wind_farm_obj = await objects.add_object(idx, "WindFarm")

    # Substation folder
    substation_obj = await wind_farm_obj.add_object(idx, "Substation")
    await substation_obj.add_variable(idx, "Busbar_Voltage_kV", 0.0)

    for bay_num in range(1, 9):
        bay_id = f"BAY-OSS-66-{bay_num:02d}"
        bay_obj = await substation_obj.add_object(idx, bay_id)
        cb_var = await bay_obj.add_variable(idx, "CB_State", False)
        ds_bus_var = await bay_obj.add_variable(idx, "DS_Bus_State", False)
        ds_line_var = await bay_obj.add_variable(idx, "DS_Line_State", False)
        es_var = await bay_obj.add_variable(idx, "ES_State", True)
        pwr_var = await bay_obj.add_variable(idx, "ActivePower_MW", 0.0)
        mode_var = await bay_obj.add_variable(idx, "BayMode", "REMOTE")

        # Make variables writable (operators can send commands via OPC-UA)
        # In production, write access would be gated behind security policy
        for var in (cb_var, ds_bus_var, ds_line_var, es_var, pwr_var, mode_var):
            await var.set_writable()

    # Turbine folder
    turbines_obj = await wind_farm_obj.add_object(idx, "Turbines")
    await turbines_obj.add_variable(idx, "TotalPower_MW", 0.0)

    for wtg_num in range(1, 35):
        wtg_id = f"WTG{wtg_num:02d}"
        wtg_obj = await turbines_obj.add_object(idx, wtg_id)
        for tag_name, init_val in [
            ("ActivePower_MW", 0.0),
            ("ReactivePower_MVAR", 0.0),
            ("WindSpeed_ms", 0.0),
            ("RotorSpeed_rpm", 0.0),
        ]:
            await wtg_obj.add_variable(idx, tag_name, init_val)
        await wtg_obj.add_variable(idx, "State", "STOPPED")

    _node_count = _count_nodes(_build_address_space_spec())

    async with server:
        _server_running = True
        _started_at = datetime.now(UTC)
        log.info("OPC-UA server started on %s (%d nodes)", _ENDPOINT, _node_count)

        # Keep alive loop — pushes simulated tag refreshes every 5 s
        while True:
            _last_update = datetime.now(UTC)

            # In a production system this would read from Redis/TimescaleDB
            # and push real-time values into the UA address space nodes.
            # For the demo, values remain at their initial defaults.

            await asyncio.sleep(5)


# ── Public API ────────────────────────────────────────────────────


async def start_server() -> None:
    """
    Start the OPC-UA server as a background asyncio task.

    Called from the FastAPI lifespan startup handler. Safe to call
    multiple times — subsequent calls are no-ops if already running.
    """
    global _server_task

    if _server_task is not None and not _server_task.done():
        log.debug("OPC-UA server already running — ignoring start request")
        return

    _server_task = asyncio.create_task(_run_ua_server(), name="opcua-server")
    log.info("OPC-UA server task created")


async def stop_server() -> None:
    """
    Gracefully stop the OPC-UA server.

    Called from the FastAPI lifespan shutdown handler.
    """
    global _server_task, _server_running, _ua_server

    _server_running = False

    if _ua_server is not None:
        with contextlib.suppress(Exception):
            await _ua_server.stop()
        _ua_server = None

    if _server_task is not None and not _server_task.done():
        _server_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _server_task
        _server_task = None

    log.info("OPC-UA server stopped")


def get_status() -> OPCUAStatusResponse:
    """Return current OPC-UA server status for the REST API."""
    spec = _build_address_space_spec()
    total = _count_nodes(spec)
    return OPCUAStatusResponse(
        running=_server_running,
        endpoint=_ENDPOINT,
        connected_clients=_connected_clients,
        node_count=total,
        started_at=_started_at,
        last_update=_last_update,
    )


def get_address_space() -> OPCUAAddressSpaceResponse:
    """Return the full address space as a JSON tree for REST clients."""
    spec = _build_address_space_spec()
    return OPCUAAddressSpaceResponse(
        endpoint=_ENDPOINT,
        root_nodes=spec,
        total_nodes=_count_nodes(spec),
    )
