"""Copernicus Marine sea conditions at SB-510: plausible Baltic values and the cable rating."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.lifecycle.weather import HINDCAST_SOURCE, hindcast
from app.services.p2.cable_dts import R_EXT_J_TUBE, rating_a


def test_metocean_endpoint_is_plausible_for_the_southern_baltic() -> None:
    r = TestClient(app).get("/api/v1/wind/metocean")
    assert r.status_code == 200
    d = r.json()
    assert "Copernicus Marine" in d["attribution"]
    w = d["waves"]
    # open southern Baltic: median Hs ≈ 1 m, P99 3–5 m, record storm (Anatol, Dec 1999) ≈ 8.5 m
    assert 0.6 < w["hs_p50_m"] < 1.4 and 3.0 < w["hs_p99_m"] < 5.0
    assert 6.0 < w["hs_max_m"] < 10.0 and 6.0 < w["hs_50yr_m"] < 11.0
    assert max(w["hs_monthly_mean_m"]) == w["hs_monthly_mean_m"][0]  # winter roughest
    assert all(0 <= p <= 100 for p in w["access_hs_le_1_5_pct"])
    assert w["access_hs_le_1_5_pct"][5] > w["access_hs_le_1_5_pct"][0]  # June > January
    s = d["sea"]
    assert 0.0 < s["current_p99_ms"] < 1.0
    near = s["seabed"][-1]
    assert near["monthly_mean_c"][7] > near["monthly_mean_c"][1]  # August warmer than February


def test_cable_rating_follows_the_seabed_temperature() -> None:
    d = TestClient(app).get("/api/v1/wind/metocean").json()
    cable = d["cable"]
    near = d["sea"]["seabed"][-1]["monthly_p99_c"]
    hdd = next(s for s in cable["sections"] if s["section"] == "HDD landfall")["monthly_rating_a"]
    # hottest month → lowest rating; colder than the 20 °C design → above the datasheet rating
    assert hdd.index(min(hdd)) == near.index(max(near))
    assert (
        rating_a(15.0, R_EXT_J_TUBE) > rating_a(20.0, R_EXT_J_TUBE) > rating_a(25.0, R_EXT_J_TUBE)
    )
    # the buried sections keep a margin over the full-load current in every month
    for s in cable["sections"]:
        assert min(s["monthly_rating_a"]) > cable["full_load_a"]


def test_both_ice_sources_and_cmems_waves_in_the_hindcast() -> None:
    d = TestClient(app).get("/api/v1/wind/metocean").json()
    assert d["ice"]["oisst"]["days"] and d["ice"]["cmems"]["ice_days_by_winter"]
    assert "BALTICSEA_MULTIYEAR_WAV_003_015" in HINDCAST_SOURCE
    _, hs, _ = hindcast()
    assert 1.0 < float(hs.mean()) < 1.5
