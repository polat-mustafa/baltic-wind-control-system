"""Tower + jacket natural frequencies (B-6) and the hindcast's extreme sea state."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.lifecycle.weather import extreme_hs
from app.services.turbine_physics.support_structure import (
    REFERENCE_JACKET_HZ,
    SOFT_STIFF_MARGIN,
    jacket_modes,
)


@pytest.mark.validation
def test_first_frequency_matches_deme_openfast_reference(evidence):
    m = jacket_modes()
    evidence(
        "ts-jacket-f1",
        area="Turbine physics — structure",
        kind="reference",
        claim="3D frame FE of the IEA 15 MW tower on the 50 m jacket with the rigid RNA",
        against="DEME's OpenFAST/SubDyn model of the same turbine and jacket (free decay)",
        metric="first natural frequency",
        value=m.first_bending_hz,
        unit="Hz",
        limit="= 0.221 Hz ± 3 %",
    )
    # DEME's OpenFAST free decay of the same turbine on the same jacket: 0.221 Hz
    assert m.first_bending_hz == pytest.approx(REFERENCE_JACKET_HZ, rel=0.03)


def test_fore_aft_and_side_side_modes_are_a_near_pair():
    f = jacket_modes().frequencies_hz
    # the 3-legged jacket is near axisymmetric; RNA overhang splits FA/SS by a few percent
    assert f[1] / f[0] == pytest.approx(1.0, abs=0.05)
    # second bending pair well above the first
    assert f[2] > 3 * f[0]


def test_soft_stiff_design_clears_1p_and_3p_bands():
    m = jacket_modes()
    assert m.band_1p_hz == pytest.approx((5.0 / 60, 7.56 / 60), abs=1e-3)
    assert m.band_3p_hz == pytest.approx((0.25, 3 * 7.56 / 60), abs=1e-3)
    assert m.band_1p_hz[1] < m.first_bending_hz < m.band_3p_hz[0]
    assert m.soft_stiff_ok
    assert m.margin_to_1p >= SOFT_STIFF_MARGIN
    assert m.margin_to_3p >= SOFT_STIFF_MARGIN


def test_mesh_converged():
    coarse = jacket_modes(tower_elements_per_station=1).first_bending_hz
    fine = jacket_modes(tower_elements_per_station=3).first_bending_hz
    assert fine == pytest.approx(coarse, rel=0.005)


def test_wave_band_far_below_first_mode():
    m = jacket_modes()
    assert m.wave_band_hz[1] < 0.5 * m.first_bending_hz


def test_extreme_hs_from_30_annual_maxima():
    sea = extreme_hs(50.0)
    assert len(sea.annual_maxima_m) == 30
    assert max(sea.annual_maxima_m) == pytest.approx(8.47, abs=0.01)
    # southern Baltic offshore: Hs50 ≈ 7–9 m
    assert 7.0 < sea.hs_m < 9.0
    # return level grows with the return period
    assert extreme_hs(10.0).hs_m < sea.hs_m < extreme_hs(100.0).hs_m
    lo, hi = sea.tp_range_s
    assert lo == pytest.approx(3.6 * sea.hs_m**0.5, abs=0.1)
    assert hi == pytest.approx(5.0 * sea.hs_m**0.5, abs=0.1)


def test_support_structure_endpoint():
    r = TestClient(app).get("/api/v1/turbine-physics/support-structure")
    assert r.status_code == 200
    body = r.json()
    assert body["soft_stiff_ok"] is True
    assert body["reference_hz"] == REFERENCE_JACKET_HZ
    assert body["band_1p_hz"][1] < body["first_bending_hz"] < body["band_3p_hz"][0]
