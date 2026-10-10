"""
Wake models vs measured Horns Rev 1 / Lillgrund row power ratios (evidence programme B1).

Locks the scores of ``app.services.p1.wake_validation`` so a model change that makes the
fit to measured data worse fails CI, and checks that our TurbOPark set-up reproduces
Ørsted's own MATLAB reference (verification before validation).
"""

import numpy as np
import pytest

from app.services.p1.wake_validation import (
    CASES,
    MODELS,
    direction_average,
    measured_ratios,
    validate_wake_models,
)

try:
    import py_wake  # noqa: F401

    HAS_PYWAKE = True
except ImportError:  # pragma: no cover - optional heavy dependency
    HAS_PYWAKE = False

needs_pywake = pytest.mark.skipif(not HAS_PYWAKE, reason="PyWake not installed")

#: Mean RMSE of P_i/P_1 [-] over the 9 measured rows, direction-averaged (2026-10-10:
#: NOJ 0.116, BPA 0.083, TurbOPark 0.097) — may only get better.
RMSE_LOCK = {"NOJ": 0.12, "BPA": 0.09, "TurbOPark": 0.10}


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c.farm}-{c.row}-{c.wd_deg:.0f}")
def test_measured_rows_match_their_turbine_lists(case) -> None:
    meas = measured_ratios(case)
    assert len(meas) == len(case.wts)
    assert meas[0] == 1.0
    assert (np.isnan(meas) == np.array([i is None for i in case.wts])).all()
    assert np.nanmax(meas[1:]) < 1.0  # every downstream turbine is waked


def test_direction_average_keeps_a_constant_and_the_circular_mean() -> None:
    sigma = np.array([3.3, 5.0])
    assert np.allclose(direction_average(np.full((2, 360), 7.0), sigma), 7.0)
    p = np.random.default_rng(0).random((2, 360))
    assert np.allclose(direction_average(p, sigma).mean(axis=1), p.mean(axis=1))


@needs_pywake
def test_turbopark_model_reproduces_orsted_matlab_reference() -> None:
    """Ørsted's TurbOParkExamples.mlx, example 1 (one row, 6D, as in PyWake's
    ``test_turbopark.py``): our ``turbopark_model`` must give the same powers [kW]."""
    from py_wake.site import UniformSite
    from py_wake.site.shear import PowerShear
    from py_wake.wind_turbines import WindTurbine
    from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

    from app.services.p1.wake_model import turbopark_model

    u = np.arange(0, 25.5, 0.5)
    # fmt: off
    po = [0, 0, 0, 0, 5, 15, 37, 73, 122, 183, 259, 357, 477, 622, 791, 988, 1212, 1469, 1755,
          2009, 2176, 2298, 2388, 2447, 2485] + [2500] * 25 + [0]
    ct = [0, 0, 0, 0, 0.78, 0.77, 0.78, 0.78, 0.77, 0.77, 0.78, 0.78, 0.78, 0.78, 0.78, 0.78,
          0.77, 0.77, 0.77, 0.76, 0.73, 0.7, 0.68, 0.52, 0.42, 0.36, 0.31, 0.27, 0.24, 0.22,
          0.19, 0.18, 0.16, 0.14, 0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.08, 0.08, 0.07, 0.07,
          0.06, 0.06, 0.06, 0.05, 0.05, 0.05, 0.04, 0]
    # fmt: on
    wt = WindTurbine("Orsted1", 120, 100, PowerCtTabular(u, po, "kw", ct))
    model = turbopark_model(UniformSite(shear=PowerShear(h_ref=90, alpha=0.1)), wt)
    res = model(np.arange(4) * 720.0, np.zeros(4), ws=[6, 10, 14], wd=[270], TI=[0.09, 0.1, 0.11])
    ref = [
        [495.429647093727, 2201.84387293603, 2500],
        [165.681333834342, 938.265716039082, 2500],
        [105.264701735512, 607.531414199904, 2485.83000221364],
        [71.8241034924664, 446.254939675813, 2408.31291455241],
    ]
    np.testing.assert_allclose(res.Power.squeeze() / 1000, ref, rtol=1e-5)


@needs_pywake
def test_wake_models_against_measured_rows() -> None:
    scores = validate_wake_models()
    assert len(scores) == len(CASES) * len(MODELS)
    for s in scores:
        pred = np.array(s.predicted_averaged)
        assert np.nanmax(pred[1:]) < 1.0 and np.nanmin(pred) > 0.0, s  # waked, P > 0
    for model, lock in RMSE_LOCK.items():
        mine = [s for s in scores if s.model == model]
        mean = np.mean([s.rmse_averaged for s in mine])
        assert mean <= lock, f"{model}: mean RMSE {mean:.3f} > {lock}"
    # Production model (BPA) fits best once direction scatter is accounted for, and the
    # averaging is what brings the Gaussian models close to the data.
    mean_avg = {m: np.mean([s.rmse_averaged for s in scores if s.model == m]) for m in MODELS}
    assert min(mean_avg, key=mean_avg.__getitem__) == "BPA"
    for m in ("BPA", "TurbOPark"):
        plain = np.mean([s.rmse for s in scores if s.model == m])
        assert mean_avg[m] < plain
