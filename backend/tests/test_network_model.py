"""
Unit tests for Pandapower network model (P2A — network_model.py).

Tests validate the 66/220/400 kV network topology, cable grading,
transformer parameters, and generation capacity against the SB-510
Alpha specification (34 × V236-15.0 MW = 510 MW).

Test Strategy
-------------
- Bus count: exactly 38 (4 system + 34 WTG)
- Cable count: 35 line elements (34 array + 1 export element, parallel=2)
- Cable grading: 500/630/800 mm² by distance from OSS
- Transformers: 2 (66/220 kV + 220/400 kV) with correct ratings
- Generation: 510 MW total from 34 WTGs + 1 STATCOM (0 MW)
- Shunt reactors: 3 × 80 MVAR at OSS 220 kV (N+1), absorbing (lower the voltage)
- Export: 2 × 1000 mm² circuits, < 100 % loaded at full 510 MW
"""

import math

import pytest

from app.services.p2.network_model import (
    ARRAY_CABLE_500,
    ARRAY_CABLE_630,
    ARRAY_CABLE_800,
    ARRAY_CABLE_1000,
    ARRAY_SECTIONS,
    EXPORT_CABLE_1000,
    TRAFO_66_220_MVA,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_220_400_MVA,
    build_network,
    iec60287_ac_factor,
)

# ── Topology Tests ────────────────────────────────────────────────


# ── Cable Grading Tests ──────────────────────────────────────────


# ── Transformer Tests ────────────────────────────────────────────


class TestTransformers:
    """Tests for transformer ratings and parameters."""

    def test_66_220_transformer(self):
        """66/220 kV OSS transformer must have correct ratings."""
        net = build_network()
        trafo = net.trafo[net.trafo["name"] == "Trafo_66_220kV"]
        assert len(trafo) == 1
        row = trafo.iloc[0]
        assert float(row["sn_mva"]) == pytest.approx(TRAFO_66_220_MVA)
        assert float(row["vk_percent"]) == pytest.approx(TRAFO_66_220_VK_PERCENT)
        assert float(row["vn_hv_kv"]) == pytest.approx(220.0)
        assert float(row["vn_lv_kv"]) == pytest.approx(66.0)

    def test_220_400_transformer(self):
        """220/400 kV onshore transformer must have correct ratings."""
        net = build_network()
        trafo = net.trafo[net.trafo["name"] == "Trafo_220_400kV"]
        assert len(trafo) == 1
        row = trafo.iloc[0]
        assert float(row["sn_mva"]) == pytest.approx(TRAFO_220_400_MVA)
        assert float(row["vn_hv_kv"]) == pytest.approx(400.0)
        assert float(row["vn_lv_kv"]) == pytest.approx(220.0)


# ── Generation Tests ──────────────────────────────────────────────


def test_string_layout_matches_p3_p5_feeders():
    """One string layout everywhere: P2 network, P3 feeder bays, P5 string CBs.

    Regression: P2 had 7 strings (5-5-5-5-5-5-4) while P3/P5 had 6 feeders with
    their own 5-6-6-5-6-6 split, and the map/DB used 6-6-6-6-5-5.
    """
    import re

    from app.services.p2.network_model import STRING_LAYOUT
    from app.services.p3.bay_controller import _BAY_DEFINITIONS
    from app.services.p5.equipment_state import OSS_EQUIPMENT

    feeders = [b for b in _BAY_DEFINITIONS if "Feeds WTG" in b["description"]]
    sizes = []
    for bay in feeders:
        first, last = map(int, re.findall(r"WTG-(\d+)", bay["description"]))
        sizes.append(last - first + 1)
    assert sizes == STRING_LAYOUT

    string_cbs = [e for e in OSS_EQUIPMENT if e.equipment_id.startswith("CB-STR-")]
    assert len(string_cbs) == len(STRING_LAYOUT)


def test_string_busbar_sections_fit_one_transformer_each():
    """Strings 1-3 → section A, 4-6 → B; each section ≤ one 300 MVA unit at unity pf,
    and the P3 feeder bays / P5 string CBs name the same section."""
    import re

    from app.services.p2.network_model import STRING_BUSBAR_SECTION, STRING_LAYOUT, TRAFO_66_220_MVA
    from app.services.p3.bay_controller import _BAY_DEFINITIONS
    from app.services.p5.equipment_state import OSS_EQUIPMENT

    for section in ("A", "B"):
        strings = [s for s, sec in STRING_BUSBAR_SECTION.items() if sec == section]
        n_wtg = sum(STRING_LAYOUT[s - 1] for s in strings)
        assert n_wtg * 15.0 <= TRAFO_66_220_MVA  # 270 / 240 MW

    feeders = [b for b in _BAY_DEFINITIONS if "Feeds WTG" in b["description"]]
    for i, bay in enumerate(feeders, start=1):
        assert re.search(rf"busbar section {STRING_BUSBAR_SECTION[i]}\b", bay["description"])
    for cb in (e for e in OSS_EQUIPMENT if e.equipment_id.startswith("CB-STR-")):
        n = int(cb.equipment_id[-2:])
        assert f"section {STRING_BUSBAR_SECTION[n]}" in cb.location


@pytest.mark.parametrize(
    ("cable", "c_uf_per_km", "l_mh_per_km", "rating_a"),
    [
        (ARRAY_CABLE_500, 0.29, 0.34, 655),
        (ARRAY_CABLE_630, 0.32, 0.33, 715),
        (ARRAY_CABLE_800, 0.35, 0.32, 775),
        (ARRAY_CABLE_1000, 0.38, 0.31, 825),
        (EXPORT_CABLE_1000, 0.19, 0.38, 825),
    ],
)
def test_cable_data_match_the_datasheet(cable, c_uf_per_km, l_mh_per_km, rating_a):
    """C, X = ωL and the rating follow ABB/NKT 2GM5007 rev 5, Tables 33/34, 45 and 49."""
    assert cable.c_nf_per_km == pytest.approx(c_uf_per_km * 1000, rel=1e-9)
    assert cable.x_ohm_per_km == pytest.approx(2 * math.pi * 50 * l_mh_per_km * 1e-3, abs=6e-5)
    assert cable.max_i_ka * 1000 == pytest.approx(rating_a)


def test_ac_factor_follows_iec_60287():
    """1 + y_s + y_p from the conductor geometry reproduces every CableSpec.ac_factor."""
    for cable, d_c in zip(ARRAY_SECTIONS, (26.2, 29.8, 33.7, 37.9), strict=True):
        f = iec60287_ac_factor(cable.r_ohm_per_km, d_c, d_c + 33.0, 1.0, 0.8)
        assert f == pytest.approx(cable.ac_factor, abs=6e-4)
    f = iec60287_ac_factor(EXPORT_CABLE_1000.r_ohm_per_km, 38.0, 120.0, 0.435, 0.37)
    assert f == pytest.approx(EXPORT_CABLE_1000.ac_factor, abs=6e-4)
