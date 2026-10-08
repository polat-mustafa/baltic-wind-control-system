"""The seeded turbine layout must match the map (frontend constants/windFarmLayout.ts)."""

import math

import pytest

from app.seed import _generate_positions
from app.services.p2.network_model import STRING_LAYOUT

D = 241.35  # IEA 15 MW rotor diameter [m]


def test_spacing_matches_map_layout():
    """≈ 6 D along a string (north → south), ≈ 8 D between strings (east)."""
    pos = {p["turbine_id"]: (p["x_m"], p["y_m"]) for p in _generate_positions()}
    assert len(pos) == sum(STRING_LAYOUT) == 34
    assert pos["WTG-01"] == (0.0, 0.0)
    # WTG-01 → WTG-02: same string, ≈ 6 D south
    assert math.dist(pos["WTG-01"], pos["WTG-02"]) == pytest.approx(6 * D, rel=0.02)
    assert pos["WTG-02"][1] < pos["WTG-01"][1]
    # WTG-07 (string 2) is ≈ 8 D east of WTG-01
    assert pos["WTG-07"][0] - pos["WTG-01"][0] == pytest.approx(8 * D, rel=0.03)
