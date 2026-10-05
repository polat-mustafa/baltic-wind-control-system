"""Construction / decommissioning campaigns in weather windows (/api/v1/lifecycle)."""

from __future__ import annotations

import math
from datetime import date
from typing import Any

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.lifecycle import weather
from app.services.lifecycle.campaign import CampaignInput, _charter, install_plan, run_campaign

client = TestClient(app)
URL = "/api/v1/lifecycle/campaign"


def _inp(**kw: Any) -> CampaignInput:
    base: dict[str, Any] = {
        "mode": "install",
        "n_turbines": 12,
        "strings": [6, 6],
        "array_km": 19.2,
        "export_km": 30.0,
        "foundation": "monopile",
        "start": date(2028, 4, 1),
        "alpha": 0.8,
        "runs": 40,
        "seed": 3,
    }
    base.update(kw)
    return CampaignInput(**base)


# ── weather model ─────────────────────────────────────────────────────────────


def test_marginals_follow_the_monthly_climate() -> None:
    """Simulated Hs and wind match their Rayleigh / Weibull k=2 CDFs in a winter month."""
    hs, vw = weather.simulate(date(2028, 1, 1), 31 * 4, 400, seed=7)
    mu_h, mu_v = weather.HS_MEAN[0], weather.VW_MEAN[0]
    for x in (1.0, 1.5, 2.5):
        expected = 1 - math.exp(-math.pi / 4 * (x / mu_h) ** 2)
        assert abs(float((hs <= x).mean()) - expected) < 0.03
    c = 2 * mu_v / math.sqrt(math.pi)
    for x in (6.0, 10.0, 14.0):
        assert abs(float((vw <= x).mean()) - (1 - math.exp(-((x / c) ** 2)))) < 0.03
    # Rayleigh mean ≈ monthly mean [m]
    assert abs(float(hs.mean()) - mu_h) < 0.08


def test_sea_states_persist_and_wind_follows_waves() -> None:
    hs, vw = weather.simulate(date(2028, 7, 1), 2000, 50, seed=1)
    lag1 = np.corrcoef(hs[:, :-1].ravel(), hs[:, 1:].ravel())[0, 1]
    assert lag1 > 0.75  # storms last for days, not 6 h
    assert np.corrcoef(hs.ravel(), vw.ravel())[0, 1] > 0.5


def test_run_lengths() -> None:
    ok = np.array([[True, True, False, True, True, True]])
    assert weather.run_lengths(ok).tolist() == [[2, 1, 0, 3, 2, 1]]


def test_hub_wind_shear() -> None:
    # (150/10)^0.14 ≈ 1.46
    assert abs(float(weather.hub_wind(np.array([10.0]))[0]) - 14.6) < 0.1


# ── campaign engine ───────────────────────────────────────────────────────────


def test_no_weather_limits_gives_the_planned_duration() -> None:
    """With every limit far above any sea state there is no waiting on weather."""
    huge = {v: (99.0, 99.0) for v in ("HLV", "WTIV", "CLV", "CTV")}
    r = run_campaign(_inp(limits=huge, alpha=1.0))
    assert all(a["wow_days"] == 0 for a in r["activities"])
    assert r["total_days"]["p10"] == r["total_days"]["p90"]
    # HLV: OSS (one trip 2 d + 2 × 36 h) = 5 d,
    # then 12 monopiles (3 trips × 2 d + 12 × 30 h) = 21 d → 26 d
    found = next(a for a in r["activities"] if a["id"] == "foundations")
    assert found["end_day"] == 26.0


def test_percentiles_are_ordered_and_reproducible() -> None:
    a = run_campaign(_inp())
    b = run_campaign(_inp())
    assert a == b
    for m in a["milestones"]:
        d = m["days"]
        assert 0 <= d["p10"] <= d["p50"] <= d["p90"]
    assert a["cost_meur"]["p10"] <= a["cost_meur"]["p50"] <= a["cost_meur"]["p90"]
    assert a["unfinished_runs"] == 0


def test_milestones_respect_the_physical_order() -> None:
    r = run_campaign(_inp())
    m = {x["id"]: x["days"]["p50"] for x in r["milestones"]}
    # first power needs the OSS and the export cable; COD comes last
    assert m["first-power"] >= max(m["oss"], m["export"])
    assert m["cod"] >= m["turbines"] >= m["first-power"]
    acts = {a["id"]: a for a in r["activities"]}
    assert acts["turbines"]["start_day"] >= acts["foundations"]["start_day"]


def test_winter_start_takes_longer_than_summer() -> None:
    summer = run_campaign(_inp(start=date(2028, 4, 1)))
    winter = run_campaign(_inp(start=date(2028, 10, 1)))
    assert winter["total_days"]["p50"] > summer["total_days"]["p50"]
    assert winter["cost_meur"]["p50"] > summer["cost_meur"]["p50"]


