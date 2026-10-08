"""Load flow of the live part of circuit 1 (services/p5/energisation.py).

Hand checks (108 km): Q_c = ω·C·U²·l = 2π·50·190e-9·108·220e3² = 312.0 Mvar;
I_c = Q_c/(√3·U) = 819 A at 1 pu; Ferranti 1/cos(βl) = 1.0431.
"""

import math

import pytest

from app.services.p2.network_model import (
    OLTC_STEP_PERCENT,
    SB510,
    TRAFO_66_220_I0_PERCENT,
    TRAFO_66_220_MVA,
    export_circuit_capacity_mw,
)
from app.services.p5.energisation import (
    cable_charging_mvar,
    circuit1_capability_mw,
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
    assert cable_charging_mvar() == pytest.approx(312.0, abs=0.1)  # 108 km
    # βl = ωl·√(LC) = 314.16 · 108 · √(0.38 mH · 190 nF) = 0.288 rad → 1 / cos(βl)
    assert ferranti_ratio() == pytest.approx(1.0431, abs=1e-4)


def test_dead_network_is_flat():
    """Even with the onshore line reactor the 108 km cable's open end would reach 1.078 pu
    at tap 0, so the onshore OLTC is pre-set 3 steps (3.75 %) down: the busbar sits at 1/tap."""
    snap = network_snapshot(build_initial_state())
    assert onshore_tap() == 3
    tap = 1 + onshore_tap() * OLTC_STEP_PERCENT / 100
    assert snap.bus("ONS220").vm_pu == pytest.approx(1 / tap, abs=1e-3)
    assert snap.cable_i_send_a is None


def test_cable_energised_with_its_onshore_line_reactor():
    snap = network_snapshot(state_after("cable"))
    send, far = snap.bus("ONS220"), snap.bus("CABLE1")
    assert far.vm_pu / send.vm_pu == pytest.approx(ferranti_ratio(), abs=5e-4)
    # the cable still carries its full charging current at the sending end: Q_c(U) / (√3 U),
    # pandapower's π model puts half of C at the far end, at the Ferranti-raised voltage
    i_c = cable_charging_mvar(send.kv) / (math.sqrt(3) * send.kv) * 1e3
    assert snap.cable_i_send_a == pytest.approx(i_c * (1 + far.vm_pu / send.vm_pu) / 2, rel=0.005)
    assert snap.cable_loading_pct == pytest.approx(101.0, abs=0.5)  # minutes, until the OSS is live
    assert snap.cable_i_recv_a == pytest.approx(0.0, abs=1e-3)
    # the line reactor takes 180 Mvar · U² of it at the onshore end (Rule 4: absorbing < 0)
    assert snap.reactor_on_q_mvar == pytest.approx(-180.0 * send.vm_pu**2, rel=0.01)
    assert 115 < snap.poc_q_mvar < 150  # ≈ 312 · U² · 1.02 − 179 Mvar into PSE
    assert 0.99 < send.vm_pu < 1.0 and far.vm_pu < 1.05  # inside the band at tap 3


def test_without_the_line_reactor_the_busbar_leaves_the_band():
    """Why the onshore reactor is energised with the cable: without it the 312 Mvar push
    the onshore busbar up 4 % and the open cable end far above 1.05 pu."""
    state = state_after("cable")
    state.update({"ES-SR-ON-01": SHUT, "CB-SR-ON-01": OPENED})
    snap = network_snapshot(state)
    assert snap.bus("ONS220").vm_pu > 1.03 and snap.bus("CABLE1").vm_pu > 1.07


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
    # Section A is 270 MW. Analytically one circuit carries √3·220 kV·√(825² − (Ic/2)²)
    # ≈ 273 MW at 108 km, but with the onshore OLTC held at its pre-set the onshore busbar
    # sags to 0.97 pu and the STATCOM, holding the OSS at 1.00 pu, sends ≈ 100 Mvar ashore:
    # the load flow reaches 825 A at 233 MW. The PPC holds circuit 1 at 90 % of that.
    assert section_a_mw(SB510) == 270.0
    assert export_circuit_capacity_mw(108.0) == pytest.approx(273.0, abs=0.5)
    assert circuit1_capability_mw(SB510) == pytest.approx(232.8, abs=0.5)
    assert (
        snap.generation_mw
        == pytest.approx(circuit1_limit_mw(SB510))
        == pytest.approx(0.9 * circuit1_capability_mw(SB510))
    )
    losses = snap.generation_mw - snap.poc_p_mw
    assert 1.0 < losses < 10.0  # array + TX + export cable + onshore TX
    assert 90 < snap.cable_loading_pct < 100  # 95 %: the charging current takes a large share
    assert 65 < snap.tx1_loading_pct < 75  # 210 MW on 300 MVA
    for n in (1, 2, 3):
        assert 0.95 <= snap.bus(f"STR{n}").vm_pu <= 1.05
