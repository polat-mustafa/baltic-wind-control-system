"""
P2 engines against hand calculations (evidence programme B2).

The other P2 tests check our formulas against themselves; these check the engines
(pandapower load flow and IEC 60909 short circuit) against independent closed-form
results, so a wrong parameter, unit or sign in how we drive them shows up.

- Cable charging and Ferranti rise: the 108 km SB-510 export circuit, energised from
  220 kV with the far end open. pandapower must equal a hand π-model to 1e-6, and the
  π-model must stay within 0.1 % of the exact distributed line, V_r/V_s = 1/cosh(γl)
  (Grainger & Stevenson, Power System Analysis, ch. 6).
- IEC 60909-0:2016 network feeder + transformer: Z_Q = c·U_nQ²/S"_kQ, Z_TK = K_T·Z_T,
  K_T = 0.95·c_max/(1 + 0.6·x_T) for maximum currents (1 for minimum, §6.3.3),
  I"_k = c·U_n/(√3·|Z_k|), i_p = κ·√2·I"_k with κ = 1.02 + 0.98·e^(−3R/X).
- LFSM-O (ΔP = −P_max/0.05·(f − 50.2)/50, 204 MW/Hz) is already checked by hand number
  in ``test_ppc.py`` and against ANDES in ``test_andes_dynamics.py``.
"""

import cmath
import math

import pandapower as pp
import pandapower.shortcircuit as sc
import pytest

from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    OMEGA,
    export_charging_mvar,
)
from app.services.p2.statcom_sizing import ferranti_rise_pu

L_KM = EXPORT_CABLE_LENGTH_KM  # 108 km
U_KV = 220.0
CAB = EXPORT_CABLE_1000


def _open_ended_cable() -> pp.pandapowerNet:
    net = pp.create_empty_network(f_hz=50.0)
    send, recv = pp.create_bus(net, U_KV), pp.create_bus(net, U_KV)
    pp.create_ext_grid(net, send, vm_pu=1.0)
    pp.create_line_from_parameters(
        net, send, recv, L_KM, CAB.r_ohm_per_km, CAB.x_ohm_per_km, CAB.c_nf_per_km, CAB.max_i_ka
    )
    pp.runpp(net)
    return net


def _hand_pi() -> tuple[complex, complex]:
    """(V_r/V_s, S_in [MVA]) of the lumped π-model, far end open."""
    z = complex(CAB.r_ohm_per_km, CAB.x_ohm_per_km) * L_KM
    y_half = 1j * OMEGA * CAB.c_nf_per_km * 1e-9 * L_KM / 2
    v_s = U_KV * 1e3 / math.sqrt(3)  # phase voltage [V]
    v_r = v_s / (1 + z * y_half)
    i_s = v_s * y_half + v_r * y_half  # shunt at the sending end + series branch
    return v_r / v_s, 3 * v_s * i_s.conjugate() / 1e6


def test_pandapower_cable_equals_the_hand_pi_model() -> None:
    net = _open_ended_cable()
    ratio, s_in = _hand_pi()
    assert net.res_bus.vm_pu.iat[1] == pytest.approx(abs(ratio), rel=1e-6)
    # Rule 4/7: the cable generates Q, so the grid absorbs it (negative injection)
    assert net.res_ext_grid.q_mvar.iat[0] == pytest.approx(s_in.imag, rel=1e-6)
    assert net.res_ext_grid.p_mw.iat[0] == pytest.approx(s_in.real, rel=1e-6)
    assert s_in.imag < 0


def test_charging_power_is_omega_c_v2_l() -> None:
    """Q = ωCL·(V_s² + V_r²)/2 − 3·I²X: the open far end sits 4.4 % high (Ferranti), so the
    cable makes ≈ 2 % more than the nominal-voltage ωCV²L (312 Mvar) used for sizing."""
    net = _open_ended_cable()
    q_nominal = export_charging_mvar(L_KM)
    assert q_nominal == pytest.approx(
        2 * math.pi * 50 * 190e-9 * (220e3) ** 2 * 108 / 1e6, rel=1e-9
    )
    assert 305 < q_nominal < 320
    v_r = net.res_bus.vm_pu.iat[1]
    i_series_a = v_r * U_KV * 1e3 / math.sqrt(3) * OMEGA * CAB.c_nf_per_km * 1e-9 * L_KM / 2
    q_loss = 3 * i_series_a**2 * CAB.x_ohm_per_km * L_KM / 1e6
    q_hand = q_nominal * (1 + v_r**2) / 2 - q_loss
    assert -net.res_ext_grid.q_mvar.iat[0] == pytest.approx(q_hand, rel=1e-3)
    assert 1.0 < -net.res_ext_grid.q_mvar.iat[0] / q_nominal < 1.03


