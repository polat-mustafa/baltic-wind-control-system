"""
Engineering audit phase A (F1–F4): plant equipment and losses in the P2 network, the
thermal-aware reactor choice, and the annual electrical loss / availability in the AEP
cascade. Each test states the physics it checks; values in MW, Mvar, A, %.
"""

import copy

import pandapower as pp
import pytest

from app.schemas.grid import LoadFlowScenario
from app.services.lifecycle.availability_model import FAILURE_CLASSES, availability
from app.services.p2.annual_losses import annual_electrical_loss, loss_curve
from app.services.p2.load_flow import (
    auto_statcom_dispatch,
    dispatch_with_reactor_switching,
    run_load_flow,
)
from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    REACTOR_LOSS_PERCENT,
    SB510,
    TAN_DELTA_XLPE,
    build_network,
    exact_pi_per_km,
    export_charging_mvar,
    loss_breakdown_mw,
    statcom_loss_mw,
)
from app.services.site_assessment.wind_climate import SB510_WEIBULL_A, SB510_WEIBULL_K


def _solved(**kw) -> pp.pandapowerNet:
    net = build_network(generation_fraction=1.0, **kw)
    dispatch_with_reactor_switching(net, SB510.statcom_mvar)
    pp.runpp(net, algorithm="nr", tolerance_mva=1e-8)
    return net


@pytest.fixture(scope="module")
def full_net() -> pp.pandapowerNet:
    return _solved()


# ── F2: plant equipment ──────────────────────────────────────────


def test_every_turbine_has_a_step_up_transformer(full_net):
    units = full_net.trafo[full_net.trafo.name.str.startswith("WTG_TX_")]
    assert len(units) == SB510.num_turbines
    assert units.sn_mva.unique().tolist() == [pytest.approx(17.0)]
    # the converters sit behind them, on their own terminal buses
    wtg = full_net.sgen[full_net.sgen.name.str.startswith("WTG_")]
    assert set(full_net.bus.loc[wtg.bus, "name"].str.endswith("_LV")) == {True}


def test_loss_breakdown_closes_the_power_balance(full_net):
    """WTG output − POC export = Σ losses + auxiliary (to load-flow accuracy)."""
    wtg = full_net.res_sgen.p_mw[full_net.sgen.name.str.startswith("WTG_")].sum()
    poc = -full_net.res_ext_grid.p_mw.sum()
    assert sum(loss_breakdown_mw(full_net).values()) == pytest.approx(wtg - poc, abs=1e-3)


def test_reactor_and_statcom_losses():
    """Reactors: 0.2 % of 180 Mvar = 0.36 MW each at 1 p.u.; STATCOM 0.2 % standby + 1 % |Q|."""
    net = build_network(generation_fraction=0.0)
    r = net.shunt[net.shunt.name.str.startswith("Reactor_")]
    assert r.p_mw.tolist() == [pytest.approx(REACTOR_LOSS_PERCENT / 100 * 180.0)] * 4
    assert statcom_loss_mw(0.0, 120.0) == pytest.approx(0.24)
    assert statcom_loss_mw(-100.0, 120.0) == pytest.approx(0.24 + 1.0)


# ── F4: export cable as the exact long-line π ────────────────────


def test_exact_pi_has_the_dielectric_loss_and_the_longer_line_charging(monkeypatch):
    import app.services.p2.network_model as nm

    r90 = EXPORT_CABLE_1000.r_ac_ohm_per_km
    r, x, c, g = exact_pi_per_km(EXPORT_CABLE_1000, 108.0, r90)
    # sinh(γl)/(γl) < 1: the series impedance of a long line is a little smaller …
    assert r < r90 and x < EXPORT_CABLE_1000.x_ohm_per_km
    # … and tanh(γl/2)/(γl/2) > 1 for the shunt: slightly more charging than ωCl
    assert c == pytest.approx(191.3, abs=0.1)
    # The tan δ part of G is the dielectric loss ωCU²·tan δ: 0.31 MW per circuit at 220 kV
    # (the rest of G is the distributed line's own I²R correction, there without tan δ too)
    monkeypatch.setattr(nm, "TAN_DELTA_XLPE", 0.0)
    g0 = exact_pi_per_km(EXPORT_CABLE_1000, 108.0, r90)[3]
    p_diel = (g - g0) * 1e-6 * 108.0 * 220.0**2
    assert p_diel == pytest.approx(export_charging_mvar(108.0) * TAN_DELTA_XLPE, rel=0.02)


