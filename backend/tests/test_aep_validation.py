"""A1: the P1 AEP chain against Rødsand II's metered output (ENTSO-E 16.1.A): 2025 and 28 months."""

import importlib.util

import pytest

from app.services.p1.aep_validation import CAPACITY_MW, validate_aep_chain, validate_months

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


@needs_pywake
def test_aep_chain_holds_month_by_month_over_28_months(evidence) -> None:
    """June 2024 … September 2026: every month, constrained days (capped / off) left out."""
    mv = validate_months()
    assert len(mv.months) >= 27 and mv.months[0][0] == "2024-06"
    # the capped / dark spell of Rødsand II in Nov–Dec 2024 is found, and it is short
    assert "2024-11-30" in mv.constrained_days and len(mv.constrained_days) < 60
    assert mv.monthly_r2_all < mv.monthly_r2 > 0.9
    assert max(abs(b) for b in mv.bias_by_year.values()) < 8.0
    assert abs(mv.bias_pct) < BIAS_LIMIT_PCT

    common = {
        "area": "P1 — wind resource",
        "kind": "measured",
        "claim": (
            "AEP chain month by month, Rødsand II June 2024 – September 2026 "
            f"({len(mv.constrained_days)} days with the farm capped or off left out)"
        ),
        "against": "metered output of Rødsand II (90 × SWT-2.3-93, 207 MW), ENTSO-E 16.1.A",
    }
    evidence(
        "p1-aep-roedsand2-28m-r2",
        **common,
        metric=f"R² of the {len(mv.months)} monthly energies (all hours: {mv.monthly_r2_all:.2f})",
        value=mv.monthly_r2,
        limit="> 0.9",
    )
    evidence(
        "p1-aep-roedsand2-28m-year-bias",
        **common,
        metric="largest yearly bias, model vs metered ("
        + ", ".join(f"{y} {b:+.1f} %" for y, b in mv.bias_by_year.items())
        + ")",
        value=max(mv.bias_by_year.values(), key=abs),
        unit="%",
        limit="|bias| < 8 % per year",
        tolerance=0.5,
    )
