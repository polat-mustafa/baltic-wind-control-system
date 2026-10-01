"""The seeded turbine layout must match the map (frontend constants/windFarmLayout.ts)."""

import math

import pytest

from app.seed import STAGGER_OFFSET_M, STRING_SPACING_M, TURBINE_SPACING_M, _generate_positions
from app.services.p2.network_model import STRING_LAYOUT


def test_spacing_matches_map_layout():
    """8D between strings, 6D along a string, 700 m stagger on even strings (V236, D = 236 m)."""
    assert pytest.approx(1888.0) == STRING_SPACING_M
    assert pytest.approx(1416.0) == TURBINE_SPACING_M
    pos = {p["turbine_id"]: (p["x_m"], p["y_m"]) for p in _generate_positions()}
    assert len(pos) == sum(STRING_LAYOUT) == 34
    # WTG-01 → WTG-02: same string, 6D south
    assert math.dist(pos["WTG-01"], pos["WTG-02"]) == pytest.approx(TURBINE_SPACING_M)
    assert pos["WTG-02"][1] < pos["WTG-01"][1]
    # WTG-07 (string 2) is 8D east and staggered 700 m south of WTG-01
    assert pos["WTG-07"][0] - pos["WTG-01"][0] == pytest.approx(STRING_SPACING_M)
    assert pos["WTG-01"][1] - pos["WTG-07"][1] == pytest.approx(STAGGER_OFFSET_M)
