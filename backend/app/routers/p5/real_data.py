"""P5 sub-router: a real offshore farm going live — Baltic Power's energisation (ENTSO-E)."""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.core.exceptions import NotFoundError

router = APIRouter()

DATA = Path(__file__).resolve().parents[2] / "services/p5/data/baltic_power_energisation.json"


@cache
def _load() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(DATA.read_text(encoding="utf-8"))
    return data


@router.get("/real-data/baltic-power")
async def baltic_power_energisation() -> dict[str, Any]:
    """Daily peak, energy and turbines-online lower bound of Poland's first offshore farm.

    76 × Vestas V236-15.0 MW (the turbine class SB-510 is modelled on), measured output
    from ENTSO-E 16.1.A; built by ``scripts/fetch_entsoe_units.py --file-library``.
    """
    if not DATA.exists():
        raise NotFoundError("Baltic Power data not built yet (scripts/fetch_entsoe_units.py)")
    return _load()
