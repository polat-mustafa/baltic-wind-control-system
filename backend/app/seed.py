"""
Seed data for the SB-510 reference wind farm.

Inserts the 34 × 15 MW reference wind farm (read-only project row) with turbine
positions if it is missing. Idempotent — safe to run on every startup.

Positions: the map layout (``services/p1/sb510_layout.py`` = frontend
``constants/windFarmLayout.ts``): 6 strings (6-6-6-6-5-5) running N–S in MSP
energy basin PZP_44, ≈ 8 D = 1.93 km apart along the prevailing 270° wind and
≈ 6 D = 1.45 km along a string (IEA 15 MW, D = 241.35 m, hub height 150 m).
x_m = east, y_m = north in metres from WTG-01 (equirectangular, as the canvas).

Deterministic farm UUID for reproducible references.
"""

from __future__ import annotations

import logging
import uuid

from app.db import async_session_factory
from app.models.wind_farm import TurbinePosition, WindFarm
from app.services.p1.sb510_layout import SB510_TURBINES, local_xy_m

logger = logging.getLogger(__name__)

# Deterministic UUID for the reference wind farm
FARM_UUID = uuid.UUID("00000000-0000-4000-a000-000000000001")


def _generate_positions() -> list[dict[str, str | float]]:
    """The 34 SB-510 positions: turbine_id, x_m (east), y_m (north) from WTG-01."""
    positions: list[dict[str, str | float]] = []
    for turbine_id, _string, lat, lon in SB510_TURBINES:
        x, y = local_xy_m(lat, lon)
        positions.append({"turbine_id": turbine_id, "x_m": round(x, 1), "y_m": round(y, 1)})
    return positions


async def seed_default_farm() -> None:
    """Insert the 510 MW reference wind farm if its row is missing.

    The table also holds user projects (routers/projects.py), so the check is
    on the reference id, not on an empty table. The row is read-only
    (``is_reference``); its project data is built by the frontend from
    ``constants/windFarmLayout.ts``.
    """
    async with async_session_factory() as session:
        if await session.get(WindFarm, FARM_UUID) is not None:
            logger.info("Reference farm SB-510 present — skipping seed")
            return

        farm = WindFarm(
            id=FARM_UUID,
            name="SB-510",
            # Array centroid — same site as the frontend map
            # (frontend/src/constants/windFarmLayout.ts, EEZ, 29–40 m depth)
            latitude=55.063,
            longitude=16.536,
            capacity_mw=510.0,
            num_turbines=34,
            turbine_model="IEA-15-240-RWT",
            is_reference=True,
        )
        session.add(farm)

        for pos in _generate_positions():
            session.add(
                TurbinePosition(
                    wind_farm_id=FARM_UUID,
                    turbine_id=pos["turbine_id"],
                    x_m=pos["x_m"],
                    y_m=pos["y_m"],
                    hub_height_m=150.0,
                )
            )

        await session.commit()
        logger.info("Seeded SB-510: 34 x 15 MW = 510 MW (UUID: %s)", FARM_UUID)
