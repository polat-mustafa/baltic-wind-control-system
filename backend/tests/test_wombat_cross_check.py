"""Audit 2.6: the app's fleet O&M replay against NREL WOMBAT 0.13.4 on the same failures,
vessels and 30-year weather (scripts/audit/c2_wombat_om.py). Skipped where WOMBAT is not
installed (it is not a project dependency); the Evidence row is written where it is."""

import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("wombat")

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit" / "c2_wombat_om.py"


def _audit():
    spec = importlib.util.spec_from_file_location("c2_wombat_om", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.validation
def test_availability_agrees_with_wombat(evidence):
    """WOMBAT is higher: it has no per-class response delay and pauses a turbine's failure
    clocks while it is down (≈ 10 % fewer failures) — both make it more optimistic."""
    r = _audit().compare()
    app, wombat = r["app"], r["wombat"]
    diff = wombat[1] - app[1]
    assert 0.0 <= diff < 3.0
    assert 0.0 <= wombat[0] - app[0] < 3.0
    evidence(
        "lc-om-wombat",
        area="Lifecycle — O&M",
        kind="reference",
        claim="Fleet O&M replay: energy-based availability of SB-510 over the 30-year hindcast "
        "(2 CTVs × 3 crews, jack-up)",
        against="NREL WOMBAT 0.13.4 with the same failure rates, vessels, limits and weather",
        metric="WOMBAT − app, energy-based availability",
        value=diff,
        unit="pp",
        limit="0 … 3 pp (WOMBAT has no response delay)",
        tolerance=0.3,
    )
