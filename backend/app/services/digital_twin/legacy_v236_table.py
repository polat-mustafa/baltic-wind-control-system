"""
Legacy V236-15.0 MW power table — an approximation, not a manufacturer curve.

This is the hand-built table P1 used before the IEA Wind Task 37 reference
turbines replaced it (Phase 3 of the own-project programme). Below rated it
follows P ≈ 15 000 · (v / 11.1)³ kW; Vestas publishes no V236 power curve.
The digital twin (and P4) still model the V236 with 3 / 11.1 / 31 m/s until
the final phase moves them to the IEA 15 MW turbine, so the twin's physics
reference curve keeps validating against this table.

Units: wind speed m/s, power kW.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

LABEL = "Legacy V236 approximation (former P1 table)"

_SPEEDS_MS = np.array(
    [0.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 10.5, 11.0, 11.1, 11.5, 12.0,
     12.5, 13.0, 14.0, 15.0, 16.0, 18.0, 20.0, 22.0, 24.0, 26.0, 28.0, 30.0, 31.0, 32.0],
    dtype=np.float64,
)  # fmt: skip
_POWER_KW = np.array(
    [0.0, 0.0, 200.0, 700.0, 1400.0, 2400.0, 3700.0, 5600.0, 7900.0, 10900.0, 12600.0,
     14500.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0,
     15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 15000.0, 0.0, 0.0],
    dtype=np.float64,
)  # fmt: skip

RATED_KW = 15_000.0
CUT_IN_MS = 3.0
CUT_OUT_MS = 31.0


def legacy_v236_power_kw(wind_speeds_ms: NDArray[np.floating]) -> NDArray[np.float64]:
    """Legacy V236 table power [kW]; Rule 1 enforced (0 ≤ P ≤ 15 MW, 0 outside 3–31 m/s)."""
    v = np.asarray(wind_speeds_ms, dtype=np.float64)
    p = np.clip(np.interp(v, _SPEEDS_MS, _POWER_KW), 0.0, RATED_KW)
    return np.asarray(np.where((v < CUT_IN_MS) | (v > CUT_OUT_MS), 0.0, p), dtype=np.float64)
