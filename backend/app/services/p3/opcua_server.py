"""
OPC-UA server service — M03.

Exposes the SB-510 control system over OPC-UA so that any
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

Address Space Layout (SB-510; the REST tree follows the farm, the asyncua server is SB-510)
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
import zlib
from datetime import UTC, datetime

from app.schemas.opcua import OPCUAAddressSpaceResponse, OPCUANodeInfo, OPCUAStatusResponse
from app.services.p1.turbine_models import get_turbine
from app.services.p2.network_model import SB510, FarmSpec

log = logging.getLogger(__name__)

# OPC-UA endpoint configuration
_ENDPOINT = "opc.tcp://0.0.0.0:4840/offshoreforge/"
_NAMESPACE = "https://offshoreforge.example.com/scada"

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


def _build_address_space_spec(farm: FarmSpec = SB510) -> list[OPCUANodeInfo]:
    """
    Build a declarative specification of every node in the address space.

    Returns the tree as plain Python objects so the REST API can serve
    it without requiring asyncua to be running (graceful degradation).
    """
    # Live values: switchgear from the bay controllers, process values from
    # the historian's plant model (the same state the historian trends)
    from app.services.p3 import bay_controller, historian

    def var(path: str, name: str, dtype: str, value: object) -> OPCUANodeInfo:
        return OPCUANodeInfo(
            node_id=f"ns=2;s={path}.{name}",
            browse_name=name,
            node_class="Variable",
            data_type=dtype,
            value=value,
        )

    bay_nodes = []
    for bay in sorted(bay_controller.get_all_bays(farm), key=lambda b: b.bay_id):
        path = f"WindFarm.Substation.{bay.bay_id}"
        bay_nodes.append(
            OPCUANodeInfo(
                node_id=f"ns=2;s={path}",
                browse_name=bay.bay_id,
                node_class="Object",
                children=[
                    var(path, "CB_State", "String", bay.circuit_breaker.value),
                    var(path, "DS_Bus_State", "String", bay.disconnector_bus.value),
                    var(path, "DS_Line_State", "String", bay.disconnector_line.value),
                    var(path, "ES_State", "String", bay.earth_switch.value),
                    var(path, "BayMode", "String", bay.bay_mode.value),
                ],
            )
        )

    minute = int(datetime.now(UTC).timestamp() // 60)
    u = historian.wind_speed(minute)
    plant = historian.plant_state(minute, farm)
    turbine_nodes = []
    total_mw = 0.0
    for wtg_num in range(1, farm.num_turbines + 1):
        wtg_id = f"WTG{wtg_num:02d}"
        path = f"WindFarm.Turbines.{wtg_id}"
        # deterministic wake deficit 0-12 % per position
        u_i = u * (1 - (zlib.crc32(wtg_id.encode()) % 13) / 100)
        p_mw = historian.power_curve_mw(u_i)
        total_mw += p_mw
        running = p_mw > 0
        rpm = get_turbine().operating_point(u_i)["rotor_rpm"] if running else 0.0
        turbine_nodes.append(
            OPCUANodeInfo(
                node_id=f"ns=2;s={path}",
                browse_name=wtg_id,
                node_class="Object",
                children=[
                    var(path, "ActivePower_MW", "Double", round(p_mw, 2)),
                    var(path, "ReactivePower_MVAR", "Double", 0.0),
                    var(path, "WindSpeed_ms", "Double", round(u_i, 2)),
                    var(path, "RotorSpeed_rpm", "Double", round(rpm, 2)),
                    var(path, "State", "String", "RUNNING" if running else "STOPPED"),
                ],
            )
        )
    busbar_kv = round(220.0 * plant[historian.HistorianTag.OSS_VOLTAGE_PU], 1)
    total_mw = round(total_mw, 1)

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
                        var("WindFarm.Substation", "Busbar_Voltage_kV", "Double", busbar_kv),
                        *bay_nodes,
                    ],
                ),
                OPCUANodeInfo(
                    node_id="ns=2;s=WindFarm.Turbines",
                    browse_name="Turbines",
                    node_class="Object",
                    children=[
                        var("WindFarm.Turbines", "TotalPower_MW", "Double", total_mw),
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
        from asyncua.server.server import Server
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
    server.set_server_name("SB-510 SCADA OPC-UA Server")

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


def get_status(farm: FarmSpec = SB510) -> OPCUAStatusResponse:
    """Return current OPC-UA server status for the REST API."""
    spec = _build_address_space_spec(farm)
    total = _count_nodes(spec)
    return OPCUAStatusResponse(
        running=_server_running,
        endpoint=_ENDPOINT,
        connected_clients=_connected_clients,
        node_count=total,
        started_at=_started_at,
        last_update=_last_update,
    )


def get_address_space(farm: FarmSpec = SB510) -> OPCUAAddressSpaceResponse:
    """Return the full address space as a JSON tree for REST clients."""
    spec = _build_address_space_spec(farm)
    return OPCUAAddressSpaceResponse(
        endpoint=_ENDPOINT,
        root_nodes=spec,
        total_nodes=_count_nodes(spec),
    )
