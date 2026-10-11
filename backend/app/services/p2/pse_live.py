"""
The real Polish power system on a given day, from PSE's open reporting API
(api.raporty.pse.pl, no key; data "Raporty PSE", reuse with attribution):

- ``his-wlk-cal``: wind (``wi``), solar (``pv``) and demand of the KSE per
  15 min, filled in through the day about an hour behind real time;
- ``rce-pln``: the market price of energy RCE per 15 min [PLN/MWh], published
  the day before (it follows the day-ahead market, TGE / SDAC).

Used for the Market tab's "real day" (the price curve) and the system panel:
how much of Poland's demand wind covered, and at what price wind sold — the
capture price Σ(P_wind·price)/ΣP_wind, below the time average when windy
hours are cheap (the cannibalisation the market tab teaches).
"""

from __future__ import annotations

import datetime as dt
import re
from typing import Any

import httpx
import numpy as np

from app.core.cache import cached
from app.core.exceptions import DomainError, ValidationError

PSE_API = "https://api.raporty.pse.pl/api"
#: RCE has been published per 15 min since 14 June 2024 (hourly before).
FIRST_DAY = dt.date(2024, 6, 14)
SOURCE = (
    "PSE S.A., Raporty PSE (api.raporty.pse.pl): his-wlk-cal (wind, PV, demand) and rce-pln (RCE)"
)


class PseDataError(DomainError):
    """The PSE reporting API has no data for the day, or did not answer."""

    status_code = 502


def check_date(day: str) -> dt.date:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValidationError(f"Date {day!r} is not YYYY-MM-DD.")
    d = dt.date.fromisoformat(day)
    if not FIRST_DAY <= d <= dt.date.today() + dt.timedelta(days=1):
        raise ValidationError(f"PSE quarter-hour data runs from {FIRST_DAY} to tomorrow.")
    return d


def _rows(client: httpx.Client, entity: str, day: str) -> list[dict[str, Any]]:
    """Every row of one business day (the API pages with nextLink)."""
    rows: list[dict[str, Any]] = []
    url: str | None = f"{PSE_API}/{entity}"
    params: dict[str, str] | None = {"$filter": f"business_date eq '{day}'"}
    while url:
        r = client.get(url, params=params)
        r.raise_for_status()
        body = r.json()
        rows += body.get("value", [])
        url, params = body.get("nextLink"), None
    return rows


@cached(prefix="pse_day", ttl=900)
def pse_day(day: str) -> dict[str, Any]:
    """Quarter-hours of one day (Polish time) with wind, PV, demand and RCE, and a summary."""
    check_date(day)
    try:
        with httpx.Client(timeout=30.0, headers={"User-Agent": "OffshoreForge/1.0"}) as client:
            gen = _rows(client, "his-wlk-cal", day)
            rce = _rows(client, "rce-pln", day)
    except httpx.HTTPError as e:
        raise PseDataError(f"PSE reporting API: {e}") from e
    price = {r["dtime"]: r["rce_pln"] for r in rce if r.get("rce_pln") is not None}
    by_time = {r["dtime"]: r for r in gen}
    quarters = []
    for t in sorted(set(by_time) | set(price)):
        g = by_time.get(t, {})
        quarters.append(
            {
                "time": t,  # end of the quarter-hour, Polish time
                "period": g.get("period")
                or next((r["period"] for r in rce if r["dtime"] == t), ""),
                "wind_mw": g.get("wi"),
                "pv_mw": g.get("pv"),
                "demand_mw": g.get("demand"),
                "price_pln_mwh": price.get(t),
            }
        )
    if not quarters:
        raise PseDataError(f"PSE has no data for {day}.")
    return {"date": day, "quarters": quarters, "summary": summarise(quarters), "source": SOURCE}


def current_quarter(quarters: list[dict[str, Any]], now: str) -> dict[str, Any] | None:
    """The quarter-hour that holds ``now`` ("YYYY-MM-DD HH:MM:SS", Polish time) with a price.

    Quarters are stamped with their end time, so it is the first one ending after now.
    """
    return next(
        (q for q in quarters if q["time"] > now and q["price_pln_mwh"] is not None),
        None,
    )


