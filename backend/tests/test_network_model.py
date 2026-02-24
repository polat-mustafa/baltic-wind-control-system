"""
Unit tests for Pandapower network model (P2A — network_model.py).

Tests validate the 66/220/400 kV network topology, cable grading,
transformer parameters, and generation capacity against the Baltic Wind
Alpha specification (34 × V236-15.0 MW = 510 MW).

Test Strategy
-------------
- Bus count: exactly 38 (4 system + 34 WTG)
- Cable count: 35 (34 array + 1 export)
- Cable grading: 500/630/800 mm² by distance from OSS
- Transformers: 2 (66/220 kV + 220/400 kV) with correct ratings
- Generation: 510 MW total from 34 WTGs + 1 STATCOM (0 MW)
- Shunt reactor: 50 MVAR at OSS 220 kV
"""

import numpy as np
import pytest

from app.services.p2.network_model import (
    ARRAY_CABLE_500,
    ARRAY_CABLE_630,
    ARRAY_CABLE_800,
    EXPORT_CABLE_1000,
    NUM_STRINGS,
    NUM_TURBINES,
    SHUNT_REACTOR_MVAR,
    TOTAL_CAPACITY_MW,
    TRAFO_66_220_MVA,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_220_400_MVA,
    build_network,
    get_bus_count,
    get_cable_grades_summary,
    get_total_generation_mw,
)

# ── Topology Tests ────────────────────────────────────────────────


class TestNetworkTopology:
    """Tests for network bus/element counts and structure."""

    def test_bus_count(self):
        """Network must have exactly 38 buses (4 system + 34 WTG)."""
        net = build_network()
        assert get_bus_count(net) == 38

    def test_bus_names(self):
        """System buses must be named correctly."""
        net = build_network()
        bus_names = list(net.bus["name"])
        assert "PSE_400kV" in bus_names
        assert "Onshore_220kV" in bus_names
        assert "OSS_220kV" in bus_names
        assert "OSS_66kV" in bus_names

    def test_wtg_bus_count(self):
        """Must have exactly 34 WTG buses on 66 kV."""
        net = build_network()
        wtg_buses = [n for n in net.bus["name"] if n.startswith("WTG_")]
        assert len(wtg_buses) == NUM_TURBINES

    def test_wtg_buses_at_66kv(self):
        """All WTG buses must be on 66 kV nominal."""
        net = build_network()
        for idx in range(len(net.bus)):
            name = str(net.bus.at[idx, "name"])
            if name.startswith("WTG_"):
                assert float(net.bus.at[idx, "vn_kv"]) == 66.0

    def test_line_count(self):
        """Network must have exactly 35 cables (34 array + 1 export)."""
        net = build_network()
        assert len(net.line) == 35

    def test_export_cable_exists(self):
        """Export cable must exist with correct parameters."""
        net = build_network()
        export_lines = net.line[net.line["name"] == "Export_220kV"]
        assert len(export_lines) == 1
        row = export_lines.iloc[0]
        assert float(row["length_km"]) == pytest.approx(45.0)
        assert float(row["r_ohm_per_km"]) == pytest.approx(
            EXPORT_CABLE_1000.r_ohm_per_km, abs=1e-4
        )

    def test_transformer_count(self):
        """Network must have exactly 2 transformers."""
        net = build_network()
        assert len(net.trafo) == 2

    def test_external_grid_exists(self):
        """External grid (slack bus) must exist at PSE 400 kV."""
        net = build_network()
        assert len(net.ext_grid) == 1
        assert str(net.ext_grid.at[0, "name"]) == "PSE_Grid"


# ── Cable Grading Tests ──────────────────────────────────────────


class TestCableGrading:
    """Tests for array cable cross-section grading by OSS distance."""

    def test_cable_grades_present(self):
        """All three cable grades must be used in array cables."""
        net = build_network()
        grades = get_cable_grades_summary(net)
        assert grades["500mm2"] > 0, "No 500 mm² cables found"
        assert grades["630mm2"] > 0, "No 630 mm² cables found"
        assert grades["800mm2"] > 0, "No 800 mm² cables found"

    def test_total_array_cables(self):
        """Total graded cables must equal 34 (one per WTG)."""
        net = build_network()
        grades = get_cable_grades_summary(net)
        total = sum(grades.values())
        assert total == NUM_TURBINES

    def test_cable_resistance_ranges(self):
        """Cable R values must match the three specified grades."""
        net = build_network()
        valid_r = {
            ARRAY_CABLE_500.r_ohm_per_km,
            ARRAY_CABLE_630.r_ohm_per_km,
            ARRAY_CABLE_800.r_ohm_per_km,
            EXPORT_CABLE_1000.r_ohm_per_km,
        }
        for idx in range(len(net.line)):
            r = float(net.line.at[idx, "r_ohm_per_km"])
            assert any(
                np.isclose(r, vr, atol=1e-4) for vr in valid_r
            ), f"Unexpected R={r} Ω/km in cable {net.line.at[idx, 'name']}"


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


class TestGeneration:
    """Tests for WTG and STATCOM generation elements."""

    def test_total_generation_full_load(self):
        """Total generation at full load must be 510 MW."""
        net = build_network(generation_fraction=1.0)
        # Total includes STATCOM (P=0), so subtract
        total = get_total_generation_mw(net)
        assert total == pytest.approx(TOTAL_CAPACITY_MW, abs=1.0)

    def test_total_generation_partial_load(self):
        """Total generation at 50% load must be 255 MW."""
        net = build_network(generation_fraction=0.5)
        total = get_total_generation_mw(net)
        assert total == pytest.approx(255.0, abs=1.0)

    def test_total_generation_no_load(self):
        """Total generation at no-load must be 0 MW."""
        net = build_network(generation_fraction=0.0)
        total = get_total_generation_mw(net)
        assert total == pytest.approx(0.0, abs=0.1)

    def test_sgen_count(self):
        """Must have 35 sgens (34 WTGs + 1 STATCOM)."""
        net = build_network()
        assert len(net.sgen) == NUM_TURBINES + 1  # +1 for STATCOM

    def test_statcom_present(self):
        """STATCOM sgen must exist with P=0."""
        net = build_network()
        statcom = net.sgen[net.sgen["name"] == "STATCOM"]
        assert len(statcom) == 1
        assert float(statcom.iloc[0]["p_mw"]) == pytest.approx(0.0)

    def test_shunt_reactor_present(self):
        """50 MVAR shunt reactor must be present at OSS 220 kV."""
        net = build_network(enable_reactor=True)
        assert len(net.shunt) == 1
        assert float(net.shunt.at[0, "q_mvar"]) == pytest.approx(
            -SHUNT_REACTOR_MVAR, abs=1.0
        )

    def test_no_reactor_when_disabled(self):
        """Shunt reactor must be absent when disabled."""
        net = build_network(enable_reactor=False)
        assert len(net.shunt) == 0

    def test_string_layout(self):
        """String layout must produce exactly 34 WTGs across 7 strings."""
        net = build_network()
        array_lines = [n for n in net.line["name"] if n.startswith("Array_")]
        # Count unique string prefixes
        strings = set()
        for name in array_lines:
            parts = name.split("_")
            strings.add(parts[1])  # S1, S2, ...
        assert len(strings) == NUM_STRINGS
