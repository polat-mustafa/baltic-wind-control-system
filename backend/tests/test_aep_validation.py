"""A1: the P1 AEP chain against Rødsand II's metered 2025 output (ENTSO-E 16.1.A)."""

import importlib.util

import pytest

from app.services.p1.aep_validation import CAPACITY_MW, validate_aep_chain

needs_pywake = pytest.mark.skipif(
    importlib.util.find_spec("py_wake") is None, reason="PyWake not installed"
)

#: 2026-10-11: bias +1.1 %, monthly R² 0.956, hourly nRMSE 16.8 % — limits leave room for
#: data refreshes, not for a broken chain.
BIAS_LIMIT_PCT = 10.0
R2_MIN = 0.9


@needs_pywake
def test_aep_chain_matches_roedsand2_metered_output(evidence) -> None:
    v = validate_aep_chain()
    assert v.hours > 8700  # the whole year bar the dropped hours
    # physics: wakes cost energy, losses cost energy, the farm never beats its rating
    assert v.free_gwh > v.waked_gwh > v.net_gwh > 0
    assert 5 < v.wake_loss_pct < 20  # 90 turbines at ~5 D spacing in a Baltic climate
    assert max(m[1] for m in v.monthly_gwh) < CAPACITY_MW * 744 / 1e3
    assert abs(v.bias_pct) < BIAS_LIMIT_PCT
    assert v.monthly_r2 > R2_MIN

    common = {
        "area": "P1 — wind resource",
        "kind": "measured",
        "claim": (
            "AEP chain (ERA5 → shear → power curve → BPA wakes → loss cascade), Rødsand II 2025"
        ),
        "against": "metered output of Rødsand II (90 × SWT-2.3-93, 207 MW), ENTSO-E 16.1.A",
    }
    evidence(
        "p1-aep-roedsand2-bias",
        **common,
        metric="annual energy, model vs metered",
        value=v.bias_pct,
        unit="%",
        limit=f"|bias| < {BIAS_LIMIT_PCT:.0f} %",
        tolerance=0.3,
    )
    evidence(
        "p1-aep-roedsand2-monthly-r2",
        **common,
        metric="R² of the 12 monthly energies",
        value=v.monthly_r2,
        unit="−",
        limit=f"> {R2_MIN}",
    )
    evidence(
        "p1-aep-roedsand2-hourly-nrmse",
        **common,
        metric="hourly RMSE, % of capacity",
        value=v.hourly_nrmse_pct,
        unit="%",
        limit="reported as-is",
    )
