"""AIS proxy: message parsing, staleness, and the disabled-without-key endpoint."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.services.p0 import ais_stream


@pytest.fixture(autouse=True)
def _clear_cache():
    ais_stream._vessels.clear()
    yield
    ais_stream._vessels.clear()


def _position(mmsi: int, lat: float, lon: float, heading: int = 511) -> dict:
    return {
        "MessageType": "PositionReport",
        "MetaData": {"MMSI": mmsi, "ShipName": "BALTIC CTV 1  ", "latitude": lat, "longitude": lon},
        "Message": {"PositionReport": {"Sog": 21.5, "Cog": 318.0, "TrueHeading": heading}},
    }


def test_position_then_static_data_builds_one_vessel():
    ais_stream.ingest(_position(261000001, 54.62, 16.80), now=1000.0)
    ais_stream.ingest(
        {
            "MessageType": "ShipStaticData",
            "MetaData": {"MMSI": 261000001},
            "Message": {"ShipStaticData": {"Type": 31, "Name": "BALTIC CTV 1"}},
        },
        now=1001.0,
    )
    [v] = ais_stream.snapshot(now=1002.0)
    assert v["name"] == "BALTIC CTV 1"
    assert (v["lat"], v["lon"], v["sog_kn"], v["cog_deg"]) == (54.62, 16.80, 21.5, 318.0)
    assert v["heading_deg"] is None  # 511 = not available (ITU-R M.1371)
    assert v["ship_type"] == 31


def test_stale_reports_are_dropped():
    ais_stream.ingest(_position(261000002, 54.7, 16.5, heading=90), now=0.0)
    assert ais_stream.snapshot(now=ais_stream.STALE_AFTER_S - 1)
    assert ais_stream.snapshot(now=ais_stream.STALE_AFTER_S + 1) == []


def test_malformed_messages_are_ignored():
    ais_stream.ingest({"MessageType": "PositionReport", "MetaData": {"MMSI": "x"}})
    ais_stream.ingest({"MessageType": "PositionReport", "MetaData": {"MMSI": 1}, "Message": {}})
    assert ais_stream.snapshot() == []


async def test_endpoint_is_disabled_without_key(monkeypatch):
    from app.config import settings
    from app.main import app

    monkeypatch.setattr(settings, "aisstream_api_key", None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        body = (await client.get("/api/v1/info/ais")).json()
    assert body["enabled"] is False
    assert body["vessels"] == []


def test_server_error_message_is_raised_not_swallowed():
    with pytest.raises(ais_stream.AisServerError, match="Api Key Is Not Valid"):
        ais_stream.ingest({"error": "Api Key Is Not Valid"})


def test_box_covers_the_sb510_site():
    (lat0, lon0), (lat1, lon1) = ais_stream.BBOX
    assert lat0 < 55.06 < lat1 and lon0 < 16.54 < lon1  # PZP_44


def test_settings_read_backend_env_regardless_of_cwd():
    from app.config import ENV_FILE

    assert ENV_FILE.name == ".env" and ENV_FILE.parent.name == "backend"
