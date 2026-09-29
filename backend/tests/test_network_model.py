"""
Unit tests for Pandapower network model (P2A — network_model.py).

Tests validate the 66/220/400 kV network topology, cable grading,
transformer parameters, and generation capacity against the Baltic Wind
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

import numpy as np
import pandapower as pp
import pytest

from app.services.p2.network_model import (
    ARRAY_CABLE_500,
    ARRAY_CABLE_630,
    ARRAY_CABLE_800,
    EXPORT_CABLE_1000,
    NUM_EXPORT_CABLES,
    NUM_SHUNT_REACTORS,
    NUM_STRINGS,
    NUM_TURBINES,
    SHUNT_REACTOR_MVAR,
    SHUNT_REACTOR_UNIT_MVAR,
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
        # load flow uses the 90 °C AC resistance
        assert float(row["r_ohm_per_km"]) == pytest.approx(EXPORT_CABLE_1000.r_ac_ohm_per_km)
        assert int(row["parallel"]) == NUM_EXPORT_CABLES == 2

    def test_export_cables_not_overloaded_at_full_load(self):
        """510 MW must fit in the export circuits (1 × 362 MVA would be ~140 %)."""
        net = build_network(generation_fraction=1.0)
        pp.runpp(net)
        export_idx = net.line.index[net.line["name"] == "Export_220kV"][0]
        loading = float(net.res_line.at[export_idx, "loading_percent"])
        assert loading < 100.0, f"Export loading {loading:.1f} % — cable undersized"

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

    @pytest.mark.parametrize("operating", [True, False])
    def test_cable_resistance_ranges(self, operating):
        """Cable R values must match the specified grades (90 °C AC or 20 °C DC build)."""
        net = build_network(r_at_operating_temp=operating)
        specs = (ARRAY_CABLE_500, ARRAY_CABLE_630, ARRAY_CABLE_800, EXPORT_CABLE_1000)
        valid_r = {c.r_ac_ohm_per_km if operating else c.r_ohm_per_km for c in specs}
        for idx in range(len(net.line)):
            r = float(net.line.at[idx, "r_ohm_per_km"])
            assert any(np.isclose(r, vr, atol=1e-4) for vr in valid_r), (
                f"Unexpected R={r} Ω/km in cable {net.line.at[idx, 'name']}"
            )

    @pytest.mark.parametrize(
        ("spec", "expected_r90"),
        [
            (ARRAY_CABLE_500, 0.0493),
            (ARRAY_CABLE_630, 0.0395),
            (ARRAY_CABLE_800, 0.0325),
            (EXPORT_CABLE_1000, 0.0233),
        ],
    )
    def test_ac_resistance_at_90c(self, spec, expected_r90):
        """R_AC,90 = R20 × (1 + 0.00393 × 70) × (1 + y_s + y_p)  (IEC 60287-1-1 §2.1)."""
        assert spec.r_ac_ohm_per_km == pytest.approx(expected_r90, abs=0.0002)
        assert 1.3 < spec.r_ac_ohm_per_km / spec.r_ohm_per_km < 1.5

    def test_hot_resistance_raises_losses(self):
        """Same dispatch, 90 °C cables → more active power losses than 20 °C cables."""

        def losses_mw(operating: bool) -> float:
            net = build_network(generation_fraction=1.0, r_at_operating_temp=operating)
            pp.runpp(net)
            return float(net.res_line.pl_mw.sum())

        assert losses_mw(True) > 1.25 * losses_mw(False)


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
        """3 × 80 MVAR shunt reactors (N+1) must be present at OSS 220 kV."""
        net = build_network(enable_reactor=True)
        assert len(net.shunt) == NUM_SHUNT_REACTORS == 3
        # pandapower shunts use the load convention: q_mvar > 0 = absorbing
        assert list(net.shunt["q_mvar"]) == pytest.approx([SHUNT_REACTOR_UNIT_MVAR] * 3)
        assert float(net.shunt["q_mvar"].sum()) == pytest.approx(SHUNT_REACTOR_MVAR)

    def test_shunt_reactor_lowers_voltage(self):
        """A reactor absorbs Q, so switching it in must LOWER the OSS voltage.

        Regression: the reactor was once modelled with the wrong sign and acted
        as a capacitor bank (voltage went up from 1.044 to 1.063 pu).
        """

        def v_oss(enable_reactor: bool) -> float:
            net = build_network(generation_fraction=0.0, enable_reactor=enable_reactor)
            pp.runpp(net)
            oss = net.bus.index[net.bus["name"] == "OSS_220kV"][0]
            return float(net.res_bus.at[oss, "vm_pu"])

        assert v_oss(True) < v_oss(False)

    def test_no_reactor_when_disabled(self):
        """Shunt reactor must be absent when disabled."""
        net = build_network(enable_reactor=False)
        assert len(net.shunt) == 0

    def test_string_layout(self):
        """String layout must produce exactly 34 WTGs across 6 strings (6-6-6-6-5-5)."""
        net = build_network()
        array_lines = [n for n in net.line["name"] if n.startswith("Array_")]
        # Count unique string prefixes
        strings = set()
        for name in array_lines:
            parts = name.split("_")
            strings.add(parts[1])  # S1, S2, ...
        assert len(strings) == NUM_STRINGS


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
