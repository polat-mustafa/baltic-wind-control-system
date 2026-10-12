"""Tower fore-aft loads: wind field, rainflow/DEL, rotor–tower coupling (audit B-7)."""

import math

import numpy as np
import pytest

from app.services.turbine_physics.loads import (
    L_COHERENCE_M,
    _disc_points,
    damage_equivalent_load,
    free_decay_damping,
    lifetime_del,
    ntm_sigma,
    rainflow,
    rotor_averaging,
    simulate_loads,
    turbulent_wind,
)
from app.services.turbine_physics.support_structure import fore_aft_mode


def test_rainflow_astm_e1049_example():
    # ASTM E1049-85 §5.4.4 example (Fig. 6 / Table 4)
    counts: dict[float, float] = {}
    for r, n in rainflow([-2, 1, -3, 5, -1, 3, -4, 4, -2]):
        counts[r] = counts.get(r, 0.0) + n
    assert counts == {3.0: 0.5, 4.0: 1.5, 6.0: 0.5, 8.0: 1.0, 9.0: 0.5}


def test_del_of_a_pure_sine():
    t = np.arange(0, 600, 0.1)
    x = 5.0 * np.sin(2 * np.pi * 0.25 * t)  # 150 cycles of range 10 in 600 s
    expected = (150 * 10.0**4 / 600) ** 0.25
    assert damage_equivalent_load(x, 600.0) == pytest.approx(expected, rel=0.01)


def test_hub_point_wind_has_the_ntm_sigma():
    sig = [turbulent_wind(10.0, 3600.0, seed=s, rotor_effective=False).std() for s in range(4)]
    assert np.mean(sig) == pytest.approx(ntm_sigma(10.0), rel=0.08)


def test_rotor_averaging_is_a_low_pass():
    chi = rotor_averaging(np.array([1e-6, 0.01, 0.1, 1.0]), 10.0)
    # IEC 61400-1 Annex C coherence at f → 0: exp(−12·0.12·r/L_c), below 1 by design
    p = _disc_points()
    d = np.sqrt(((p[:, None, :] - p[None, :, :]) ** 2).sum(-1))
    assert chi[0] == pytest.approx(np.exp(-12 * 0.12 * d / L_COHERENCE_M).mean(), rel=1e-3)
    assert all(np.diff(chi) < 0)
    assert chi[-1] < 0.05


def test_static_equilibrium_moment_is_thrust_times_arm():
    mode = fore_aft_mode()
    r = simulate_loads(np.full(1500, 9.0), discard_s=60.0)
    assert r.mean_base_moment_nm == pytest.approx(r.thrust_n.mean() * mode.arm_m, rel=1e-3)
    assert r.tower_top_m.mean() == pytest.approx(
        mode.hub_participation * r.thrust_n.mean() / mode.stiffness_n_m, rel=1e-3
    )


def test_aerodynamic_damping_dominates_in_operation():
    # 1 % structural; the thrust slope adds several % in power production
    for v in (8.0, 15.0):
        zeta = free_decay_damping(v)
        assert 0.03 < zeta < 0.15


def test_fore_aft_mode_frequency_and_static_stiffness():
    mode = fore_aft_mode()
    assert mode.frequency_hz == pytest.approx(0.227, abs=0.005)
    assert math.sqrt(mode.stiffness_n_m / mode.modal_mass_kg) / (2 * math.pi) == pytest.approx(
        mode.frequency_hz, rel=1e-3
    )
    # tower-top deflection under ~2 MN of thrust ≈ 0.8 m
    assert 0.5 < 2e6 * mode.hub_participation / mode.stiffness_n_m < 1.2


def test_turbulent_run_is_physical():
    r = simulate_loads(turbulent_wind(11.0, 660.0, seed=1))
    assert r.power_mw.min() >= 0 and r.power_mw.max() <= 15.0 + 1e-9
    assert 0.05 < r.turbulence_intensity < 0.15  # rotor-effective, below the hub-point NTM
    assert 0.1 < r.del_base_moment_nm / r.mean_base_moment_nm < 0.4


def test_lifetime_del_weighting():
    s = lifetime_del(bins=(8.0, 14.0, 20.0), seeds=1)
    assert sum(s.probability) < 1.0
    assert min(s.del_10min_mnm) <= s.lifetime_del_mnm <= max(s.del_10min_mnm)


def test_tower_loads_endpoint():
    from fastapi.testclient import TestClient

    from app.main import app

    r = TestClient(app).get("/api/v1/turbine-physics/tower-loads", params={"wind_ms": 12})
    assert r.status_code == 200, r.text
    b = r.json()
    assert len(b["time_s"]) == len(b["base_moment_mnm"]) == 1200
    assert b["del_base_moment_mnm"] > 0
    assert 0.03 < b["total_damping_ratio"] < 0.15
