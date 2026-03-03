"""
Seed data for the Baltic Wind Alpha reference wind farm.

Inserts the 34 × V236-15.0 MW wind farm with turbine positions
if the database is empty. Idempotent — safe to run on every startup.

Layout: 6 strings (6+6+6+6+5+5 = 34 turbines), staggered grid
- Cross-wind spacing: 1500 m (~6.4D)
- Along-wind spacing: 2360 m (~10D, for V236 D=236 m)
- Hub height: 150 m (V236-15.0 MW standard)

Deterministic farm UUID for reproducible references.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session_factory
from app.models.wind_farm import TurbinePosition, WindFarm

logger = logging.getLogger(__name__)

# Deterministic UUID for the reference wind farm
FARM_UUID = uuid.UUID("00000000-0000-4000-a000-000000000001")

# String layout: 6 strings with turbine counts matching P2 network model
STRING_LAYOUT = [6, 6, 6, 6, 5, 5]  # 34 total

# Spacing (metres)
CROSS_WIND_SPACING_M = 1500.0  # ~6.4D cross-wind
ALONG_WIND_SPACING_M = 2360.0  # ~10D along-wind
STAGGER_OFFSET_M = 750.0       # Half cross-wind spacing for stagger


def _generate_positions() -> list[dict]:
    """Generate 34 turbine positions on a staggered grid.

    Returns a list of dicts with keys: turbine_id, x_m, y_m.
    Origin at (0, 0) for string 1, turbine 1.
    """
    positions: list[dict] = []
    turbine_id = 1

    for string_idx, n_turbines in enumerate(STRING_LAYOUT):
        x_base = string_idx * CROSS_WIND_SPACING_M

        # Odd strings (0-indexed) are staggered along-wind
        y_offset = STAGGER_OFFSET_M if string_idx % 2 == 1 else 0.0

        for turbine_in_string in range(n_turbines):
            positions.append({
                "turbine_id": f"WTG-{turbine_id:02d}",
                "x_m": round(x_base, 1),
                "y_m": round(y_offset + turbine_in_string * ALONG_WIND_SPACING_M, 1),
            })
            turbine_id += 1

    return positions


async def seed_default_farm() -> None:
    """Insert the 510 MW reference wind farm if the table is empty.

    Checks ``COUNT(*) > 0`` on ``wind_farm`` before inserting.
    """
    async with async_session_factory() as session:
        session: AsyncSession

        # Check if any farm already exists
        result = await session.execute(select(func.count()).select_from(WindFarm))
        count = result.scalar_one()

        if count > 0:
            logger.info("Wind farm table not empty (%d rows) — skipping seed", count)
            return

        # Create the reference wind farm
        farm = WindFarm(
            id=FARM_UUID,
            name="Baltic Wind Alpha",
            latitude=55.0,
            longitude=17.5,
            capacity_mw=510.0,
            num_turbines=34,
            turbine_model="V236-15.0 MW",
        )
        session.add(farm)

        # Create 34 turbine positions
        positions = _generate_positions()
        for pos in positions:
            tp = TurbinePosition(
                wind_farm_id=FARM_UUID,
                turbine_id=pos["turbine_id"],
                x_m=pos["x_m"],
                y_m=pos["y_m"],
                hub_height_m=150.0,
            )
            session.add(tp)

        await session.commit()
        logger.info(
            "Seeded Baltic Wind Alpha: 34 × V236-15.0 MW = 510 MW (UUID: %s)",
            FARM_UUID,
        )
