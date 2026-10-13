"""
EMT studies (audit 2.2): IEC 60071-2 insulation co-ordination from the statistical switching
overvoltage, transformer inrush against Specht's closed form, TOV after fault clearing.
"""

import pytest

from app.services.p5.emt_studies import (
    PU_KV,
    insulation_coordination,
    simulate_inrush,
    tov_after_fault_clearing,
)


@pytest.mark.validation
def test_lossless_inrush_peak_equals_specht(evidence):
    """R = 0, closing at a voltage zero with 0.8 p.u. residual flux: the simulated first
    peak equals √2·U/(X_s + X_air)·(2 + λ_R − λ_k) (Specht 1951)."""
    r = simulate_inrush(lossless=True, duration_s=0.05)
    ratio = r["first_peak_a"] / r["specht_peak_a"]
    assert ratio == pytest.approx(1.0, abs=0.01)
    evidence(
        "p5-emt-inrush-specht",
        area="P5 — commissioning",
        kind="analytic",
        claim="Transformer inrush (two-slope saturation, flux-linkage integration)",
        against="Specht's closed-form first inrush peak (AIEE Trans. 70, 1951)",
        metric="simulated / closed-form first peak",
        value=ratio,
        unit="–",
        limit="= 1 ± 0.01",
    )


def test_inrush_with_losses_is_lower_and_controlled_closing_cures_it():
    r = simulate_inrush(duration_s=0.3)
    assert 1.0 < r["first_peak_pu_of_rated"] < 10.0
    assert r["first_peak_a"] < r["specht_peak_a"]
    # inrush is rich in 2nd harmonic: what differential relays block on (typ. 15 %)
    assert r["second_harmonic_ratio"] > 0.1
    # closing at the voltage peak with no residual flux: flux starts on its steady path
    assert (
        simulate_inrush(residual_pu=0.0, closing_angle_deg=90.0, duration_s=0.1)["first_peak_a"]
        < 0.01 * r["first_peak_a"]
    )


def test_insulation_coordination_follows_iec_60071_2():
    """U_et = 1.25·U_e2 − 0.25; U_rw = K_s·U_et with K_s = 1.15; Table 2 conversions."""
    ic = insulation_coordination()
    sw = ic["switching"]
    assert 1.0 < sw["ue2_pu"] <= sw["max_pu"] < 3.0
    assert sw["uet_pu"] == pytest.approx(1.25 * sw["ue2_pu"] - 0.25, abs=1e-3)
    assert ic["urw_kv"] == pytest.approx(1.15 * sw["uet_pu"] * PU_KV, rel=1e-3)
    gis = ic["equipment"][0]
    assert gis["required_sdwv_kv"] == pytest.approx(0.7 * ic["urw_kv"], rel=1e-3)
    assert gis["required_liwv_kv"] == pytest.approx(1.25 * ic["urw_kv"], rel=1e-3)
    assert ic["ok"]  # 245 kV levels 460 kV / 1050 kV cover the energisation


def test_tov_after_fault_clearing():
    """Cleared at a current zero, the discharged cable re-charges: below 2.1 p.u., above the
    1.09 p.u. Ferranti steady state."""
    r = tov_after_fault_clearing()
    assert r["steady_far_end_pu"] == pytest.approx(1.09, abs=0.01)
    assert r["steady_far_end_pu"] < r["peak_after_clearing_pu"] < 2.1
