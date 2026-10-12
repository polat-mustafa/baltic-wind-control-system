"""C-2: the SB-510 load flow re-solved in OpenDSS (scripts/audit/c2_opendss_load_flow.py).

Same dispatched network, independent solver (EPRI OpenDSS via opendssdirect.py). Skipped
where OpenDSS is not installed; the Evidence row is written where it is.
"""

import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("opendssdirect")

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit" / "c2_opendss_load_flow.py"


def _audit():
    spec = importlib.util.spec_from_file_location("c2_opendss_load_flow", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.validation
def test_pandapower_and_opendss_agree_at_full_load(evidence):
    r = _audit().compare(1.0)
    assert r["buses"] == 72
    assert r["max_dv_pu"] < 1e-3
    assert r["p_grid_dss"] == pytest.approx(r["p_grid_pp"], abs=0.1)
    assert r["q_grid_dss"] == pytest.approx(r["q_grid_pp"], abs=0.5)
    evidence(
        "p2-loadflow-opendss",
        area="P2 — HV grid",
        kind="reference",
        claim="SB-510 load flow at 510 MW (72 buses, dispatched reactors, STATCOM, taps)",
        against="the same network solved in EPRI OpenDSS (opendssdirect.py)",
        metric="largest bus-voltage difference",
        value=r["max_dv_pu"],
        unit="pu",
        limit="< 0.001 pu; grid P within 0.1 MW, Q within 0.5 Mvar",
        tolerance=5e-4,
    )
