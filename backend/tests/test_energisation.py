"""Load flow of the live part of circuit 1 (services/p5/energisation.py).

Hand checks: Q_c = ω·C·U²·l = 2π·50·190e-9·45·220e3² = 130.0 Mvar;
I_c = Q_c/(√3·U) = 341 A at 1 pu; Ferranti 1/cos(βl) = 1.0071.
"""

import math

import pytest

from app.services.p2.network_model import (
    OLTC_STEP_PERCENT,
    SB510,
    TRAFO_66_220_I0_PERCENT,
    TRAFO_66_220_MVA,
)
from app.services.p5.energisation import (
    cable_charging_mvar,
    circuit1_limit_mw,
    ferranti_ratio,
    network_snapshot,
    onshore_tap,
    section_a_mw,
)
from app.services.p5.equipment_state import EquipmentState, build_initial_state

SHUT, OPENED = EquipmentState.CLOSED, EquipmentState.OPEN


def state_after(*stages: str) -> dict[str, EquipmentState]:
    s = build_initial_state()
    steps = {
        "cable": {
            "ES-SR-ON-01": OPENED,
            "CB-SR-ON-01": SHUT,  # onshore line reactor, energised with the cable
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
    assert cable_charging_mvar() == pytest.approx(221.0, abs=0.1)  # 76.5 km
    # βl = ωl·√(LC) = 314.16 · 76.5 · √(0.38 mH · 190 nF) = 0.204 rad → 1 / cos(βl)
    assert ferranti_ratio() == pytest.approx(1.0212, abs=1e-4)


def test_dead_network_is_flat():
    """With the onshore line reactor no OLTC pre-set is needed: the busbar sits at 1.0."""
    snap = network_snapshot(build_initial_state())
    assert onshore_tap() == 0
    tap = 1 + onshore_tap() * OLTC_STEP_PERCENT / 100
    assert snap.bus("ONS220").vm_pu == pytest.approx(1 / tap, abs=1e-3)
    assert snap.cable_i_send_a is None


def test_cable_energised_with_its_onshore_line_reactor():
    snap = network_snapshot(state_after("cable"))
    send, far = snap.bus("ONS220"), snap.bus("CABLE1")
    assert far.vm_pu / send.vm_pu == pytest.approx(ferranti_ratio(), abs=5e-4)
    # the cable still carries its full charging current = Q_c(U) / (√3 U) at the sending end
    i_expected = cable_charging_mvar(send.kv) / (math.sqrt(3) * send.kv) * 1e3
    assert snap.cable_i_send_a == pytest.approx(i_expected, rel=0.02)
    assert snap.cable_i_recv_a == pytest.approx(0.0, abs=1e-3)
    # the line reactor takes 120 Mvar · U² of it at the onshore end (Rule 4: absorbing < 0)
    assert snap.reactor_on_q_mvar == pytest.approx(-120.0 * send.vm_pu**2, rel=0.01)
    assert 80 < snap.poc_q_mvar < 120  # ≈ 221 · U² − 126 Mvar into PSE
    assert 1.0 < send.vm_pu < 1.05 and far.vm_pu < 1.05  # inside the band at tap 0


def test_without_the_line_reactor_the_busbar_leaves_the_band():
    """Why the onshore reactor is energised with the cable: open-ended at tap 0 the
    221 Mvar push the onshore busbar above 1.05 pu."""
    state = state_after("cable")
    state.update({"ES-SR-ON-01": SHUT, "CB-SR-ON-01": OPENED})
    assert network_snapshot(state).bus("ONS220").vm_pu > 1.05


def test_reactor_and_statcom_bring_the_busbar_to_1pu():
    after_reactor = network_snapshot(state_after("cable", "oss", "reactor"))
    v = after_reactor.bus("OSS220").vm_pu  # absorbing (Rule 4), Q ∝ U²
    assert after_reactor.reactor_q_mvar == pytest.approx(-SB510.reactor_unit_mvar * v**2, rel=0.01)
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
    # Section A is 270 MW, but one circuit carries √3·220 kV·√(825² − (Ic/2)²) ≈ 294 MW at
    # 76.5 km: the PPC holds circuit 1 at 90 % of that until circuit 2 is in service
    assert section_a_mw(SB510) == 270.0
    assert (
        snap.generation_mw
        == pytest.approx(circuit1_limit_mw(SB510))
        == pytest.approx(264.9, abs=0.1)
    )
    losses = snap.generation_mw - snap.poc_p_mw
    assert 1.0 < losses < 10.0  # array + TX + export cable + onshore TX
    assert 70 < snap.cable_loading_pct < 100
    assert 80 < snap.tx1_loading_pct < 100
    for n in (1, 2, 3):
        assert 0.95 <= snap.bus(f"STR{n}").vm_pu <= 1.05
