"""
Wake-model cross-check shared with the frontend.

`tests/fixtures/wake_centreline_reference.json` holds the centre-line
deficit of one V236 (Ct = 0.8, k* = 0.035) computed with PyWake's
BastankhahGaussianDeficit. This test keeps that reference honest (PyWake
must still reproduce it); the frontend test
`tests/components/landing/turbine3d/wakeModel.test.ts` checks the 3D view's
closed-form Bastankhah model against the same numbers, so the two stacks
cannot drift apart silently.
"""

import json
from pathlib import Path

import numpy as np
import pytest

try:
    import py_wake  # noqa: F401

    HAS_PYWAKE = True
except ImportError:  # pragma: no cover - optional heavy dependency
    HAS_PYWAKE = False

REF = json.loads(
    (Path(__file__).parent / "fixtures" / "wake_centreline_reference.json").read_text()
)
D, H, U = 236.0, 150.0, 10.0


@pytest.mark.skipif(not HAS_PYWAKE, reason="PyWake not installed")
def test_pywake_reproduces_centreline_reference() -> None:
    from py_wake import HorizontalGrid
    from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
    from py_wake.site import UniformSite
    from py_wake.superposition_models import SquaredSum
    from py_wake.wind_farm_models import PropagateDownwind
    from py_wake.wind_turbines import WindTurbine
    from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

    ct = REF["ct"]
    ws = np.array([0.0, 3.0, 25.0, 40.0])
    wt = WindTurbine("V236-ct", D, H, PowerCtTabular(ws, [0, 1, 1, 0], "kW", [ct] * 4))
    wfm = PropagateDownwind(
        UniformSite(ti=0.06),
        wt,
        wake_deficitModel=BastankhahGaussianDeficit(k=REF["k_star"]),
        superpositionModel=SquaredSum(),
    )
    sim = wfm([0], [0], wd=[270], ws=[U])
    grid = HorizontalGrid(x=[x * D for x in REF["x_over_d"]], y=[0.0], h=H)
    ws_eff = sim.flow_map(grid, wd=270, ws=U).WS_eff.values.squeeze()
    np.testing.assert_allclose(1 - ws_eff / U, REF["deficit"], atol=2e-4)


def test_reference_decays_monotonically_like_a_far_wake() -> None:
    d = np.array(REF["deficit"])
    assert np.all(np.diff(d) < 0)
    # far wake: roughly ∝ (x/D)^-1.5 … ^-1 between 6 and 15 D
    x = np.array(REF["x_over_d"])
    slope = np.polyfit(np.log(x[3:]), np.log(d[3:]), 1)[0]
    assert -1.6 < slope < -0.9
