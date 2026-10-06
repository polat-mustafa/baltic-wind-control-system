"""Load flow of the live part of circuit 1 (services/p5/energisation.py).

Hand checks: Q_c = ω·C·U²·l = 2π·50·190e-9·45·220e3² = 130.0 Mvar;
I_c = Q_c/(√3·U) = 341 A at 1 pu; Ferranti 1/cos(βl) = 1.0071.
"""

import math

import pytest

from app.services.p2.network_model import TRAFO_66_220_I0_PERCENT, TRAFO_66_220_MVA
from app.services.p5.energisation import cable_charging_mvar, ferranti_ratio, network_snapshot
from app.services.p5.equipment_state import EquipmentState, build_initial_state

SHUT, OPENED = EquipmentState.CLOSED, EquipmentState.OPEN


def state_after(*stages: str) -> dict[str, EquipmentState]:
    s = build_initial_state()
    steps = {
        "cable": {
            "ES-ON-220-01": OPENED,
            "ES-OSS-220-01": OPENED,
            "DS-ON-220-01": SHUT,
            "CB-ON-220-01": SHUT,
        },
        "oss": {"ES-OSS-220-BB": OPENED, "DS-OSS-220-01": SHUT, "CB-OSS-220-01": SHUT},
        "reactor": {"CB-SR-01": SHUT},
        "statcom": {"CB-STC-01": SHUT},
        "tx1": {"CB-TX-OSS-HV": SHUT, "ES-OSS-66-01": OPENED, "CB-TX-OSS-LV": SHUT},
        "strings": {
            k: v for n in (1, 2, 3) for k, v in ((f"ES-STR-0{n}", OPENED), (f"CB-STR-0{n}", SHUT))
        },
        "wtg": {f"WTG-GRP-0{n}": SHUT for n in (1, 2, 3)},
    }
    for stage in stages:
        s.update(steps[stage])
    return s


def test_analytic_cross_checks():
    assert cable_charging_mvar() == pytest.approx(130.0, abs=0.1)
    assert ferranti_ratio() == pytest.approx(1.0071, abs=1e-4)


def test_dead_network_is_flat():
    snap = network_snapshot(build_initial_state())
    assert snap.bus("ONS220").vm_pu == pytest.approx(1.0, abs=1e-3)
    assert snap.cable_i_send_a is None


def test_open_ended_cable():
    snap = network_snapshot(state_after("cable"))
    send, far = snap.bus("ONS220"), snap.bus("CABLE1")
    assert far.vm_pu / send.vm_pu == pytest.approx(ferranti_ratio(), abs=5e-4)
    # charging current = Q_c(U) / (√3 U) at the actual sending voltage
    i_expected = cable_charging_mvar(send.kv) / (math.sqrt(3) * send.kv) * 1e3
    assert snap.cable_i_send_a == pytest.approx(i_expected, rel=0.02)
    assert snap.cable_i_recv_a == pytest.approx(0.0, abs=1e-3)
    assert snap.poc_q_mvar > 120  # the cable's Mvar flow into PSE
    assert 1.0 < send.vm_pu < 1.05  # onshore voltage step stays inside the band


def test_reactor_and_statcom_bring_the_busbar_to_1pu():
    after_reactor = network_snapshot(state_after("cable", "oss", "reactor"))
    assert after_reactor.reactor_q_mvar == pytest.approx(-80.0, rel=0.03)  # absorbing (Rule 4)
    assert after_reactor.poc_q_mvar < network_snapshot(state_after("cable", "oss")).poc_q_mvar
    regulated = network_snapshot(state_after("cable", "oss", "reactor", "statcom"))
    assert regulated.bus("OSS220").vm_pu == pytest.approx(1.0, abs=1e-3)
    assert abs(regulated.statcom_q_mvar) < 120


def test_transformer_no_load_current():
    snap = network_snapshot(state_after("cable", "oss", "reactor", "statcom", "tx1"))
    i0 = TRAFO_66_220_I0_PERCENT / 100 * TRAFO_66_220_MVA / (math.sqrt(3) * 220.0) * 1e3
    assert snap.tx1_i_hv_a == pytest.approx(i0, rel=0.05)  # ≈ 0.39 A
    assert snap.bus("66A").vm_pu == pytest.approx(1.0, abs=0.01)


def test_rated_output_of_section_a():
    snap = network_snapshot(
        state_after(*("cable", "oss", "reactor", "statcom", "tx1", "strings", "wtg"))
    )
    assert snap.generation_mw == 270.0
    losses = snap.generation_mw - snap.poc_p_mw
    assert 1.0 < losses < 10.0  # array + TX + export cable + onshore TX
    assert 70 < snap.cable_loading_pct < 100
    assert 80 < snap.tx1_loading_pct < 100
    for n in (1, 2, 3):
        assert 0.95 <= snap.bus(f"STR{n}").vm_pu <= 1.05
