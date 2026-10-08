"""/api/v1/projects — saved own projects (anonymous link), on an in-memory SQLite DB."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models.wind_farm import AEPResult, PerTurbineAEP, TurbinePosition, WindFarm
from app.models.wind_resource import WindResource
from app.routers import projects
from app.seed import FARM_UUID

URL = "/api/v1/projects"
D = 241.35  # IEA-15-240-RWT rotor [m]
TABLES = [t.__table__ for t in (WindFarm, TurbinePosition, AEPResult, PerTurbineAEP, WindResource)]


@pytest.fixture
def db() -> Iterator[async_sessionmaker[Any]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(conn: Any, _rec: Any) -> None:  # ON DELETE CASCADE needs this in SQLite
        conn.execute("PRAGMA foreign_keys=ON")

    async def _create() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: WindFarm.metadata.create_all(c, tables=TABLES))

    asyncio.run(_create())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _session() -> Any:
        async with factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    projects._hits.clear()
    yield factory
    app.dependency_overrides.pop(get_session, None)
    asyncio.run(engine.dispose())


@pytest.fixture
def client(db: Any) -> TestClient:
    return TestClient(app)


def _run(factory: Any, fn: Any) -> Any:
    async def go() -> Any:
        async with factory() as s:
            return await fn(s)

    return asyncio.run(go())


def _row(lon: float, lat: float, n: int, spacing_d: float = 6.0) -> list[dict[str, Any]]:
    """n turbines in an east-west row, spacing in rotor diameters."""
    dlon = spacing_d * D / (111_320.0 * 0.5767)  # cos(54.8°)
    return [{"id": f"T{i + 1:02d}", "lon": lon + i * dlon, "lat": lat} for i in range(n)]


def _doc(**kw: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "schema": 2,
        "app": "OffshoreForge",
        "name": "My farm",
        "turbineModel": "IEA-15-240-RWT",
        "site": {
            "polygon": [[16.31, 54.845], [16.485, 54.845], [16.485, 54.755], [16.31, 54.755]],
            "stage": "layout",
            "done": ["screening"],
        },
        "turbines": _row(16.35, 54.8, 3),
        "oss": [16.4, 54.8],
        "costs": {"turbineMEurPerMw": 1.4},
        "lifecycle": {"build": {"start": "2028-04-01"}},
    }
    base.update(kw)
    return base


def test_create_open_save_delete(client: TestClient) -> None:
    r = client.post(URL, json=_doc())
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["revision"] == 1 and not p["is_reference"]
    assert uuid.UUID(p["id"]).version == 4
    assert p["data"]["turbineModel"] == "IEA-15-240-RWT"
    assert p["data"]["site"]["done"] == ["screening"]
    assert p["data"]["site"]["gridNode"] is None  # older documents: the nearest node

    got = client.get(f"{URL}/{p['id']}").json()
    assert got["data"] == p["data"]

    site = {
        **_doc()["site"],
        "gridNode": "Żarnowiec 400/110 kV",
        "route": [[16.4, 54.7], [16.73, 54.57]],
        "routeKm": 71.3,
    }
    r = client.put(
        f"{URL}/{p['id']}", json={"revision": 1, "data": _doc(name="Renamed", site=site)}
    )
    assert r.status_code == 200, r.text
    assert r.json()["revision"] == 2 and r.json()["data"]["name"] == "Renamed"
    assert r.json()["data"]["site"]["gridNode"] == "Żarnowiec 400/110 kV"
    assert r.json()["data"]["site"]["routeKm"] == 71.3
    assert r.json()["data"]["site"]["route"] == [[16.4, 54.7], [16.73, 54.57]]

    stale = client.put(f"{URL}/{p['id']}", json={"revision": 1, "data": _doc()})
    assert stale.status_code == 409

    assert client.delete(f"{URL}/{p['id']}").status_code == 204
    assert client.get(f"{URL}/{p['id']}").status_code == 404


def test_summary_columns_and_positions(client: TestClient, db: Any) -> None:
    pid = client.post(URL, json=_doc(turbines=_row(16.35, 54.8, 3))).json()["id"]

    async def read(s: Any) -> tuple[WindFarm, list[TurbinePosition]]:
        farm = await s.get(WindFarm, uuid.UUID(pid))
        pos = list(await s.scalars(select(TurbinePosition).order_by(TurbinePosition.turbine_id)))
        return farm, pos

    farm, pos = _run(db, read)
    assert farm.num_turbines == 3 and farm.capacity_mw == pytest.approx(45.0)  # 3 × 15 MW
    assert farm.latitude == pytest.approx(54.8)
    assert [p.turbine_id for p in pos] == ["T01", "T02", "T03"]
    assert pos[1].x_m - pos[0].x_m == pytest.approx(6 * D, rel=0.01)  # 6D east [m]
    assert pos[0].hub_height_m == 150.0
    keep = {p.turbine_id: p.id for p in pos}

    # move T02, drop T03: positions are upserted by turbine id
    moved = _row(16.35, 54.8, 2)
    moved[1]["lat"] += 0.01
    client.put(f"{URL}/{pid}", json={"revision": 1, "data": _doc(turbines=moved)})
    farm, pos = _run(db, read)
    assert farm.num_turbines == 2
    assert {p.turbine_id: p.id for p in pos} == {k: keep[k] for k in ("T01", "T02")}
    assert pos[1].y_m - pos[0].y_m == pytest.approx(0.01 * 111_320, rel=0.01)


@pytest.mark.parametrize(
    "bad",
    [
        {"turbines": _row(16.0, 54.8, 151, 1.1)},
        {"turbineModel": "V999"},
        {"turbines": [{"id": "T1", "lon": 16, "lat": 54}, {"id": "T1", "lon": 16.1, "lat": 54}]},
        {"turbines": [{"id": "T1", "lon": 200, "lat": 54}]},
        {"secret": "unknown keys are rejected"},
        {"schema": 1},
    ],
)
def test_invalid_documents_rejected(client: TestClient, bad: dict[str, Any]) -> None:
    assert client.post(URL, json=_doc(**bad)).status_code == 422


def test_body_size_limit(client: TestClient) -> None:
    r = client.post(URL, json=_doc(lifecycle={"notes": "x" * (600 * 1024)}))
    assert r.status_code == 413


def test_reference_project_is_read_only(client: TestClient, db: Any) -> None:
    async def seed(s: Any) -> None:
        s.add(
            WindFarm(
                id=FARM_UUID,
                name="SB-510",
                latitude=54.797,
                longitude=16.397,
                capacity_mw=510.0,
                num_turbines=34,
                turbine_model="IEA-15-240-RWT",
                is_reference=True,
            )
        )
        await s.commit()

    _run(db, seed)
    ref = client.get(f"{URL}/{FARM_UUID}")
    assert ref.status_code == 200
    assert ref.json()["is_reference"] and ref.json()["data"] is None
    assert client.put(f"{URL}/{FARM_UUID}", json={"revision": 1, "data": _doc()}).status_code == 403
    assert client.delete(f"{URL}/{FARM_UUID}").status_code == 403
    assert client.post(f"{URL}/{FARM_UUID}/aep", json={}).status_code == 403


def test_idle_projects_are_purged(client: TestClient, db: Any) -> None:
    old = client.post(URL, json=_doc()).json()["id"]
    recent = client.post(URL, json=_doc()).json()["id"]

    async def age(s: Any) -> None:
        farm = await s.get(WindFarm, uuid.UUID(old))
        farm.last_opened_at = datetime.now(UTC) - timedelta(days=400)
        await s.commit()

    _run(db, age)
    client.post(URL, json=_doc())  # creating a project runs the purge
    assert client.get(f"{URL}/{old}").status_code == 404
    assert client.get(f"{URL}/{recent}").status_code == 200

    async def orphans(s: Any) -> int:
        q = select(func.count()).select_from(TurbinePosition)
        return int((await s.execute(q)).scalar_one())

    assert _run(db, orphans) == 2 * 3  # the purged project's positions cascaded away


def test_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(projects.LIMITS, "create", (2, 3600.0))
    assert client.post(URL, json=_doc()).status_code == 201
    assert client.post(URL, json=_doc()).status_code == 201
    assert client.post(URL, json=_doc()).status_code == 429


def test_aep_runs_are_stored_with_p_values(client: TestClient) -> None:
    pid = client.post(URL, json=_doc(turbines=_row(16.35, 54.8, 4))).json()["id"]
    r = client.post(f"{URL}/{pid}/aep", json={"weibull_a": 10.5, "weibull_k": 2.2})
    assert r.status_code == 200, r.text
    run = r.json()
    assert run["revision"] == 1
    assert run["turbine_ids"] == ["T01", "T02", "T03", "T04"]
    # Physics: 0 < P90 < P75 < P50 < wake-net ≤ gross; CF of a 15 MW machine in (0, 1)
    assert 0 < run["p90_gwh"] < run["p75_gwh"] < run["p50_gwh"] < run["net_aep_gwh"]
    assert run["net_aep_gwh"] <= run["gross_aep_gwh"] < 4 * 15 * 8.76
    assert 0 < run["wake_loss_percent"] < 15  # 4 in a row at 6D
    assert 0.3 < run["capacity_factor"] < 0.6
    assert sum(run["per_turbine_aep_gwh"]) == pytest.approx(run["net_aep_gwh"], rel=0.01)

    # second run on a new revision with the site climate (region pack) → newest first
    client.put(f"{URL}/{pid}", json={"revision": 1, "data": _doc(turbines=_row(16.35, 54.8, 4))})
    assert client.post(f"{URL}/{pid}/aep", json={}).status_code == 200
    hist = client.get(f"{URL}/{pid}/aep").json()
    assert [h["revision"] for h in hist] == [2, 1]


def test_aep_needs_turbines(client: TestClient) -> None:
    pid = client.post(URL, json=_doc(turbines=[])).json()["id"]
    assert client.post(f"{URL}/{pid}/aep", json={}).status_code == 422


def test_windio_export(client: TestClient) -> None:
    """windIO 2.x plant file: round-trips through YAML, carries the schema's required keys."""
    doc = _doc()
    pid = client.post(URL, json=doc).json()["id"]
    r = client.get(f"{URL}/{pid}/windio.yaml")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/yaml")
    assert 'filename="my-farm.windio.yaml"' in r.headers["content-disposition"]
    assert r.text.startswith("# windIO 2.x")
    assert "&id" not in r.text  # no YAML anchors: other tools read it as plain data
    w = yaml.safe_load(r.text)
    assert yaml.safe_load(yaml.safe_dump(w)) == w  # plain data only (no Python tags)

    # Required keys (windIO schemas/plant: wind_energy_system, site, energy_resource,
    # wind_farm, turbine)
    assert {"name", "site", "wind_farm"} <= w.keys()
    site, farm = w["site"], w["wind_farm"]
    assert {"name", "boundaries", "energy_resource"} <= site.keys()
    res = site["energy_resource"]["wind_resource"]
    assert {"weibull_a", "weibull_k", "sector_probability"} <= res.keys()
    assert sum(res["sector_probability"]["data"]) == pytest.approx(1.0, abs=1e-3)
    assert 5 < res["weibull_a"]["data"][0] < 15  # m/s at 150 m, southern Baltic
    assert {"name", "layouts"} <= farm.keys()
    turbine = farm["turbines"]
    assert {"name", "performance", "hub_height", "rotor_diameter"} <= turbine.keys()
    assert turbine["rotor_diameter"] == pytest.approx(D)
    perf = turbine["performance"]
    assert perf["rated_power"] == 15e6  # W
    assert max(perf["power_curve"]["power_values"]) <= perf["rated_power"]  # domain rule 1

    # Layout: metres about the turbine centroid, 6 D spacing east-west, ids kept
    xy = farm["layouts"][0]["coordinates"]
    assert farm["layouts"][0]["turbine_identifiers"] == ["T01", "T02", "T03"]
    assert sum(xy["x"]) == pytest.approx(0, abs=1) and sum(xy["y"]) == pytest.approx(0, abs=1)
    assert xy["x"][1] - xy["x"][0] == pytest.approx(6 * D, rel=0.002)
    assert xy["crs"].startswith("+proj=eqc")
    assert len(site["boundaries"]["polygons"][0]["x"]) == 4
    assert farm["electrical_substations"][0]["electrical_substation"]["coordinates"]["x"]


def test_windio_needs_turbines(client: TestClient) -> None:
    pid = client.post(URL, json=_doc(turbines=[])).json()["id"]
    assert client.get(f"{URL}/{pid}/windio.yaml").status_code == 422
