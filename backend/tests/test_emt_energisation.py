"""
EMT of energising export cable 1 (engineering audit B-4): the integration is checked
against closed-form results before its zero-missing verdicts are trusted.
"""

import math

import numpy as np
import pytest

from app.services.p2.network_model import EXPORT_CABLE_1000, SB510
from app.services.p5.emt_energisation import DT_S, _source_inductance_h, simulate_energisation
from app.services.p5.energisation import ferranti_ratio


@pytest.fixture(scope="module")
def open_cable():
    return simulate_energisation(
        closing_angle_deg=90.0, pole_scatter_ms=(0, 0, 0), with_reactor=False, duration_s=0.4
    )


@pytest.mark.validation
def test_steady_state_is_the_ferranti_rise(open_cable, evidence):
    """Last cycle: far end / busbar = 1/cos(βl) of the long line (0.1 %)."""
    n = round(0.02 / DT_S)
    far = open_cable.far_end_voltage_kv[0, -n:].max()
    bus = open_cable.busbar_voltage_kv[0, -n:].max()
    assert far / bus == pytest.approx(ferranti_ratio(108.0), rel=1e-3)
    evidence(
        "p5-emt-ferranti",
        area="P5 — commissioning",
        kind="analytic",
        claim="EMT (Dommel trapezoidal, π-sections) of energising the open 108 km export cable",
        against="long-line Ferranti ratio 1/cos(βl)",
        metric="steady far-end / busbar voltage ÷ analytic",
        value=far / bus / ferranti_ratio(108.0),
        unit="−",
        limit="= 1 ± 0.001",
    )


@pytest.mark.validation
def test_energisation_rings_at_the_source_cable_frequency(open_cable, evidence):
    """The inrush rings at 1/(2π√(L·C)) with L = L_source + L_cable/3 (open line at low
    frequency) and C the cable's total capacitance — ≈ 147 Hz on SB-510."""
    seg = open_cable.far_end_voltage_kv[0, : round(0.06 / DT_S)]
    t = np.arange(seg.size) * DT_S
    basis = np.vstack([np.sin(2 * math.pi * 50 * t), np.cos(2 * math.pi * 50 * t)]).T
    fit, *_ = np.linalg.lstsq(basis, seg, rcond=None)
    ring = seg - basis @ fit
    f = np.fft.rfftfreq(ring.size, DT_S)[np.abs(np.fft.rfft(ring)).argmax()]
    l_src, _r = _source_inductance_h(SB510)
    l_cab = EXPORT_CABLE_1000.x_ohm_per_km / (2 * math.pi * 50) * 108.0
    c = EXPORT_CABLE_1000.c_nf_per_km * 1e-9 * 108.0
    analytic = 1 / (2 * math.pi * math.sqrt((l_src + l_cab / 3) * c))
    assert f == pytest.approx(analytic, rel=0.08)
    evidence(
        "p5-emt-ringing",
        area="P5 — commissioning",
        kind="analytic",
        claim="EMT inrush oscillation after closing onto the open export cable",
        against="1/(2π√((L_source + L_cable/3)·C_cable))",
        metric="dominant ringing frequency ÷ analytic",
        value=f / analytic,
        unit="−",
        limit="= 1 ± 0.08",
        tolerance=0.05,
    )
    assert 1.6 < open_cable.peak_far_end_pu < 2.2  # ≤ 2 p.u. + the Ferranti rise


def test_closing_at_a_voltage_zero_misses_current_zeros():
    """58 % line-reactor compensation: closing phase a at its voltage zero gives the reactor
    a DC offset larger than the remaining 50 Hz current (CIGRE TB 556)."""
    r = simulate_energisation(closing_angle_deg=0.0, pole_scatter_ms=(0, 0, 0), duration_s=0.5)
    assert r.dc_over_ac[0] > 1.0 and r.zero_missing and r.zero_missing_ms[0] >= 40.0


def test_point_on_wave_or_pre_insertion_resistor_cures_it():
    pow_ = simulate_energisation(
        closing_angle_deg=90.0, pole_scatter_ms=(0, 20 / 3, 40 / 3), duration_s=0.5
    )
    assert not pow_.zero_missing and max(pow_.dc_over_ac) < 0.2
    pir = simulate_energisation(closing_angle_deg=0.0, pre_insertion=True, duration_s=0.5)
    assert not pir.zero_missing
    # the resistor also damps the switching overvoltage
    base = simulate_energisation(closing_angle_deg=0.0, duration_s=0.5)
    assert pir.peak_far_end_pu < base.peak_far_end_pu
