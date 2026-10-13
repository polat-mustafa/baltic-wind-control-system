"""Bundle PSE's wind curtailment and negative-price hours as monthly totals (audit 2.1).

    cd backend && python scripts/fetch_pse_curtailment.py [first-month last-month]

Three open PSE reporting-API series (api.raporty.pse.pl, no key; "Raporty PSE", reuse with
attribution), per 15 min, Polish time:

- ``poze-redoze``: non-market redispatch of RES — wind reduced for balance reasons
  (``wi_red_balance``) and for network reasons (``wi_red_network``) [MW, negative];
  published since 24 September 2024;
- ``his-wlk-cal``: wind generation of the KSE (``wi``) [MW], after any reduction;
- ``rce-pln``: the market price RCE [PLN/MWh].

Per month (energies in MWh = MW × 0.25 h per quarter): potential wind energy (generation +
reduction), the reductions, and the potential energy in quarters with RCE < 0 — the hours a
farm that offers nothing at negative prices loses (``aep_calculator.pse_curtailment``).
Output: app/services/p1/data/pse_curtailment.json (then run scripts/data_manifest.py).
"""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any

import httpx

API = "https://api.raporty.pse.pl/api"
OUT = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "services"
    / "p1"
    / "data"
    / "pse_curtailment.json"
)
FIRST, LAST = "2024-10", "2026-09"


def _rows(client: httpx.Client, entity: str, first: str, last: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    url: str | None = f"{API}/{entity}"
    params: dict[str, str] | None = {
        "$filter": f"business_date ge '{first}' and business_date le '{last}'"
    }
    while url:
        r = client.get(url, params=params)
        r.raise_for_status()
        body = r.json()
        rows += body.get("value", [])
        url, params = body.get("nextLink"), None
    return rows


def _months(first: str, last: str) -> list[tuple[str, str, str]]:
    y, m = map(int, first.split("-"))
    out = []
    while f"{y:04d}-{m:02d}" <= last:
        start = dt.date(y, m, 1)
        nxt = dt.date(y + (m == 12), m % 12 + 1, 1)
        out.append(
            (f"{y:04d}-{m:02d}", start.isoformat(), (nxt - dt.timedelta(days=1)).isoformat())
        )
        y, m = nxt.year, nxt.month
    return out


def month_totals(client: httpx.Client, first: str, last: str) -> dict[str, float]:
    gen = {r["dtime"]: r.get("wi") for r in _rows(client, "his-wlk-cal", first, last)}
    red = {r["dtime"]: r for r in _rows(client, "poze-redoze", first, last)}
    price = {r["dtime"]: r.get("rce_pln") for r in _rows(client, "rce-pln", first, last)}
    t = {"quarters": 0, "wind_mwh": 0.0, "red_balance_mwh": 0.0, "red_network_mwh": 0.0,
         "negative_price_quarters": 0, "negative_price_potential_mwh": 0.0}  # fmt: skip
    for time, wi in gen.items():
        if wi is None:
            continue
        r = red.get(time, {})
        rb = -(r.get("wi_red_balance") or 0.0)
        rn = -(r.get("wi_red_network") or 0.0)
        t["quarters"] += 1
        t["wind_mwh"] += wi / 4
        t["red_balance_mwh"] += rb / 4
        t["red_network_mwh"] += rn / 4
        p = price.get(time)
        if p is not None and p < 0:
            t["negative_price_quarters"] += 1
            t["negative_price_potential_mwh"] += (wi + rb + rn) / 4
            # reductions inside negative-price quarters are counted there, not twice
            t["red_in_negative_mwh"] = t.get("red_in_negative_mwh", 0.0) + (rb + rn) / 4
    t.setdefault("red_in_negative_mwh", 0.0)
    return {k: round(v, 1) if isinstance(v, float) else v for k, v in t.items()}


def main(first: str = FIRST, last: str = LAST) -> None:
    months = {}
    with httpx.Client(timeout=120.0, headers={"User-Agent": "OffshoreForge/1.0"}) as client:
        for label, a, b in _months(first, last):
            months[label] = month_totals(client, a, b)
            print(label, months[label])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "source": "PSE S.A., Raporty PSE (api.raporty.pse.pl): poze-redoze, his-wlk-cal, "
                "rce-pln; quarter-hours aggregated per month by scripts/fetch_pse_curtailment.py",
                "units": "MWh per month; reductions positive",
                "months": months,
            },
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
