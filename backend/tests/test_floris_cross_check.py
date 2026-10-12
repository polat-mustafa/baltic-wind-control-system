"""C-2: the app's wake models against NREL FLORIS on the SB-510 layout
(scripts/audit/c2_floris_wakes.py). Skipped where FLORIS is not installed (it is not a
project dependency); the Evidence row is written where it is."""

import importlib.util
from pathlib import Path

import pytest

pytest.importorskip("floris")

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "audit" / "c2_floris_wakes.py"


def _audit():
    spec = importlib.util.spec_from_file_location("c2_floris_wakes", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.validation
def test_wake_losses_agree_with_floris(evidence):
    r = _audit().compare()
    jensen, tp, gauss = r["jensen"], r["turboparkgauss"], r["gauss"]
    # same published model (Jensen): rotor averaging is the only difference
    assert abs(jensen[0] - jensen[1]) < 0.5
    # TurbOPark: exact Gaussian overlap (app) vs 3 × 3 rotor points (FLORIS)
    assert abs(tp[0] - tp[1]) < 1.0
    # related Gaussian models: model-form spread
    assert abs(gauss[0] - gauss[1]) < 1.0
    evidence(
        "p1-wake-floris",
        area="P1 — wind resource",
        kind="reference",
        claim="SB-510 farm wake loss (34 × IEA 15 MW, TI 6 %, site Weibull): Jensen, "
        "TurbOPark and Gaussian models",
        against="NREL FLORIS 4.2.1 (jensen, turboparkgauss, gauss) on the same layout and "
        "power/thrust table",
        metric="largest wake-loss difference of the three pairs",
        value=max(abs(a - b) for a, b in (jensen, tp, gauss)),
        unit="pp",
        limit="< 1 pp (Jensen < 0.5 pp)",
        tolerance=0.1,
    )