def summarise(quarters: list[dict[str, Any]]) -> dict[str, Any]:
    """Energy [MWh] (MW × ¼ h), shares, average and wind capture price over the filled quarters."""
    filled = [q for q in quarters if q["wind_mw"] is not None and q["demand_mw"] is not None]
    priced = [q for q in quarters if q["price_pln_mwh"] is not None]
    both = [q for q in filled if q["price_pln_mwh"] is not None]
    wind = np.array([q["wind_mw"] for q in filled], dtype=float)
    pv = np.array([q["pv_mw"] or 0.0 for q in filled], dtype=float)
    demand = np.array([q["demand_mw"] for q in filled], dtype=float)
    avg_price = float(np.mean([q["price_pln_mwh"] for q in priced])) if priced else None
    w = np.array([q["wind_mw"] for q in both], dtype=float)
    p = np.array([q["price_pln_mwh"] for q in both], dtype=float)
    capture = float(w @ p / w.sum()) if both and w.sum() > 0 else None
    return {
        "quarters_filled": len(filled),
        "last_filled": filled[-1]["time"] if filled else None,
        "wind_mwh": round(float(wind.sum()) / 4, 0),
        "pv_mwh": round(float(pv.sum()) / 4, 0),
        "demand_mwh": round(float(demand.sum()) / 4, 0),
        "wind_share_pct": round(100 * float(wind.sum() / demand.sum()), 1) if filled else None,
        "pv_share_pct": round(100 * float(pv.sum() / demand.sum()), 1) if filled else None,
        "wind_peak_mw": round(float(wind.max()), 0) if filled else None,
        "avg_price_pln_mwh": None if avg_price is None else round(avg_price, 1),
        "wind_capture_price_pln_mwh": None if capture is None else round(capture, 1),
        "wind_capture_rate_pct": None
        if capture is None or not avg_price
        else round(100 * capture / avg_price, 1),
        "negative_price_quarters": sum(1 for q in priced if q["price_pln_mwh"] < 0),
    }


def hourly_prices(quarters: list[dict[str, Any]]) -> list[float]:
    """24 hourly prices: the mean of each hour's quarters (by the period's start, Polish time).

    A DST day has 23 or 25 hours; the repeated / missing hour is merged / filled from its neighbour.
    """
    by_hour: dict[int, list[float]] = {}
    for q in quarters:
        if q["price_pln_mwh"] is None or not q["period"]:
            continue
        by_hour.setdefault(int(q["period"][:2]), []).append(q["price_pln_mwh"])
    if len(by_hour) < 20:
        raise PseDataError("RCE for this day is not (fully) published yet.")
    out: list[float] = []
    for h in range(24):
        vals = by_hour.get(h)
        out.append(
            float(np.mean(vals))
            if vals
            else (out[-1] if out else float(np.mean(by_hour[min(by_hour)])))
        )
    return out


#: SB-510 array centre (WGS84) and the hub-height extrapolation used by the lifecycle weather.
SITE = (55.063, 16.536)


@cached(prefix="site_wind", ttl=3600)
def site_wind_hub(day: str) -> list[float]:
    """24 hourly hub-height wind speeds [m/s] at the site on `day` (Polish time), Open-Meteo.

    Recent days and up to two weeks ahead from the forecast API (best-match model run),
    older days from the ERA5 archive; 100 m wind × (hub / 100 m)^α.
    """
    from app.services.lifecycle.weather import HUB_HEIGHT_M, SHEAR_ALPHA

    d = check_date(day)
    recent = d >= dt.date.today() - dt.timedelta(days=80)
    url = (
        "https://api.open-meteo.com/v1/forecast"
        if recent
        else "https://archive-api.open-meteo.com/v1/archive"
    )
    params: dict[str, str | float] = {
        "latitude": SITE[0],
        "longitude": SITE[1],
        "hourly": "wind_speed_100m",
        "wind_speed_unit": "ms",
        "timezone": "Europe/Warsaw",
        "start_date": day,
        "end_date": day,
    }
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(url, params=params)
            r.raise_for_status()
            v100 = [x for x in r.json()["hourly"]["wind_speed_100m"] if x is not None]
    except (httpx.HTTPError, KeyError) as e:
        raise PseDataError(f"Open-Meteo wind for {day}: {e}") from e
    if len(v100) < 23:
        raise PseDataError(f"Open-Meteo has no full day of wind for {day}.")
    v100 = (v100 + v100[-1:])[:24]  # a 23-hour DST day repeats its last hour
    return [round(v * (HUB_HEIGHT_M / 100.0) ** SHEAR_ALPHA, 2) for v in v100]
