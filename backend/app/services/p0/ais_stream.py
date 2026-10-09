"""
Live AIS vessel positions around the site — aisstream.io websocket proxy.

Why a backend proxy
-------------------
aisstream.io is free but needs an API key and does not accept connections
from browsers, so the key must stay server-side. Set ``AISSTREAM_API_KEY``
in the backend environment (free key: https://aisstream.io). Without a key
the endpoint reports ``enabled: false`` and the map shows no traffic —
we never draw invented ships.

(Finnish Digitraffic AIS is keyless but does not cover the Polish EEZ —
checked 2026-09-29: 0 of 1 218 vessels south of 56 °N / west of 18 °E.)

Message format (aisstream v0): ``{"MessageType": ..., "MetaData": {"MMSI",
"ShipName", "latitude", "longitude", "time_utc"}, "Message": {<type>: {...}}}``
Position reports carry Sog [kn], Cog [deg], TrueHeading [deg] (511 = n/a).
ShipStaticData carries ``Type`` (ITU-R M.1371 ship-type code).
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import time
from dataclasses import asdict, dataclass
from typing import Any

logger = logging.getLogger(__name__)

AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream"
# Southern Baltic, Bornholm – Gdańsk Bay, lat 54.30–55.80 N, lon 14.20–19.00 E.
# aisstream only relays terrestrial receivers; on 2026-10-09 none covered the
# Słupsk Bank itself (0 reports in 15.8–17.3 E over 60 s, 116 around Gdańsk
# and Bornholm), so a site-only box usually stayed empty.
BBOX = [[54.30, 14.20], [55.80, 19.00]]
STALE_AFTER_S = 15 * 60  # AIS class A reports every 2–10 s under way, 3 min at anchor
_POSITION_TYPES = ("PositionReport", "StandardClassBPositionReport", "ExtendedClassBPositionReport")


@dataclass
class Vessel:
    mmsi: int
    name: str
    lat: float
    lon: float
    sog_kn: float | None
    cog_deg: float | None
    heading_deg: float | None
    ship_type: int | None
    updated: float  # epoch s


_vessels: dict[int, Vessel] = {}
_task: asyncio.Task[None] | None = None
_status: dict[str, Any] = {"connected": False, "last_message": 0.0, "error": ""}


class AisServerError(RuntimeError):
    """aisstream rejected the subscription (bad key, malformed box, rate limit)."""


def ingest(msg: dict[str, Any], now: float | None = None) -> None:
    """Update the vessel cache from one aisstream message (pure, testable)."""
    if "error" in msg:  # e.g. {"error": "Api Key Is Not Valid"} — the server then closes
        raise AisServerError(str(msg["error"]))
    meta = msg.get("MetaData") or {}
    mmsi = meta.get("MMSI")
    if not isinstance(mmsi, int):
        return
    now = time.time() if now is None else now
    kind = msg.get("MessageType", "")
    body = (msg.get("Message") or {}).get(kind) or {}
    v = _vessels.get(mmsi)
    name = str(meta.get("ShipName") or (v.name if v else "")).strip()

    if kind in _POSITION_TYPES:
        lat, lon = meta.get("latitude"), meta.get("longitude")
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
            return
        heading = body.get("TrueHeading")
        _vessels[mmsi] = Vessel(
            mmsi=mmsi,
            name=name,
            lat=float(lat),
            lon=float(lon),
            sog_kn=body.get("Sog"),
            cog_deg=body.get("Cog"),
            heading_deg=float(heading)
            if isinstance(heading, (int, float)) and heading != 511
            else None,
            ship_type=v.ship_type if v else None,
            updated=now,
        )
    elif kind == "ShipStaticData" and v:
        v.ship_type = body.get("Type", v.ship_type)
        v.name = str(body.get("Name") or v.name).strip()


def snapshot(now: float | None = None) -> list[dict[str, Any]]:
    """Fresh vessels only (drops reports older than STALE_AFTER_S)."""
    now = time.time() if now is None else now
    for mmsi in [m for m, v in _vessels.items() if now - v.updated > STALE_AFTER_S]:
        del _vessels[mmsi]
    return [asdict(v) for v in _vessels.values()]


def status() -> dict[str, Any]:
    return dict(_status)


async def _run(api_key: str) -> None:
    # ponytail: `websockets` comes in via uvicorn[standard]; declare it if that ever changes
    import websockets

    sub = {
        "APIKey": api_key,
        "BoundingBoxes": [BBOX],
        "FilterMessageTypes": [*_POSITION_TYPES, "ShipStaticData"],
    }
    backoff = 5.0
    while True:
        try:
            async with websockets.connect(AISSTREAM_URL) as ws:
                await ws.send(json.dumps(sub))
                _status.update(connected=True, error="")
                backoff = 5.0
                async for raw in ws:
                    ingest(json.loads(raw))
                    _status["last_message"] = time.time()
            # A clean close is still a lost feed: report it and back off instead
            # of reconnecting in a tight loop while claiming to be connected.
            raise ConnectionError("stream closed by aisstream")
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # network / auth errors: log, back off, retry
            _status.update(connected=False, error=str(exc)[:200])
            logger.warning("AIS stream error: %s (retry in %.0f s)", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 300.0)


def start(api_key: str | None) -> None:
    global _task
    if api_key and _task is None:
        _task = asyncio.create_task(_run(api_key))


async def stop() -> None:
    global _task
    if _task:
        _task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _task
        _task = None
