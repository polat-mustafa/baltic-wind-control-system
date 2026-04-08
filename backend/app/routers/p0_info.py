"""
Project Information API — static design rationale and sensor register.

Endpoints
---------
GET  /api/v1/info/sensors    — Full instrument register for 510 MW platform
GET  /api/v1/info/health     — Lightweight liveness probe (no DB)

Standards referenced
--------------------
IEC 61400-12-1  — Anemometer class specification
ISO 10816-21    — Vibration sensor specification
IEC 61869-2/3   — CT and VT accuracy classes
IEC 60287       — DTS thermal model
IEC 61850-7-4   — Logical node names
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.sensor_specs import SensorRegisterResponse
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
