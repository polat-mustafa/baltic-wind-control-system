"""
SB-510 reference layout: the 34 turbine positions and the OSS (WGS84).

The same coordinates as the map, ``frontend/src/constants/windFarmLayout.ts``
(phase 9, MSP energy basin PZP_44); ``tests/test_sb510_layout.py`` checks they
stay equal. Backend modules that need the reference farm's location — its site
wind climate (P4, digital twin, P3 historian) and the seeded project row — read
it here.
"""

from __future__ import annotations

import math

# (turbine id, string number, latitude °N, longitude °E)
SB510_TURBINES: tuple[tuple[str, int, float, float], ...] = (
    ("WTG-01", 1, 55.0796, 16.464),
    ("WTG-02", 1, 55.0665, 16.464),
    ("WTG-03", 1, 55.0535, 16.464),
    ("WTG-04", 1, 55.0405, 16.464),
    ("WTG-05", 1, 55.0275, 16.464),
    ("WTG-06", 1, 55.0144, 16.464),
    ("WTG-07", 2, 55.0886, 16.4943),
    ("WTG-08", 2, 55.0755, 16.4943),
    ("WTG-09", 2, 55.0625, 16.4943),
    ("WTG-10", 2, 55.0495, 16.4943),
    ("WTG-11", 2, 55.0365, 16.4943),
    ("WTG-12", 2, 55.0234, 16.4943),
    ("WTG-13", 3, 55.0956, 16.5246),
    ("WTG-14", 3, 55.0825, 16.5246),
    ("WTG-15", 3, 55.0695, 16.5246),
    ("WTG-16", 3, 55.0565, 16.5246),
    ("WTG-17", 3, 55.0435, 16.5246),
    ("WTG-18", 3, 55.0304, 16.5246),
    ("WTG-19", 4, 55.1006, 16.5549),
    ("WTG-20", 4, 55.0875, 16.5549),
    ("WTG-21", 4, 55.0745, 16.5549),
    ("WTG-22", 4, 55.0615, 16.5549),
    ("WTG-23", 4, 55.0485, 16.5549),
    ("WTG-24", 4, 55.0354, 16.5549),
    ("WTG-25", 5, 55.099, 16.5852),
    ("WTG-26", 5, 55.086, 16.5852),
    ("WTG-27", 5, 55.073, 16.5852),
    ("WTG-28", 5, 55.06, 16.5852),
    ("WTG-29", 5, 55.047, 16.5852),
    ("WTG-30", 6, 55.103, 16.6156),
    ("WTG-31", 6, 55.09, 16.6156),
    ("WTG-32", 6, 55.077, 16.6156),
    ("WTG-33", 6, 55.064, 16.6156),
    ("WTG-34", 6, 55.051, 16.6156),
)

SB510_OSS: tuple[float, float] = (55.026, 16.442)  # (latitude, longitude)

# Equirectangular projection of the layout canvas and the windIO export: metres per degree
M_PER_DEG = 111_320.0


def centroid() -> tuple[float, float]:
    """Mean turbine position (latitude, longitude)."""
    n = len(SB510_TURBINES)
    return (
        sum(t[2] for t in SB510_TURBINES) / n,
        sum(t[3] for t in SB510_TURBINES) / n,
    )


def local_xy_m(lat: float, lon: float) -> tuple[float, float]:
    """(east, north) metres from WTG-01, equirectangular about WTG-01's latitude."""
    lat0, lon0 = SB510_TURBINES[0][2], SB510_TURBINES[0][3]
    return (
        (lon - lon0) * M_PER_DEG * math.cos(math.radians(lat0)),
        (lat - lat0) * M_PER_DEG,
    )