def test_exact_pi_matches_a_finely_sectioned_cable():
    """Audit acceptance A-3: export-cable loss within 1 % of 54 × 2 km π sections."""
    net = _solved()
    exact = loss_breakdown_mw(net)["export_cable"]

    fine = copy.deepcopy(net)
    li = fine.line.index[fine.line.name == "Export_220kV"][0]
    row = fine.line.loc[li]
    fine.line.drop(li, inplace=True)
    r90 = EXPORT_CABLE_1000.r_ac_ohm_per_km
    c = EXPORT_CABLE_1000.c_nf_per_km
    g = 2 * 3.141592653589793 * 50 * c * 1e-9 * TAN_DELTA_XLPE * 1e6  # µS/km
    prev = int(row.from_bus)
    for k in range(54):
        nxt = int(row.to_bus) if k == 53 else pp.create_bus(fine, vn_kv=220.0)
        pp.create_line_from_parameters(
            fine, prev, nxt, 2.0, r90, EXPORT_CABLE_1000.x_ohm_per_km, c, 0.825,
            g_us_per_km=g, parallel=2, name=f"Export_220kV_{k}",
        )  # fmt: skip
        prev = nxt
    pp.runpp(fine, algorithm="nr", tolerance_mva=1e-8)
    sectioned = fine.res_line.pl_mw[fine.line.name.str.startswith("Export_220kV_")].sum()
    assert exact == pytest.approx(sectioned, rel=0.01)


# ── F1: reactor choice weighs the cable current ──────────────────


def test_full_load_export_stays_below_95_percent():
    """Audit acceptance A-1 (with the WTG transformers in): ≤ 95 % at 510 MW."""
    r = run_load_flow(LoadFlowScenario.FULL_LOAD)
    export = next(line for line in r.lines if line.name == "Export_220kV")
    assert r.converged and r.voltage_compliant
    assert export.loading_percent <= 95.0
    assert abs(r.statcom_q_mvar) <= SB510.statcom_mvar


def test_taking_the_oss_reactor_out_relieves_the_cable(full_net):
    """At full output the OSS end carries the larger current; the operator's choice
    (an OSS reactor out) beats the onshore one by several points of cable loading."""
    off = full_net.shunt[~full_net.shunt.in_service & full_net.shunt.name.str.startswith("Reactor")]
    assert off.name.str.startswith("Reactor_OSS").all() and len(off) >= 1
    net = build_network(generation_fraction=1.0)
    net.shunt.loc[net.shunt.name == "Reactor_ONS_1_180MVAR", "in_service"] = False
    auto_statcom_dispatch(net, tolerance_pu=0.002)
    ons_out = net.res_line.loading_percent[net.line.name == "Export_220kV"].iloc[0]
    chosen = full_net.res_line.loading_percent[full_net.line.name == "Export_220kV"].iloc[0]
    assert ons_out > 100.0 > chosen + 5.0


# ── F3: annual electrical loss and availability ──────────────────


def test_loss_curve_rises_with_output():
    fractions, total, parts = loss_curve(SB510)
    assert fractions[0] == 0.0 and fractions[-1] == 1.0
    assert (total[1:] > total[:-1]).all()
    assert parts["export_cable"][-1] > parts["export_cable"][0]
    assert parts["shunt_reactors"][0] > 1.0  # voltage-driven, there with no wind


def test_annual_electrical_loss_of_sb510():
    """Between the no-load share and the full-load share (3.4 %); ~3–5 % for a 108 km
    HVAC export with its reactors, all transformer stages and the OSS auxiliary load."""
    loss = annual_electrical_loss(SB510_WEIBULL_A, SB510_WEIBULL_K, 0.10, SB510)
    assert 0.03 < loss.fraction < 0.05
    assert loss.loss_gwh == pytest.approx(sum(loss.breakdown_gwh.values()), rel=1e-6)
    assert loss.breakdown_gwh["export_cable"] == max(loss.breakdown_gwh.values())
    # a windier site spreads the fixed losses over more energy
    windy = annual_electrical_loss(SB510_WEIBULL_A + 1.5, SB510_WEIBULL_K, 0.10, SB510)
    assert windy.fraction < loss.fraction


def test_availability_from_failure_rates_and_weather():
    a = availability()
    # Carroll et al. 2016 era offshore fleets: low 90s %; storms make energy-based ≤ time-based
    assert 0.90 < a.energy_based <= a.time_based + 1e-9 < 0.97
    by = {c.name: c for c in a.classes}
    assert [c.name for c in FAILURE_CLASSES] == list(by)
    # a jack-up job waits longer than a CTV visit, and its lead time dominates the loss
    assert by["Major replacement"].mean_wait_h > by["Minor repair"].mean_wait_h
    assert by["Major replacement"].hours_lost_per_year > by["Major repair"].hours_lost_per_year
