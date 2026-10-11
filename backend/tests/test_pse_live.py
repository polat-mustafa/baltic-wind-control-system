"""PSE open data (his-wlk-cal + rce-pln): summary, hourly prices, the real-day market."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import ValidationError
from app.main import app
from app.services.p2 import pse_live
from app.services.p2.market import simulate_day


def _quarters(n: int = 96) -> list[dict[str, Any]]:
    """Synthetic day: wind 2 GW at night, 6 GW by day; cheap when windy, one negative quarter."""
    out = []
    for k in range(n):
        h, m = divmod(15 * k, 60)
        day = 6 <= h < 18
        out.append(
            {
                "time": f"2026-10-09 {h:02d}:{m + 15 if m < 45 else 0:02d}:00",
                "period": f"{h:02d}:{m:02d} - {h:02d}:{m + 15:02d}",
                "wind_mw": 6000.0 if day else 2000.0,
                "pv_mw": 1000.0 if day else 0.0,
                "demand_mw": 16000.0,
                "price_pln_mwh": (-10.0 if k == 40 else 200.0) if day else 500.0,
            }
        )
    return out


def test_summary_energy_shares_and_capture_price() -> None:
    s = pse_live.summarise(_quarters())
    # MW × ¼ h: wind 12 h × 6 GW + 12 h × 2 GW = 96 GWh, demand 384 GWh
    assert s["wind_mwh"] == 96000 and s["demand_mwh"] == 384000
    assert s["wind_share_pct"] == 25.0
    # windy hours are cheap: the capture price sits below the time average
    assert s["wind_capture_price_pln_mwh"] < s["avg_price_pln_mwh"]
    assert s["wind_capture_rate_pct"] < 100
    assert s["negative_price_quarters"] == 1


def test_hourly_prices_average_the_quarters() -> None:
    p = pse_live.hourly_prices(_quarters())
    assert len(p) == 24
    assert p[0] == 500.0 and p[7] == 200.0
    assert p[10] == pytest.approx((3 * 200.0 - 10.0) / 4)  # quarter 40 = 10:00–10:15


def test_unpublished_prices_are_reported_not_invented() -> None:
    q = [{**x, "price_pln_mwh": None} for x in _quarters()]
    with pytest.raises(pse_live.PseDataError):
        pse_live.hourly_prices(q)


@pytest.mark.parametrize("day", ["2026/10/09", "2020-01-01", "2999-01-01"])
def test_dates_outside_the_quarter_hour_data_are_rejected(day: str) -> None:
    with pytest.raises(ValidationError):
        pse_live.check_date(day)


def test_real_day_market_uses_the_given_shapes() -> None:
    price = [100.0] * 12 + [-20.0] * 2 + [300.0] * 10
    wind = [12.0] * 24
    r = simulate_day(
        "real_day", day={"label": "Real day", "price": price, "wind": wind}, include_bess=False
    )
    assert r["scenario_label"] == "Real day"
    assert r["negative_hours"] == 2
    assert [h["da_price_pln_mwh"] for h in r["hours"]] == price
    # 0 ≤ P ≤ Prated in every hour; curtailed in the negative hours
    assert all(0 <= h["metered_mwh"] <= 510 for h in r["hours"])
    assert r["hours"][12]["metered_mwh"] == 0


def test_market_endpoint_real_day(monkeypatch: pytest.MonkeyPatch) -> None:
    async def day(_: str) -> dict[str, Any]:
        return {"quarters": _quarters()}

    async def wind(_: str) -> list[float]:
        return [10.0] * 24

    monkeypatch.setattr(pse_live, "pse_day", day)
    monkeypatch.setattr(pse_live, "site_wind_hub", wind)
    r = TestClient(app).post(
        "/api/v1/grid/market/day", json={"scenario": "real_day", "date": "2026-10-09"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["scenario"] == "real_day" and "Real day 2026-10-09" in body["scenario_label"]
    assert body["hours"][0]["da_price_pln_mwh"] == 500.0


def test_coastal_stations_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    """IMGW SYNOP proxy: 10 m shore wind per station, with its position."""
    from app.services.p1 import coastal_stations as cs

    class Resp:
        def __init__(self, d: dict[str, str]) -> None:
            self.d = d

        def raise_for_status(self) -> None: ...

        def json(self) -> dict[str, str]:
            return self.d

    class Client:
        def __init__(self, **_: object) -> None: ...

        def __enter__(self) -> Client:
            return self

        def __exit__(self, *_: object) -> None: ...

        def get(self, url: str) -> Resp:
            return Resp(
                {
                    "data_pomiaru": "2026-10-10",
                    "godzina_pomiaru": "21",
                    "predkosc_wiatru": "5",
                    "kierunek_wiatru": "190",
                }
            )

    monkeypatch.setattr(cs.httpx, "Client", Client)
    r = TestClient(app).get("/api/v1/wind/coastal-stations")
    assert r.status_code == 200
    st = r.json()["stations"]
    assert [s["name"] for s in st] == [s[2] for s in cs.STATIONS]
    assert st[0]["wind_ms"] == 5.0 and st[0]["time_utc"] == "2026-10-10T21:00Z"


def test_current_quarter_is_the_one_ending_after_now() -> None:
    q = _quarters()
    assert pse_live.current_quarter(q, "2026-10-09 10:07:00")["period"] == "10:00 - 10:15"
    assert pse_live.current_quarter(q, "2026-10-09 10:15:00")["period"] == "10:15 - 10:30"
    q[41]["price_pln_mwh"] = None  # unpublished: not invented
    assert pse_live.current_quarter(q[:42], "2026-10-09 10:20:00") is None


def test_price_now_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    async def day(_: str) -> dict[str, Any]:
        future = {"time": "2999-01-01 00:00:00", "price_pln_mwh": -25.0}
        return {"quarters": [{**q, **future} for q in _quarters(1)]}

    monkeypatch.setattr(pse_live, "pse_day", day)
    body = TestClient(app).get("/api/v1/grid/pse/price-now").json()
    assert body["price_pln_mwh"] == -25.0 and body["negative"] is True
