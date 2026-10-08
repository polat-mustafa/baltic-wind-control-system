"""P5 commissioning on the learner's farm (FarmSpec).

- The registry, locks, steps and load-flow checks follow the design: strings of
  section A, reactor unit (none → no reactor bay), STATCOM and transformer.
- Every tested farm runs the whole programme to COMPLETED on its own load flow.
- Long cables: the onshore OLTC is pre-set, or (small onshore transformers) the
  cable is energised with reactor 1; 3–4 circuits: the PPC limits circuit 1.
- The API keeps the farm of the X-Farm header in the programme (SQLite DB).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from typing import Any
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool

from app.db import get_session
from app.main import app
from app.models.programme import FATCampaignModel, SwitchingProgrammeModel
from app.services.p2.network_model import SB510, design, export_circuit_capacity_mw
from app.services.p2.statcom_sizing import check_reactors
from app.services.p5.energisation import (
    circuit1_limit_mw,
    onshore_tap,
    reactor_energisation,
    section_a_mw,
)
from app.services.p5.equipment_state import OSS_EQUIPMENT, equipment
from app.services.p5.fat import EquipmentClass, create_fat_campaign
from app.services.p5.switching_programme import ProgrammeStatus, StepType
from tests.p5_support import ready_programme, run_until

FOUR_STRINGS = check_reactors(design((5, 5, 5, 5), 30.0))  # 300 MW, 1 circuit
GW = check_reactors(design((6,) * 12, 45.0))  # 1080 MW, 4 circuits
LONG = check_reactors(design((6,) * 6, 75.0))  # 540 MW, 75 km
SMALL_LONG = check_reactors(design((4, 4), 73.0))  # 120 MW on 2 × 100 MVA onshore
NO_REACTOR = check_reactors(design((6,) * 6, 8.0))  # short cable: STATCOM covers it


def _ids(spec: Any) -> set[str]:
    return {eq.equipment_id for eq in equipment(spec)}


def _completed(spec: Any) -> Any:
    p = ready_programme(spec)
    run_until(p)
    assert p.status == ProgrammeStatus.COMPLETED, [s.reading for s in p.steps if s.reading][-1]
    return p


def _reading(p: Any, check_id: str) -> str:
    return next(s.reading for s in p.steps if s.check_id == check_id)


def test_sb510_registry_is_unchanged():
    assert equipment(SB510) is OSS_EQUIPMENT
    assert {i for i in _ids(SB510) if "STR" in i or "WTG" in i} == {
        *(f"{d}-STR-0{n}" for d in ("CB", "ES") for n in range(1, 7)),
        *(f"WTG-GRP-0{n}" for n in (1, 2, 3)),
    }
    # 76.5 km lifts the onshore busbar: the OLTC is pre-set 3 steps, no reactor needed
    assert onshore_tap(SB510) == 3 and not reactor_energisation(SB510)


def test_four_string_project():
    ids = _ids(FOUR_STRINGS)
    assert {"CB-STR-04", "ES-STR-04", "WTG-GRP-02"} <= ids
    assert "WTG-GRP-03" not in ids  # section A = strings 1–2
    feeder = next(e for e in equipment(FOUR_STRINGS) if e.equipment_id == "CB-STR-03")
    assert feeder.zones == ("66B", "STR3")
    p = _completed(FOUR_STRINGS)
    assert p.title.endswith("strings 1–2")
    assert any("Release the 5 turbines of string 2" in s.action for s in p.steps)
    # 2 × 5 × 15 MW at rated, TX-OSS-01 is 200 MVA
    assert _reading(p, "rated").startswith("150 MW generated")
    assert "of 200 MVA" in _reading(p, "rated")


def test_gw_farm_circuit1_is_limited_by_the_ppc():
    assert section_a_mw(GW) == 540
    limit = circuit1_limit_mw(GW)
    assert limit == pytest.approx(0.9 * export_circuit_capacity_mw(45.0))
    assert limit < 540
    p = _completed(GW)
    assert (
        sum(s.step_type == StepType.VERIFICATION and "string" in s.check_id for s in p.steps) == 6
    )
    rated = _reading(p, "rated")
    assert rated.startswith(f"{limit:.0f} MW generated")
    cable = float(rated.split("cable 1 ")[1].split(" %")[0])
    assert 85 < cable < 100  # one circuit near, not above, its rating
    assert "PPC limits the output" in next(s.notes for s in p.steps if s.check_id == "rated")


def test_long_cable_presets_the_onshore_oltc():
    tap = onshore_tap(LONG)
    assert tap > 0 and not reactor_energisation(LONG)
    p = _completed(LONG)
    assert f"tap +{tap}" in p.steps[4].action  # 1.05 onshore busbar check
    # 75 km, open-ended: ≈ 2× the SB-510 charging current, Ferranti ≈ 1.02
    reading = _reading(p, "cable_energised")
    assert "×1.019" in reading or "×1.020" in reading


def test_small_onshore_transformers_energise_the_cable_with_its_reactor():
    assert reactor_energisation(SMALL_LONG)
    p = _completed(SMALL_LONG)
    order = [s.equipment_id for s in p.steps if s.step_type == StepType.SWITCHING]
    assert order.index("CB-SR-01") < order.index("CB-ON-220-01")
    assert next(s for s in p.steps if s.equipment_id == "CB-SR-01").phase == 2
    assert "OSS 220 kV" in _reading(p, "cable_energised")  # the far end is the busbar


def test_design_without_reactors_has_no_reactor_bay():
    assert NO_REACTOR.num_reactors == 0
    assert not {"CB-SR-01", "ES-SR-01"} & _ids(NO_REACTOR)
    p = _completed(NO_REACTOR)
    assert not any(s.check_id == "reactor" for s in p.steps)


def test_fat_transformer_limits_follow_the_rating():
    t03 = create_fat_campaign("TX", EquipmentClass.POWER_TRANSFORMER, FOUR_STRINGS).specs["FAT-T03"]
    assert t03.max_value == pytest.approx(0.0025 * 200e3 * 1.15)  # vkr 0.25 % of 200 MVA, +15 %
    assert t03.typical_value <= t03.max_value


# ── API on an in-memory SQLite DB ────────────────────────────────


@compiles(JSONB, "sqlite")
def _jsonb_as_json(_type: Any, _compiler: Any, **_kw: Any) -> str:
    return "JSON"


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    tables = [SwitchingProgrammeModel.__table__, FATCampaignModel.__table__]

    async def _create() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: SwitchingProgrammeModel.metadata.create_all(c, tables))

    asyncio.run(_create())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _session() -> Any:
        async with factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    yield TestClient(app)
    app.dependency_overrides.pop(get_session, None)
    asyncio.run(engine.dispose())


URL = "/api/v1/commissioning/programmes"
FARM = {"X-Farm": quote(json.dumps({"strings": [5, 5, 5, 5], "export_km": 30, "array_km": 1.5}))}


def test_api_keeps_the_farm_of_the_header(client: TestClient):
    created = client.post(URL, json={"pic_name": "Anna Nowak"}, headers=FARM)
    assert created.status_code == 201
    pid = created.json()["programme_id"]
    assert pid.startswith("PRJ-SP-")
    # later calls carry no header: the programme remembers its farm
    detail = client.get(f"{URL}/{pid}").json()
    assert detail["farm"]["string_layout"] == [5, 5, 5, 5]
    assert detail["farm"]["section_a_strings"] == 2
    assert detail["phases"]["5"] == "Strings 1–2"
    ids = {e["equipment_id"] for e in detail["equipment_states"]}
    assert {"CB-STR-04", "WTG-GRP-02"} <= ids and "WTG-GRP-03" not in ids
    loto = client.get(f"{URL}/{pid}/loto").json()
    assert {p["equipment_id"] for p in loto["points"]} >= {"ES-STR-04"}


def test_api_without_header_is_sb510(client: TestClient):
    pid = client.post(URL, json={"pic_name": "Anna Nowak"}).json()["programme_id"]
    detail = client.get(f"{URL}/{pid}").json()
    assert pid.startswith("SB5-SP-")
    assert detail["farm"]["name"] == "SB-510"
    assert detail["total_steps"] == 60
    assert detail["farm"]["reactor_unit_mvar"] == 170
