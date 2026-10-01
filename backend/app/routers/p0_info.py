"""
Project Information API — static design rationale and sensor register.

Endpoints
---------
GET  /api/v1/info/sensors    — Full instrument register for 510 MW platform
GET  /api/v1/info/health     — Lightweight liveness probe (no DB)
GET  /api/v1/info/ais        — Live AIS vessels around the site (aisstream.io proxy)

Standards referenced
--------------------
IEC 61400-12-1  — Anemometer class specification
ISO 10816-21    — Vibration sensor specification
IEC 61869-2/3   — CT and VT accuracy classes
IEC 60287       — DTS thermal model
IEC 61850-7-4   — Logical node names
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.schemas.sensor_specs import SensorRegisterResponse
from app.services.p0 import ais_stream
from app.services.p0 import sensor_register as svc

router = APIRouter(prefix="/api/v1/info", tags=["Project Info"])


@router.get(
    "/sensors",
    response_model=SensorRegisterResponse,
    summary="Full instrument register",
    description=(
        "Returns the complete sensor specification register for the Baltic Wind 510 MW platform: "
        "34 turbines x 11 sensors, 6 OSS bays x 5 instruments, 5 export cable instruments. "
        "Total ~409 field instrument tags (process sensors only). "
        "All specifications reference IEC/ISO standards. "
        "Values are indicative — final specs are vendor-dependent."
    ),
)
async def get_sensor_register() -> SensorRegisterResponse:
    """Return the full sensor register."""
    return svc.get_sensor_register()


@router.get(
    "/ais",
    summary="Live AIS vessels around the site",
    description=(
        "Vessel positions (lat 54.45-55.20 N, lon 15.80-17.30 E) from aisstream.io, "
        "fresh within 15 min. Requires AISSTREAM_API_KEY on the backend; otherwise "
        "enabled=false and no vessels (the map never shows invented traffic)."
    ),
)
async def get_ais_vessels() -> dict[str, Any]:
    enabled = bool(settings.aisstream_api_key)
    return {
        "enabled": enabled,
        "source": "aisstream.io (AIS, ITU-R M.1371)",
        "bbox": ais_stream.BBOX,
        "status": ais_stream.status(),
        "vessels": ais_stream.snapshot() if enabled else [],
    }
