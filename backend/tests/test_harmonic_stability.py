"""Detailed harmonic model with converter Norton equivalents and impedance-based stability."""

from dataclasses import replace

import numpy as np
import pytest

from app.services.p2.harmonic_stability import (
    BUS_A,
    BUS_NAMES,
    DEFAULT_CONVERTER,
    POC,
    ConverterModel,
    assess_stability,
    converter_admittance_pu,
    harmonic_voltages,
    standalone_stability,
    thd_by_bus,
    unstable_pole_count,
)
from app.services.p2.network_model import WTG_TRAFO_VK_PERCENT
from app.services.p2.power_quality import DEFAULT_WTG_EMISSION_PCT, OMEGA0, compute_harmonics


def test_converter_turns_non_passive_above_fs_over_6():
    c = DEFAULT_CONVERTER
    f6 = c.non_passive_from_hz  # 1 / (4 T_d) = f_s / 6
    assert f6 == pytest.approx(2 * c.f_sw_hz / 6)
    assert converter_admittance_pu(0.98 * f6, c).real > 0
    assert converter_admittance_pu(1.02 * f6, c).real < 0


# ── Nyquist counting against the closed-loop poles of a rational model ──


def _rhp_roots_and_nyquist(conv: ConverterModel, l_grid_pu: float, r_grid_pu: float = 0.002):
    """One converter (2nd-order Padé delay) on an R–L grid with its damped C_f branch."""
    t = conv.delay_s
    p = np.polynomial.Polynomial
    s = p([0, 1])
    n_d = 1 - s * t / 2 + (s * t) ** 2 / 12
    d_d = 1 + s * t / 2 + (s * t) ** 2 / 12
    num_ya, den_ya = d_d, s * conv.l_filter_pu / OMEGA0 * d_d + conv.kp_pu * n_d
    z_g = r_grid_pu + s * l_grid_pu / OMEGA0
    sc = s * conv.c_filter_pu / OMEGA0
    damp = 1 + conv.r_damp_pu * sc
    num_z, den_z = z_g * damp, damp + sc * z_g
    char = den_z * den_ya + num_z * num_ya
    rhp = int(np.sum(char.roots().real > 0))
    w = 2 * np.pi * np.geomspace(0.01, 1e6, 400_000)
    jw = 1j * w
    loop = num_z(jw) * num_ya(jw) / (den_z(jw) * den_ya(jw))
    return rhp, unstable_pole_count(np.unwrap(np.angle(1 + loop)))


@pytest.mark.parametrize(
    ("conv", "l_grid"),
    [
        (DEFAULT_CONVERTER, WTG_TRAFO_VK_PERCENT / 100),
        (replace(DEFAULT_CONVERTER, c_filter_pu=0.05, damping_r_pu=0.0), 0.09),
        (replace(DEFAULT_CONVERTER, damping_r_pu=0.0), 0.3),
        (replace(DEFAULT_CONVERTER, bandwidth_hz=700.0), 0.09),
        (replace(DEFAULT_CONVERTER, f_sw_hz=1500.0), 0.2),
        # unstable: undamped / weakly damped LCL above f_s/6, a too-fast current loop
        (replace(DEFAULT_CONVERTER, c_filter_pu=0.03, damping_r_pu=0.0, f_sw_hz=2000.0), 0.09),
        (replace(DEFAULT_CONVERTER, c_filter_pu=0.05, damping_r_pu=0.02), 0.09),
        (replace(DEFAULT_CONVERTER, bandwidth_hz=780.0), 0.5),
        (replace(DEFAULT_CONVERTER, bandwidth_hz=600.0, damping_r_pu=0.0), 1.0),
    ],
)
def test_nyquist_count_equals_rhp_closed_loop_poles(conv, l_grid):
    rhp, counted = _rhp_roots_and_nyquist(conv, l_grid)
    assert counted == rhp


def test_rational_cases_cover_stable_and_unstable():
    stable, _ = _rhp_roots_and_nyquist(DEFAULT_CONVERTER, 0.09)
    unstable, _ = _rhp_roots_and_nyquist(
        replace(DEFAULT_CONVERTER, c_filter_pu=0.05, damping_r_pu=0.0), 0.09
    )
    assert stable == 0
    assert unstable >= 2


# ── Converter type test and farm stability ──


def test_default_converter_is_stable_on_an_ideal_bus():
    c = DEFAULT_CONVERTER
    # LCL resonance below f_s / 6: converter-side current control is inherently stable there
    assert c.lcl_resonance_hz < c.non_passive_from_hz
    poles, margin = standalone_stability(c)
    assert poles == 0
    assert margin > 0.5


def test_undamped_lcl_resonating_above_fs_over_6_is_unstable():
    c = replace(DEFAULT_CONVERTER, c_filter_pu=0.05, damping_r_pu=0.0)
    assert c.lcl_resonance_hz > c.non_passive_from_hz
    poles, _ = standalone_stability(c)
    assert poles >= 2


def test_sb510_farm_is_stable_with_margin():
    r = assess_stability()
    assert r.stable
    assert r.vector_margin > 0.4
    assert r.phase_margin_deg > 30.0
    # the critical interaction lies in the array/LCL range, around the f_s/6 boundary
    assert 500.0 < r.vector_margin_hz < 1000.0


def test_farm_without_filter_damping_is_unstable():
    r = assess_stability(conv=replace(DEFAULT_CONVERTER, damping_r_pu=0.0))
    assert not r.stable
    assert r.unstable_poles >= 2


def test_grid_strength_barely_moves_the_array_mode():
    base = assess_stability()
    weak = assess_stability(grid_ssc_mva=5000.0)
    assert weak.vector_margin == pytest.approx(base.vector_margin, abs=0.03)


# ── Harmonic voltages on the detailed network ──


def test_detailed_network_reproduces_lumped_screen_for_ideal_sources():
    rows = harmonic_voltages(norton=False, coupler_closed=True)
    for kv, node in ((66.0, BUS_A), (400.0, POC)):
        lumped = {
            r["order"]: r["magnitude_pct"]
            for r in compute_harmonics(DEFAULT_WTG_EMISSION_PCT, voltage_kv=kv)["harmonics"]
        }
        for r in rows:
            if r["bus"] == BUS_NAMES[node] and r["order"] <= 11:
                assert r["voltage_pct"] == pytest.approx(lumped[r["order"]], rel=0.05, abs=2e-3)


def test_converter_admittance_damps_harmonic_voltages():
    ideal = thd_by_bus(harmonic_voltages(norton=False))
    norton = thd_by_bus(harmonic_voltages(norton=True))
    for bus in BUS_NAMES:
        assert norton[bus]["thd_pct"] < ideal[bus]["thd_pct"]
        assert norton[bus]["thd_pct"] < norton[bus]["limit_pct"]


def test_converter_stability_endpoint():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    r = client.post("/api/v1/grid/power-quality/converter-stability", json={})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["standalone_stable"] and body["stable"]
    assert body["thd_norton_pct"]["PSE 400 kV (POC)"] < body["thd_limit_pct"]["PSE 400 kV (POC)"]
    bad = client.post(
        "/api/v1/grid/power-quality/converter-stability", json={"bandwidth_hz": 1900.0}
    )
    assert bad.status_code == 422
