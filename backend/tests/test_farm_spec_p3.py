"""P3 SCADA and the Digital Twin on the learner's farm (FarmSpec, X-Farm header).

- The 66 kV switchboard has one feeder bay per string, then incomer A, the bus
  coupler and incomer B; every farm keeps its own switchboard state.
- Historian, CMS, IEC 61850 devices / SCL, OT network, security zones and the
  OPC-UA tree follow the design; SB-510 (no header) is unchanged.
- The Digital Twin runs the farm's turbines on the site's Weibull wind.
"""

from __future__ import annotations

import asyncio
import json
import math
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from typing import Any
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models.scada import SOEEvent
from app.services.digital_twin import plant_simulator as plant
from app.services.p2.network_model import EXPORT_CABLE_1000, SB510, design
from app.services.p2.statcom_sizing import check_reactors
from app.services.p3 import bay_controller as bc
from app.services.p3 import historian
from app.services.p5.equipment_state import SwitchCommand, SwitchPosition

FOUR = check_reactors(design((2, 2, 2, 2), 20.0, 1.5))  # 8 turbines, 120 MW
GW = check_reactors(design((6,) * 12, 45.0))  # 1080 MW, 4 export circuits
FARM = {"strings": [2, 2, 2, 2], "export_km": 20, "array_km": 1.5}


def header(**extra: float) -> dict[str, str]:
    return {"X-Farm": quote(json.dumps({**FARM, **extra}))}


@pytest.fixture(autouse=True)
def fresh_bays():
    bc._initialise_bays()


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    # Bay commands write SOE events; use in-memory SQLite so CI needs no Postgres.
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    async def _create() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: SOEEvent.metadata.create_all(c, [SOEEvent.__table__]))

    asyncio.run(_create())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _session() -> Any:
        async with factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    yield TestClient(app)
    app.dependency_overrides.pop(get_session, None)
    asyncio.run(engine.dispose())


def test_switchboard_follows_the_strings():
    sb = [d["bay_id"] for d in bc.bay_definitions(SB510)]
    assert sb == [f"BAY-OSS-66-{i:02d}" for i in range(1, 10)]
    bays = {d["bay_id"]: d for d in bc.bay_definitions(FOUR)}
    assert len(bays) == 7  # 4 feeders + incomer A, coupler, incomer B
    assert bays["BAY-OSS-66-02"]["description"].endswith("(busbar section A)")
    assert bays["BAY-OSS-66-03"]["description"].startswith("Feeds WTG-05 to WTG-06")
    assert bays["BAY-OSS-66-03"]["description"].endswith("(busbar section B)")
    assert bays["BAY-OSS-66-05"]["cb_id"] == "CB-TX-OSS-LV"
    assert bays["BAY-OSS-66-06"]["is_tie_cb"]
    assert bays["BAY-OSS-66-07"]["cb_id"] == "CB-TX-OSS-02-LV"
    assert f"{FOUR.oss_trafo_mva:.0f} MVA" in bays["BAY-OSS-66-05"]["description"]


def test_each_farm_has_its_own_switchboard():
    cmd = SwitchCommand(equipment_id="CB-STR-01", action="open", operator_id="t")
    bc.execute_command("BAY-OSS-66-01", cmd, spec=FOUR)
    assert bc.get_bay_state("BAY-OSS-66-01", FOUR).circuit_breaker == SwitchPosition.OPEN
    assert bc.get_bay_state("BAY-OSS-66-01").circuit_breaker == SwitchPosition.CLOSED  # SB-510
    # ILK-007 on the own farm: coupler 06 between incomers 05 and 07
    assert not bc.validate_command("BAY-OSS-66-06", "CB-TIE-66-01", "close", spec=FOUR).allowed
    with pytest.raises(Exception, match="not found"):
        bc.get_bay_state("BAY-OSS-66-08", FOUR)


def test_bays_api_uses_the_header(client: TestClient):
    bays = client.get("/api/v1/scada/bays", headers=header()).json()
    assert bays["total"] == 7
    r = client.post(
        "/api/v1/scada/bays/BAY-OSS-66-06/command",
        json={"equipment_id": "CB-TIE-66-01", "action": "close", "operator_id": "t"},
        headers=header(),
    )
    assert r.status_code == 409 and "ILK-007" in r.text
    assert client.get("/api/v1/scada/bays").json()["total"] == 9


