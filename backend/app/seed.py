"""
Seed data for the SB-510 reference wind farm.

Inserts the 34 × 15 MW reference wind farm (read-only project row) with turbine
positions if it is missing. Idempotent — safe to run on every startup.

Layout: 6 strings (6+6+6+6+5+5 = 34 turbines), same geometry as the map
(frontend constants/windFarmLayout.ts):
- Strings run N-S, 8D = 1888 m apart east-west (V236, D = 236 m)
- Turbines 6D = 1416 m apart along a string (north → south)
- Even strings staggered 700 m south, so the prevailing SW wind (≈ 225°)
  does not line turbines up in each other's wake
- Hub height: 150 m (V236-15.0 MW standard)
x_m = east, y_m = north, origin at WTG-01 (NW corner).

Deterministic farm UUID for reproducible references.
"""

from __future__ import annotations

import logging
import uuid

from app.db import async_session_factory
from app.models.wind_farm import TurbinePosition, WindFarm
from app.services.p2.network_model import STRING_LAYOUT  # 6-6-6-6-5-5, single source of truth

logger = logging.getLogger(__name__)

# Deterministic UUID for the reference wind farm
FARM_UUID = uuid.UUID("00000000-0000-4000-a000-000000000001")

# Spacing (metres) — must match the map layout
ROTOR_DIAMETER_M = 236.0
STRING_SPACING_M = 8 * ROTOR_DIAMETER_M  # 1888 m between strings (east-west)
TURBINE_SPACING_M = 6 * ROTOR_DIAMETER_M  # 1416 m along a string (north-south)
STAGGER_OFFSET_M = 700.0  # even strings shifted south


def _generate_positions() -> list[dict[str, str | float]]:
    """Generate 34 turbine positions on a staggered grid.

    Returns a list of dicts with keys: turbine_id, x_m, y_m.
    Origin at (0, 0) = WTG-01; strings go east, turbines south (y negative).
    """
    positions: list[dict[str, str | float]] = []
    turbine_id = 1

    for string_idx, n_turbines in enumerate(STRING_LAYOUT):
        x_base = string_idx * STRING_SPACING_M

        # Even strings (1-indexed 2, 4, 6) are staggered south
        y_offset = -STAGGER_OFFSET_M if string_idx % 2 == 1 else 0.0

        for turbine_in_string in range(n_turbines):
            positions.append(
                {
                    "turbine_id": f"WTG-{turbine_id:02d}",
                    "x_m": round(x_base, 1),
                    "y_m": round(y_offset - turbine_in_string * TURBINE_SPACING_M, 1),
                }
            )
            turbine_id += 1

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
            latitude=54.797,
            longitude=16.397,
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
