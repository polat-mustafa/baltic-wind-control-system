"""
Turbine physics vs the IEA 15 MW reference: the ROSCO time-domain simulator, held at a
constant wind for 300 s, against the official WISDEM steady-state table (rotor speed,
pitch, power, thrust) — evidence kind "reference" for the Evidence page.

Thrust of the simulator: T = ½ρ·πR²·v²·Ct(λ, β), Ct from the ROSCO surface at the
settled tip-speed ratio and pitch (ρ = 1.225 kg/m³, as the table).

Known differences, all at or near rated:
- region 2 power ≤ 1.7 % high: the ROSCO surface (Cp 0.469) is a CCBlade run, the table
  (Cp 0.462) a WISDEM one;
- above rated the pitch loop holds 7.56 rpm (ROSCO PC_RefSpd) where the table lists its
  7.52 rpm tip-speed limit (0.56 %);
- at the rated knee (10.66 m/s) the table has pitch 0° and the controller already
  pitches 1.3° to hold 7.56 rpm, so thrust there is 5.7 % below the table.
"""

from __future__ import annotations

import math

import numpy as np

from app.services.p1.turbine_models import get_turbine, rosco
from app.services.turbine_physics.simulator import run_simulation

SPEEDS = (6.0, 8.0, 10.66, 12.0, 15.0, 20.0)
RHO = 1.225


def _steady() -> list[dict[str, float]]:
    t = get_turbine()
    surface, _ = rosco()
    out = []
    for v in SPEEDS:
        r = run_simulation([v] * 3000)  # 300 s at dt = 0.1 s
        _, ct = surface.coefficients(float(r.tip_speed_ratio[-1]), float(r.pitch_angle_deg[-1]))
        ref = t.operating_point(v)
        out.append(
            {
                "v": v,
                "p": float(r.electrical_power_mw[-1]),
                "p_ref": float(t.power_curve_kw(v)) / 1e3,
                "rpm": float(r.rotor_speed_rpm[-1]),
                "rpm_ref": ref["rotor_rpm"],
                "pitch": float(r.pitch_angle_deg[-1]),
                "pitch_ref": ref["pitch_deg"],
                "thrust": 0.5 * RHO * math.pi * t.rotor_radius_m**2 * v**2 * ct / 1e3,
                "thrust_ref": ref["thrust_kn"],
            }
        )
    return out


def test_simulator_matches_the_iea15_reference_table(evidence) -> None:
    rows = _steady()
    rel = lambda a, b: 100.0 * abs(a - b) / b  # noqa: E731
    power = max(rel(r["p"], r["p_ref"]) for r in rows)
    rpm = max(rel(r["rpm"], r["rpm_ref"]) for r in rows)
    pitch = max(abs(r["pitch"] - r["pitch_ref"]) for r in rows)
    thrust = max(rel(r["thrust"], r["thrust_ref"]) for r in rows)
    # away from the rated knee the pitch and thrust agree closely
    off_knee = [r for r in rows if r["v"] != 10.66]
    assert max(abs(r["pitch"] - r["pitch_ref"]) for r in off_knee) < 0.2
    assert max(rel(r["thrust"], r["thrust_ref"]) for r in off_knee) < 2.5
    # Rule 1 and the limits below
    assert all(0.0 <= r["p"] <= 15.0 for r in rows)
    assert power < 2.0 and rpm < 1.0 and pitch < 1.5 and thrust < 7.0
    assert np.isclose(rows[-1]["p"], 15.0, atol=0.01)

    common = {
        "area": "Turbine physics (ROSCO)",
        "kind": "reference",
        "claim": "ROSCO time-domain simulator, steady state at 6, 8, 10.66, 12, 15, 20 m/s",
        "against": "IEA 15 MW RWT official steady-state table (WISDEM, IEA Wind Task 37)",
    }
    evidence(
        "tp-steady-power",
        **common,
        metric="max power difference",
        value=power,
        unit="%",
        limit="< 2 % (CCBlade vs WISDEM Cp in region 2)",
    )
    evidence(
        "tp-steady-rpm",
        **common,
        metric="max rotor-speed difference",
        value=rpm,
        unit="%",
        limit="< 1 % (7.56 rpm reference vs 7.52 rpm table limit)",
    )
    evidence(
        "tp-steady-pitch",
        **common,
        metric="max pitch difference (rated knee; < 0.2° elsewhere)",
        value=pitch,
        unit="°",
        limit="< 1.5°",
    )
    evidence(
        "tp-steady-thrust",
        **common,
        metric="max thrust difference (rated knee; < 2.5 % elsewhere)",
        value=thrust,
        unit="%",
        limit="< 7 %",
    )