def test_historian_follows_the_design():
    tags = historian.tag_registry(FOUR)
    assert tags[historian.T.OSS_TOTAL_POWER_MW].range_max == 120.0
    assert tags[historian.T.STATCOM_Q_MVAR].range_max == FOUR.statcom_mvar
    assert historian.tag_registry(SB510) is historian.TAG_REGISTRY
    i_rated = EXPORT_CABLE_1000.max_i_ka
    for spec in (FOUR, GW):
        for m in range(0, 30_000, 211):
            s = historian.plant_state(m, spec)
            assert abs(s[historian.T.STATCOM_Q_MVAR]) <= spec.statcom_mvar
            assert s[historian.T.OSS_TOTAL_POWER_MW] <= spec.capacity_mw
            assert s[historian.T.OSS_CURRENT_KA] < i_rated  # per circuit, kA
    # 4 strings of 2: string 1 feeder ≤ 2 × 15 MW at 66 kV
    peak = max(
        historian.plant_state(m, FOUR)[historian.T.ARRAY_CABLE_CURRENT_A]
        for m in range(0, 30_000, 211)
    )
    assert peak <= 2 * 15e3 / (math.sqrt(3) * 66.0) + 1e-6


def test_cms_devices_scl_follow_the_turbines(client: TestClient):
    fleet = client.get("/api/v1/scada/cms/fleet/overview", headers=header()).json()
    assert len(fleet["turbines"]) == 8
    assert (
        client.get("/api/v1/scada/cms/turbines/WTG-09/health", headers=header()).status_code == 404
    )
    assert client.get("/api/v1/scada/cms/turbines/WTG-09/health").status_code == 200  # SB-510
    devices = client.get("/api/v1/scada/devices", headers=header()).json()
    assert devices["total_devices"] == 3 + 8 and devices["wtg_controllers"] == 8
    scd = client.post("/api/v1/scada/scl-generate", json={"file_type": "SCD"}, headers=header())
    root = ET.fromstring(scd.json()["xml_content"])
    bays = {b.get("name") for b in root.iter() if b.tag.endswith("}Bay")}
    assert "BAY-OSS-66-07" in bays and "BAY-OSS-66-08" not in bays
    # OSS reactors only (one per export circuit); their onshore twins are onshore bays
    assert {f"Q-R{i}" for i in range(1, FOUR.reactors_per_end + 1)} <= bays


def test_network_security_opcua_follow_the_farm(client: TestClient):
    wan = client.get("/api/v1/scada/network/latency?path=2", headers=header()).json()
    assert wan["budget_breakdown"]["fibre_propagation_ms"] == pytest.approx(20 * 0.005)
    topo = client.get("/api/v1/scada/network/topology", headers=header()).json()
    assert {"WTG-IED-01", "WTG-IED-04", "WTG-IED-08"} <= {n["node_id"] for n in topo["nodes"]}
    zones = client.get("/api/v1/scada/security/zones", headers=header()).json()["zones"]
    assert zones[0]["device_count"] == 8 * 5
    assert zones[1]["device_count"] == 7 + 8 + 10
    tree = client.get("/api/v1/scada/opcua/address-space", headers=header()).json()
    turbines = tree["root_nodes"][0]["children"][1]["children"]
    assert sum(n["node_class"] == "Object" for n in turbines) == 8


def test_twin_scenarios_spread_over_a_small_farm():
    s = plant.scenario_for("combined", 8)
    ids = [t for inj in s.injections for t in inj.turbine_ids]
    assert sorted(ids) == list(range(8))  # every fault on its own turbine
    assert "WTG-01 to WTG-04" in plant.scenario_for("rotor_icing", 8).description
    assert plant.scenario_for("combined", 34) is plant.SCENARIOS["combined"]


def test_twin_api_runs_the_farm_on_its_site_wind(client: TestClient):
    h = header(wind_a=9.2, wind_k=2.1)
    body = client.post(
        "/api/v1/digital-twin/analyze", json={"scenario": "combined", "duration_days": 2}, headers=h
    ).json()
    assert len(body["turbines"]) == 8
    assert len(body["health_trend"]["health"]) == 8
    detail = {"scenario": "combined", "duration_days": 2, "turbine_id": 8}
    assert (
        client.post("/api/v1/digital-twin/turbine-detail", json=detail, headers=h).status_code
        == 404
    )
    card = client.get("/api/v1/digital-twin/config", headers=h).json()
    assert "a = 9.2 m/s, k = 2.1" in json.dumps(card)