def test_lower_alpha_means_more_waiting() -> None:
    strict = run_campaign(_inp(alpha=0.6))
    loose = run_campaign(_inp(alpha=1.0))
    assert strict["total_days"]["p50"] > loose["total_days"]["p50"]


def test_workability_is_seasonal_and_ctv_most_restricted() -> None:
    r = run_campaign(_inp(runs=60))
    v = {x["id"]: x for x in r["vessels"]}
    for x in v.values():
        w = x["workable_pct_by_month"]
        assert w[6] > w[0]  # July > January
        assert all(0 <= p <= 100 for p in w if p is not None)
        # a long window is never more likely than a single workable step
        assert all(
            b <= a
            for a, b in zip(w, x["window_pct_by_month"], strict=True)
            if a is not None and b is not None
        )
    assert v["CTV"]["workable_pct_by_month"][0] < v["CLV"]["workable_pct_by_month"][0]


def test_jacket_takes_longer_than_monopile() -> None:
    def end(r: dict[str, Any]) -> float:
        return float(next(a for a in r["milestones"] if a["id"] == "foundations")["days"]["p50"])

    assert end(run_campaign(_inp(foundation="jacket"))) > end(run_campaign(_inp()))


def test_commissioning_waits_for_its_whole_string() -> None:
    plan = install_plan(_inp())
    gate = next(a for a in plan if a.id == "commissioning").gate
    assert gate is not None
    ends = {"turbines": np.arange(12), "array": np.array([5, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 9])}
    assert gate(0, ends) == 5  # string 1 waits for its slowest section
    assert gate(6, ends) == 9  # string 2 likewise


def test_charter_keeps_short_gaps_and_remobilises_after_long_ones() -> None:
    spd = weather.STEPS_PER_DAY
    start = np.array([[0.0, 12.0 * spd], [0.0, 60.0 * spd]])
    end = np.array([[10.0 * spd, 20.0 * spd], [10.0 * spd, 70.0 * spd]])
    charter, mobs = _charter(start, end)
    assert (charter / spd).tolist() == [20.0, 20.0]  # 2-day gap paid, 50-day gap not
    assert mobs.tolist() == [1.0, 2.0]


def test_array_cable_vessel_is_mobilised_just_in_time() -> None:
    """The CLV does not sit idle behind the slower foundation campaign."""
    huge = {v: (99.0, 99.0) for v in ("HLV", "WTIV", "CLV", "CTV")}
    r = run_campaign(_inp(n_turbines=24, strings=[6, 6, 6, 6], limits=huge, alpha=1.0))
    acts = {a["id"]: a for a in r["activities"]}
    assert acts["array"]["start_day"] > acts["export"]["end_day"]
    # it still finishes after the last foundation
    assert acts["array"]["end_day"] >= acts["foundations"]["end_day"]


def test_removal_options_change_scope() -> None:
    light = run_campaign(_inp(mode="remove"))
    full = run_campaign(
        _inp(
            mode="remove",
            remove_foundations="full",
            remove_array=True,
            remove_export=True,
            remove_scour=True,
        )
    )
    assert full["total_days"]["p50"] > light["total_days"]["p50"]
    assert full["cost_meur"]["p50"] > light["cost_meur"]["p50"]
    ids = [m["id"] for m in light["milestones"]]
    assert ids[-1] == "survey"


# ── API ───────────────────────────────────────────────────────────────────────


def test_api_install_defaults() -> None:
    r = client.post(URL, json={"n_turbines": 34, "runs": 30})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["strings"] == [6, 6, 6, 6, 5, 5]
    assert {v["id"] for v in body["vessels"]} == {"HLV", "WTIV", "CLV", "CTV"}
    assert len(body["months"]) == 12 and body["assumptions"]
    wtiv = next(v for v in body["vessels"] if v["id"] == "WTIV")
    assert wtiv["wind_reference"].startswith("hub")


def test_api_vessel_limit_override() -> None:
    r = client.post(
        URL,
        json={
            "n_turbines": 6,
            "runs": 20,
            "limits": [{"vessel": "WTIV", "hs_m": 3.0, "wind_ms": 20.0}],
        },
    )
    assert r.status_code == 200
    wtiv = next(v for v in r.json()["vessels"] if v["id"] == "WTIV")
    assert (wtiv["hs_limit_m"], wtiv["wind_limit_ms"]) == (3.0, 20.0)


def test_api_rejects_bad_strings_and_sizes() -> None:
    assert client.post(URL, json={"n_turbines": 10, "strings": [6, 5]}).status_code == 422
    assert client.post(URL, json={"n_turbines": 13, "strings": [13]}).status_code == 422
    assert client.post(URL, json={"n_turbines": 151}).status_code == 422
    assert client.post(URL, json={"alpha": 1.2}).status_code == 422
    assert client.post(URL, json={"runs": 5000}).status_code == 422
