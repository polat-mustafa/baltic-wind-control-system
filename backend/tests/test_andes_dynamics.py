"""ANDES RMS model of the farm: WECC REGCA1/REECA1/REPCA1 against PSE requirements.

Skipped on Windows: Smart App Control blocks ANDES' compiled dependencies
(kvxopt, numba) and the process gets killed. CI and Docker run it on Linux.
"""

from __future__ import annotations

import sys

import pytest

if sys.platform == "win32":
    pytest.skip("ANDES runs on Linux only (CI / Docker)", allow_module_level=True)
pytest.importorskip("andes")

from fastapi.testclient import TestClient

from app.main import app
from app.services.p2.andes_dynamics import (
    build_system,
    collector_equivalent_pu,
    run_event,
)


@pytest.fixture(scope="module")
def freq() -> dict:
    return run_event("frequency", 3000.0)


@pytest.fixture(scope="module")
def fault() -> dict:
    return run_event("fault", retained_voltage_pu=0.05)


def test_converter_models_are_attached():
    """Regression: the old builder swallowed add() errors and ran with no converter."""
    ss = build_system()
    ss.setup()
    assert (ss.REGCA1.n, ss.REECA1.n, ss.REPCA1.n, ss.GENCLS.n, ss.TGOV1.n) == (1, 1, 1, 1, 1)
    ss.PFlow.run()
    assert ss.PFlow.converged


def test_collector_equivalent_is_small_and_inductive():
    """Muljadi equivalent of the 66 kV array: well under the transformer impedances."""
    z, b = collector_equivalent_pu()
    assert 0 < z.real < z.imag < 0.01
    assert b > 0


def test_lfsm_o_settles_on_the_5_percent_droop(freq, evidence):
    """REPCA1 droop: ΔP = −Pmax/0.05·(f − 50.2)/50, within 2 MW in steady state."""
    assert freq["f_max_hz"] > 50.2
    assert freq["dp_final_mw"] < 0
    assert freq["dp_final_mw"] == pytest.approx(freq["dp_expected_final_mw"], abs=2.0)
    evidence(
        "andes-lfsm-o",
        area="P2 — grid dynamics (ANDES)",
        claim="LFSM-O after losing 3 GW of load: REPCA1 plant controller in ANDES",
        against="PSE / NC RfG droop by hand: ΔP = −P_max/0.05 · (f − 50.2)/50",
        metric="steady-state ΔP minus hand formula",
        value=freq["dp_final_mw"] - freq["dp_expected_final_mw"],
        unit="MW",
        limit="± 2 MW",
        tolerance=0.5,
    )


def test_lfsm_o_starts_within_2_s(freq, evidence):
    """NC RfG: an initial delay above 2 s has to be justified to the TSO."""
    assert freq["response_delay_s"] is not None
    assert freq["response_delay_s"] < 2.0
    evidence(
        "andes-lfsm-o-delay",
        area="P2 — grid dynamics (ANDES)",
        claim="LFSM-O response starts quickly after 50.2 Hz is crossed",
        against="NC RfG Art. 13(2) LFSM-O: an initial delay above 2 s must be justified",
        metric="50.2 Hz crossing → 1 % output reduction",
        value=freq["response_delay_s"],
        unit="s",
        limit="< 2 s",
        tolerance=0.05,
    )


def test_fault_reactive_current_injection(fault, evidence):
    """Q priority in the dip: Iq reaches the 1.1 p.u. current limit at 0.05 p.u."""
    assert fault["retained_voltage_pu"] == pytest.approx(0.05, abs=0.01)
    assert fault["iq_max_pu"] > 1.0
    assert fault["stayed_connected"]
    evidence(
        "andes-frt-iq",
        area="P2 — grid dynamics (ANDES)",
        claim="Fault ride-through at 0.05 pu retained voltage: reactive current priority",
        against="PSE fast fault current (NC RfG Art. 20(2)(b)), converter limit 1.1 pu",
        metric="peak reactive current during the dip",
        value=fault["iq_max_pu"],
        unit="pu",
        limit="> 1.0 pu, stays connected",
        tolerance=0.02,
    )


def test_fault_active_power_recovers_within_pse_limit(fault, evidence):
    assert fault["p_recovery_s"] is not None
    assert fault["p_recovery_s"] < fault["recovery_limit_s"]
    evidence(
        "andes-frt-recovery",
        area="P2 — grid dynamics (ANDES)",
        claim="Active power recovery after the fault is cleared",
        against="post-fault recovery to 90 % of pre-fault power (PSE, frt_simulation.py)",
        metric="clearance → 90 % of pre-fault power",
        value=fault["p_recovery_s"],
        unit="s",
        limit=f"< {fault['recovery_limit_s']} s",
        tolerance=0.02,
    )


def test_api_fault():
    r = TestClient(app).post(
        "/api/v1/grid/dynamics/andes", json={"event": "fault", "retained_voltage_pu": 0.5}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["event"] == "fault" and len(body["series"]) > 500
