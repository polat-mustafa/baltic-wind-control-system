"""Fleet O&M simulation (audit B-9) against the analytic availability model."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.lifecycle.availability_model import availability
from app.services.lifecycle.om_simulation import simulate_om


@pytest.mark.validation
def test_continuous_mode_reproduces_the_analytic_model(evidence):
    a = availability()
    sims = [simulate_om(mode="continuous", seed=s) for s in range(3)]
    mean_tb = sum(r.time_based_mean for r in sims) / len(sims)
    assert mean_tb == pytest.approx(a.time_based, abs=0.006)
    evidence(
        "lc-om-vs-analytic",
        area="Lifecycle — O&M",
        kind="analytic",
        claim="hourly fleet O&M simulation in its validation mode (unlimited crews, "
        "continuous weather windows)",
        against="analytic availability model on the same hindcast and failure rates",
        metric="time-based availability difference",
        value=100 * (mean_tb - a.time_based),
        unit="pp",
        limit="|Δ| ≤ 0.6 pp",
        tolerance=0.3,
    )
    for c_idx, c in enumerate(a.classes):
        d = sum(r.mean_downtime_h[c_idx] for r in sims) / len(sims)
        # hourly vs 6-hourly window discretisation
        assert d == pytest.approx(c.downtime_h, rel=0.1, abs=3.0)


def test_limited_crews_and_shifts_cost_availability():
    analytic = availability().time_based
    two = simulate_om(n_ctv=2)
    one = simulate_om(n_ctv=1)
    three = simulate_om(n_ctv=3)
    assert one.time_based_mean < two.time_based_mean < three.time_based_mean < analytic
    # diminishing returns: the third vessel buys less than the second
    assert (three.time_based_mean - two.time_based_mean) < (
        two.time_based_mean - one.time_based_mean
    )


def test_energy_based_below_time_based_and_p90_below_mean():
    r = simulate_om()
    assert r.energy_based_mean < r.time_based_mean
    assert r.energy_based_p90 < r.energy_based_mean
    assert len(r.years) == 30
    assert all(0.7 < y.time_based < 1.0 for y in r.years)


def test_failure_counts_match_the_rates():
    r = simulate_om()
    per_year = sum(y.failures for y in r.years) / len(r.years)
    assert per_year == pytest.approx(34 * 8.3, rel=0.05)


def test_costs_are_itemised():
    r = simulate_om()
    assert set(r.cost_eur_per_year) == {"ctv_charter", "technicians", "jackup", "materials"}
    assert r.cost_eur_per_mw_year == pytest.approx(sum(r.cost_eur_per_year.values()) / 510, abs=1)


def test_endpoint():
    resp = TestClient(app).get("/api/v1/lifecycle/om-simulation", params={"n_ctv": 2})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    assert b["time_based_mean"] < b["analytic_time_based"]
    assert set(b["mean_downtime_h"]) == {"Minor repair", "Major repair", "Major replacement"}