def test_ferranti_rise_matches_the_distributed_line() -> None:
    """Exact long-line V_r/V_s = 1/cosh(γl), γ = √(zy); the π-model and our lossless
    ``ferranti_rise_pu`` (1/cos βl − 1 ≈ 4.4 %) must agree with it."""
    z = complex(CAB.r_ohm_per_km, CAB.x_ohm_per_km)
    y = 1j * OMEGA * CAB.c_nf_per_km * 1e-9
    exact_rise = 1 / abs(cmath.cosh(cmath.sqrt(z * y) * L_KM)) - 1
    pi_rise = abs(_hand_pi()[0]) - 1
    assert 0.040 < exact_rise < 0.046
    assert pi_rise == pytest.approx(exact_rise, rel=0.01)  # 0.01 × 4.4 % ≈ 0.04 % of V
    assert ferranti_rise_pu(L_KM) == pytest.approx(exact_rise, rel=0.01)


# ── IEC 60909 hand calculation ─────────────────────────────────────

S_KQ_MAX, S_KQ_MIN, RX_Q = 10_000.0, 8_000.0, 0.1  # network feeder at 400 kV [MVA], R/X
SR_T, UK, UR = 300.0, 0.12, 0.003  # 400/220 kV transformer [MVA], u_k, u_R [-]


def _feeder_and_trafo() -> pp.pandapowerNet:
    net = pp.create_empty_network(f_hz=50.0)
    hv, lv = pp.create_bus(net, 400.0), pp.create_bus(net, U_KV)
    pp.create_ext_grid(
        net, hv, s_sc_max_mva=S_KQ_MAX, rx_max=RX_Q, s_sc_min_mva=S_KQ_MIN, rx_min=RX_Q
    )
    pp.create_transformer_from_parameters(
        net, hv, lv, SR_T, 400.0, U_KV, UR * 100, UK * 100, 0.0, 0.0
    )
    return net


def _hand_iec60909(c: float, s_kq: float) -> tuple[float, float]:
    """(I"_k, i_p) [kA] at the 220 kV side, all impedances referred to 220 kV [Ω]."""
    z_q_abs = c * U_KV**2 / s_kq  # = c·U_nQ²/S"_kQ / t_r² (t_r = U_nQ/U_KV)
    x_q = z_q_abs / math.sqrt(1 + RX_Q**2)
    z_q = complex(RX_Q * x_q, x_q)
    x_t = math.sqrt(UK**2 - UR**2)
    # K_T with c_max, maximum currents only (IEC 60909-0:2016 §6.3.3; K_T = 1 for minimum)
    k_t = 0.95 * 1.10 / (1 + 0.6 * x_t) if c == 1.10 else 1.0
    z_t = complex(UR, x_t) * U_KV**2 / SR_T * k_t
    z_k = z_q + z_t
    ikss = c * U_KV / (math.sqrt(3) * abs(z_k))
    kappa = 1.02 + 0.98 * math.exp(-3 * z_k.real / z_k.imag)
    return ikss, kappa * math.sqrt(2) * ikss


@pytest.mark.parametrize(("case", "c", "s_kq"), [("max", 1.10, S_KQ_MAX), ("min", 1.00, S_KQ_MIN)])
def test_calc_sc_equals_the_iec_60909_hand_calculation(case: str, c: float, s_kq: float) -> None:
    net = _feeder_and_trafo()
    sc.calc_sc(net, fault="3ph", case=case, ip=True, branch_results=False)
    ikss, ip = _hand_iec60909(c, s_kq)
    assert net.res_bus_sc.ikss_ka.iat[1] == pytest.approx(ikss, rel=1e-4)
    assert net.res_bus_sc.ip_ka.iat[1] == pytest.approx(ip, rel=1e-3)
    if case == "max":  # ≈ 6.0 kA: the 300 MVA transformer dominates the 10 GVA grid
        assert 5.5 < ikss < 6.5
