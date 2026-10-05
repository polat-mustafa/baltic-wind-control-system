"""Tests for the digital-twin module (ISO 13374-1 pipeline).

1. Reference model — physics envelope, calibration, fault signatures
2. Plant simulator — reproducibility, ground truth
3. Detection — EWMA limits, health zones, Phase I calibration, false-alarm rate
4. Diagnosis & prognosis — isolation and sizing against injected ground truth
5. API endpoints
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.digital_twin import ScenarioName
from app.services.digital_twin.detection import (
    EWMA_L,
    EWMA_LAMBDA,
    ewma_limit,
    health_from_u,
    phase_one_calibration,
    verification_false_events,
)
from app.services.digital_twin.diagnosis import SeverityPoint
from app.services.digital_twin.fault_library import FAULT_KINDS, FAULT_LIBRARY
from app.services.digital_twin.pipeline import run_digital_twin
from app.services.digital_twin.plant_simulator import (
    ANEMOMETER_SIGMA_BASE_MS,
    ANEMOMETER_SIGMA_REL,
    NUM_TURBINES,
    SAMPLES_PER_DAY,
    SCENARIOS,
    simulate_plant,
)
from app.services.digital_twin.prognosis import prognose
from app.services.digital_twin.reference_model import (
    DEFAULT_PARAMS,
    REGION_PITCH,
    FaultParams,
    calibrate,
    evaluate,
    gearbox_temperature,
    reference_curve,
)
from app.services.turbine_physics.aerodynamics import BETZ_LIMIT, compute_cp, compute_cp_array

client = TestClient(app)
API = "/api/v1/digital-twin"


# ── 1. Reference model ────────────────────────────────────────────


class TestReferenceModel:
    def test_vectorised_cp_matches_scalar(self) -> None:
        lam = np.linspace(0.0, 16.0, 81)
        for beta in (0.0, 2.5, 10.0, 30.0):
            vec = compute_cp_array(lam, beta)
            ref = np.array([compute_cp(float(x), beta) for x in lam])
            np.testing.assert_allclose(vec, ref, atol=1e-12)

    def test_calibration_reaches_rated_at_published_rated_wind(self) -> None:
        op = evaluate(np.array([DEFAULT_PARAMS.rated_wind_ms]))
        assert op.power_mw[0] == pytest.approx(15.0, abs=1e-3)
        cal = calibrate()
        assert cal.lambda_opt == pytest.approx(8.1, abs=0.05)  # Heier optimum
        assert 0.8 < cal.k_aero < 1.0

    def test_power_envelope_rule_1(self) -> None:
        rc = reference_curve()
        assert np.all(rc.power_mw >= 0.0)
        assert np.all(rc.power_mw <= 15.0 + 1e-9)
        assert np.all(rc.power_mw[rc.wind_ms < 3.0] == 0.0)
        assert np.all(rc.power_mw[rc.wind_ms > 31.0] == 0.0)
        assert np.all(rc.cp <= BETZ_LIMIT)

    def test_power_monotonic_in_operating_range(self) -> None:
        rc = reference_curve()
        sel = (rc.wind_ms >= 4.0) & (rc.wind_ms <= 31.0)
        assert np.all(np.diff(rc.power_mw[sel]) >= -1e-9)

    def test_rotor_speed_and_pitch_within_limits(self) -> None:
        op = evaluate(np.linspace(3.5, 30.0, 200))
        on = op.operating
        assert np.all(op.rotor_speed_rpm[on] >= 4.0 - 1e-9)
        assert np.all(op.rotor_speed_rpm[on] <= 8.33 + 1e-9)
        assert np.all(op.pitch_deg[on] >= 0.0)
        below = on & (np.linspace(3.5, 30.0, 200) < 11.0)
        assert np.all(op.pitch_deg[below] == 0.0)

    def test_pitch_increases_above_rated(self) -> None:
        v = np.linspace(12.0, 30.0, 40)
        op = evaluate(v)
        assert np.all(op.region == REGION_PITCH)
        assert np.all(np.diff(op.pitch_deg) > 0.0)
        assert 25.0 < op.pitch_deg[-1] < 40.0

    def test_partial_load_matches_p1_table(self) -> None:
        rc = reference_curve()
        sel = (rc.wind_ms >= 7.0) & (rc.wind_ms <= 11.0)
        rel = np.abs(rc.power_mw[sel] - rc.p1_table_power_mw[sel]) / rc.p1_table_power_mw[sel]
        assert rel.max() < 0.03

    def test_higher_density_more_power_below_rated(self) -> None:
        cold = evaluate(np.array([9.0]), 1.30).power_mw[0]
        std = evaluate(np.array([9.0]), 1.225).power_mw[0]
        assert cold > std

    def test_aero_loss_signature(self) -> None:
        nom = evaluate(np.array([9.0, 15.0]))
        ice = evaluate(np.array([9.0, 15.0]), faults=FaultParams(aero_factor=0.7))
        assert ice.power_mw[0] < nom.power_mw[0]
        assert ice.rotor_speed_rpm[0] < nom.rotor_speed_rpm[0]  # K·ω² equilibrium shifts
        assert ice.power_mw[1] == pytest.approx(15.0)  # still enough wind at 15 m/s
        assert ice.pitch_deg[1] < nom.pitch_deg[1]  # less power to shed

    def test_pitch_offset_reports_constant_shift_at_full_load(self) -> None:
        v = np.array([14.0, 18.0, 24.0])
        nom = evaluate(v)
        off = evaluate(v, faults=FaultParams(pitch_offset_deg=4.0))
        np.testing.assert_allclose(off.pitch_deg, nom.pitch_deg - 4.0, atol=0.01)
        np.testing.assert_allclose(off.power_mw, 15.0)

    def test_power_limit_signature(self) -> None:
        nom = evaluate(np.array([16.0]))
        lim = evaluate(np.array([16.0]), faults=FaultParams(power_limit_mw=12.0))
        assert lim.power_mw[0] == pytest.approx(12.0)
        assert lim.rotor_speed_rpm[0] == pytest.approx(nom.rotor_speed_rpm[0])
        assert lim.pitch_deg[0] > nom.pitch_deg[0]

    def test_gearbox_loss_signature(self) -> None:
        nom = evaluate(np.array([9.0]))
        gb = evaluate(np.array([9.0]), faults=FaultParams(gearbox_loss_factor=2.0))
        assert gb.gearbox_loss_kw[0] == pytest.approx(2.0 * nom.gearbox_loss_kw[0], rel=0.05)
        assert gb.power_mw[0] < nom.power_mw[0]

    def test_gearbox_temperature_steady_state(self) -> None:
        loss = np.full((50, 2), 400.0)
        amb = np.full((50, 2), 5.0)
        t = gearbox_temperature(loss, amb, 600.0)
        p = DEFAULT_PARAMS
        expected = 5.0 + p.gearbox_temp_offset_k + p.gearbox_thermal_resistance_k_per_kw * 400.0
        np.testing.assert_allclose(t, expected)

    def test_gearbox_temperature_first_order_step(self) -> None:
        loss = np.concatenate([np.zeros(10), np.full(200, 400.0)])
        t = gearbox_temperature(loss, np.zeros(210), 600.0)
        step = DEFAULT_PARAMS.gearbox_thermal_resistance_k_per_kw * 400.0
        # one time constant (6 samples of 10 min) after the step: 1 − e⁻¹ of the rise
        rise = t[10 + 5] - t[9]
        assert rise == pytest.approx(step * (1 - math.exp(-1)), rel=0.02)


# ── 2. Plant simulator ────────────────────────────────────────────


class TestPlantSimulator:
    def test_reproducible(self) -> None:
        a = simulate_plant(SCENARIOS["combined"], 2, 11)
        b = simulate_plant(SCENARIOS["combined"], 2, 11)
        np.testing.assert_array_equal(a.power_mw, b.power_mw)

    def test_shapes_and_physics(self) -> None:
        d = simulate_plant(SCENARIOS["healthy"], 3, 1)
        n = 3 * SAMPLES_PER_DAY
        assert d.power_mw.shape == (n, NUM_TURBINES)
        assert d.timestamps.shape == (n,)
        assert np.all(np.diff(d.timestamps) == 600)
        assert np.all(d.power_mw >= 0.0)
        assert d.power_mw.max() < 15.3  # rated + transducer noise
        assert np.all(d.power_mw[~d.operating] == 0.0)

    def test_healthy_ground_truth_is_nominal(self) -> None:
        d = simulate_plant(SCENARIOS["healthy"], 2, 1)
        for kind in FAULT_KINDS:
            assert np.all(d.ground_truth[kind] == FAULT_LIBRARY[kind].nominal)

    def test_injection_schedule(self) -> None:
        d = simulate_plant(SCENARIOS["converter_derating"], 5, 1)
        truth = d.ground_truth["power_limit"][:, 27]
        onset = int(np.argmax(truth < 15.0))
        assert onset == pytest.approx(0.40 * (truth.size - 1), abs=1)
        assert np.all(truth[onset:] == 12.0)
        assert np.all(d.ground_truth["power_limit"][:, 26] == 15.0)

    def test_derated_turbine_never_exceeds_limit(self) -> None:
        d = simulate_plant(SCENARIOS["converter_derating"], 7, 42)
        late = d.ground_truth["power_limit"][:, 27] == 12.0
        assert d.power_mw[late, 27].max() < 12.2

    def test_scenario_names_match_schema(self) -> None:
        assert set(SCENARIOS) == set(ScenarioName.__args__)  # type: ignore[attr-defined]


# ── 3. Detection ──────────────────────────────────────────────────


class TestDetection:
    def test_ewma_limit_converges(self) -> None:
        n = np.array([1.0, 10.0, 100.0, 1e6])
        lim = ewma_limit(n)
        assert np.all(np.diff(lim) > 0)
        steady = EWMA_L * math.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA))
        assert lim[-1] == pytest.approx(steady)
        assert lim[0] == pytest.approx(EWMA_L * EWMA_LAMBDA)  # first sample: σ_e = λ

    def test_health_zones(self) -> None:
        hi = health_from_u(np.array([0.0, 1.0, 2.0, 4.0, 10.0]))
        np.testing.assert_allclose(hi, [100.0, 70.0, 40.0, 0.0, 0.0])

    def test_phase_one_recovers_wind_uncertainty(self) -> None:
        """σ_v is inverted from the power scatter; it must recover the simulator truth."""
        a, b = phase_one_calibration().wind_sigma_coef
        assert a == pytest.approx(ANEMOMETER_SIGMA_BASE_MS, rel=0.25)
        assert b == pytest.approx(ANEMOMETER_SIGMA_REL, rel=0.25)

    def test_phase_one_autocorrelation_factors(self) -> None:
        cal = phase_one_calibration()
        assert np.all(cal.acf_factor >= 1.0)
        # the lagged thermal and the spatial-wind channels are clearly autocorrelated
        assert cal.acf_factor[3] > 2.0
        assert cal.acf_factor[4] > 2.0

    def test_fleet_false_alarm_rate(self) -> None:
        """Independent fault-free 30 days × 34 turbines: about one false event a week."""
        assert verification_false_events() <= 10


# ── 4. Diagnosis and prognosis ────────────────────────────────────


@pytest.mark.parametrize(
    ("scenario", "turbine", "kind", "severity", "tol"),
    [
        ("pitch_misalignment", 19, "pitch_offset", 4.0, 0.3),
        ("converter_derating", 27, "power_limit", 12.0, 0.1),
        ("anemometer_drift", 14, "anemometer_gain", 7.4, 1.5),
        ("gearbox_degradation", 11, "gearbox_loss", 1.32, 0.12),
        ("rotor_icing", 7, "aero_efficiency", 31.3, 4.0),
    ],
)
def test_fault_isolated_and_sized(
    scenario: str, turbine: int, kind: str, severity: float, tol: float
) -> None:
    run = run_digital_twin(scenario, 7, 42)
    diag = run.turbines[turbine].diagnosis
    assert diag is not None
    assert diag.kind == kind
    assert diag.severity == pytest.approx(severity, abs=tol)
    assert diag.explained > 0.5


def test_combined_scenario_validation() -> None:
    run = run_digital_twin("combined", 7, 42)
    assert len(run.validation) == 8
    assert all(v.detected for v in run.validation)
    assert all(v.isolation_correct for v in run.validation)
    assert run.false_event_count <= 3


def test_healthy_fleet_has_no_identified_fault() -> None:
    run = run_digital_twin("healthy", 7, 42)
    assert not run.validation
    assert all(t.diagnosis is None or t.diagnosis.kind is None for t in run.turbines)


def test_icing_hint_uses_met_conditions() -> None:
    run = run_digital_twin("rotor_icing", 7, 42)
    diag = run.turbines[6].diagnosis
    assert diag is not None
    assert diag.mean_ambient_c < 1.0
    assert "icing" in diag.cause_hint.lower()


def test_gearbox_prognosis_tracks_injected_rate() -> None:
    run = run_digital_twin("gearbox_degradation", 14, 3)
    prog = run.turbines[11].prognosis
    assert prog is not None
    assert prog.status == "trend"
    true_rate = 0.6 / (0.85 * (14 * SAMPLES_PER_DAY - 1) / SAMPLES_PER_DAY)
    assert prog.slope_per_day == pytest.approx(true_rate, rel=0.1)
    true_rul = (2.0 - 1.6) / true_rate
    assert prog.rul_days == pytest.approx(true_rul, rel=0.15)
    assert prog.rul_lower_days is not None and prog.rul_upper_days is not None
    assert prog.rul_lower_days <= prog.rul_days <= prog.rul_upper_days


def _points(values: list[float], step: int = 72) -> list[SeverityPoint]:
    return [SeverityPoint(i * step, v, 0.01, 50) for i, v in enumerate(values)]


def test_prognosis_linear_trend() -> None:
    # +0.1 per day (two 12 h points per day) from 1.2 → limit 2.0
    pts = _points([1.2 + 0.05 * i for i in range(10)])
    end = 9 * 72
    prog = prognose("gearbox_loss", pts, end)
    assert prog is not None and prog.status == "trend"
    assert prog.slope_per_day == pytest.approx(0.1, rel=1e-3)
    assert prog.rul_days == pytest.approx((2.0 - 1.65) / 0.1, rel=1e-3)


def test_prognosis_requires_significant_trend() -> None:
    rng = np.random.default_rng(0)
    pts = _points(list(1.3 + 0.02 * rng.standard_normal(10)))
    prog = prognose("gearbox_loss", pts, 9 * 72)
    assert prog is not None
    assert prog.status == "no_trend"
    assert prog.rul_days is None


def test_prognosis_only_for_wear_faults() -> None:
    assert prognose("aero_efficiency", _points([10, 12, 14, 16]), 300) is None


# ── 5. API ────────────────────────────────────────────────────────


def test_config_model_card() -> None:
    r = client.get(f"{API}/config")
    assert r.status_code == 200
    body = r.json()
    assert body["turbine"]["rated_power_mw"] == 15.0
    assert [c["key"] for c in body["channels"]] == [
        "power",
        "rotor_speed",
        "pitch",
        "gearbox_temp",
        "anemometer",
    ]
    assert len(body["fault_library"]) == 5
    assert any(s["code"].startswith("ISO 13374-1") for s in body["standards"])


def test_scenarios_endpoint() -> None:
    r = client.get(f"{API}/scenarios")
    assert r.status_code == 200
    names = {s["name"] for s in r.json()}
    assert names == set(SCENARIOS)


def test_reference_curve_endpoint() -> None:
    r = client.get(f"{API}/reference-curve")
    assert r.status_code == 200
    body = r.json()
    assert len(body["wind_ms"]) == len(body["power_mw"]) == len(body["p1_table_power_mw"])
    assert max(body["power_mw"]) == pytest.approx(15.0)


def test_analyze_endpoint() -> None:
    r = client.post(f"{API}/analyze", json={"scenario": "converter_derating"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["turbines"]) == NUM_TURBINES
    assert body["validation"]["detected"] == body["validation"]["injected"] == 1
    farm = body["farm"]
    assert farm["normal_count"] + farm["alert_count"] + farm["alarm_count"] == NUM_TURBINES
    assert 0.0 < farm["energy_performance_pct"] <= 101.0
    wtg28 = body["turbines"][27]
    assert wtg28["diagnosis"]["kind"] == "power_limit"
    assert wtg28["lost_energy_mwh"] > 0.0
    assert len(body["health_trend"]["health"]) == NUM_TURBINES


@pytest.mark.parametrize(
    "payload",
    [{"scenario": "nope"}, {"duration_days": 0}, {"duration_days": 31}, {"seed": -1}],
)
def test_analyze_validation(payload: dict[str, object]) -> None:
    assert client.post(f"{API}/analyze", json=payload).status_code == 422


def test_turbine_detail_endpoint() -> None:
    r = client.post(
        f"{API}/turbine-detail",
        json={"scenario": "pitch_misalignment", "turbine_id": 19},
    )
    assert r.status_code == 200
    body = r.json()
    n = len(body["timestamps"])
    assert n == 7 * SAMPLES_PER_DAY
    assert len(body["channels"]) == 5
    assert all(len(c["measured"]) == n for c in body["channels"])
    assert body["truth"][0]["kind"] == "pitch_offset"
    assert body["turbine"]["diagnosis"]["kind"] == "pitch_offset"


def test_operating_point_endpoint() -> None:
    r = client.post(
        f"{API}/operating-point",
        json={"wind_speed_ms": 9.0, "power_mw": 6.0, "rotor_speed_rpm": 5.9, "pitch_deg": 0.0},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["region"] == "optimal tip-speed ratio"
    assert body["power_residual_mw"] < 0.0
    assert body["power_z"] < -1.0
