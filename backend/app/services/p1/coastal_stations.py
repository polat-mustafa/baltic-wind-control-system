"""
Measured wind on the Polish coast: IMGW-PIB synoptic stations near the farm,
from IMGW's public data API (danepubliczne.imgw.pl, no key; "Źródłem
pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – PIB").

SYNOP: hourly, 10-min mean wind at 10 m on land at the shore — not hub height
and not offshore, so it reads lower than the model wind at the site (less
fetch over the sea, 10 m instead of 150 m). It is the check that the live
weather is real: same weather system, same direction, a plausible ratio.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.cache import cached
from app.core.exceptions import DomainError

IMGW_SYNOP = "https://danepubliczne.imgw.pl/api/data/synop/station/{}"
SOURCE = "IMGW-PIB public data (danepubliczne.imgw.pl), SYNOP stations"

#: (API id, WMO index, name, lat, lon) — positions from the WMO station list (±1 km).
STATIONS: tuple[tuple[str, str, str, float, float], ...] = (
    ("kolobrzeg", "12100", "Kołobrzeg", 54.183, 15.583),
    ("ustka", "12115", "Ustka", 54.583, 16.867),
    ("leba", "12120", "Łeba", 54.750, 17.533),
    ("hel", "12135", "Hel", 54.600, 18.817),
)


def _num(v: Any) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


@cached(prefix="imgw_synop", ttl=600)
def coastal_stations() -> dict[str, Any]:
    """The latest hourly observation of each station (stations that do not answer are left out)."""
    out = []
    with httpx.Client(timeout=15.0) as client:
        for key, wmo, name, lat, lon in STATIONS:
            try:
                r = client.get(IMGW_SYNOP.format(key))
                r.raise_for_status()
                d = r.json()
            except (httpx.HTTPError, ValueError):
                continue
            hour = int(d.get("godzina_pomiaru") or 0)
            out.append(
                {
                    "id": wmo,
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "time_utc": f"{d.get('data_pomiaru')}T{hour:02d}:00Z",
                    "wind_ms": _num(d.get("predkosc_wiatru")),
                    "wind_dir_deg": _num(d.get("kierunek_wiatru")),
                    "air_temp_c": _num(d.get("temperatura")),
                    "pressure_hpa": _num(d.get("cisnienie")),
                    "humidity_pct": _num(d.get("wilgotnosc_wzgledna")),
                }
            )
    if not out:
        raise DomainError("IMGW public data API did not answer.", status_code=502)
    return {"stations": out, "source": SOURCE, "height_m": 10}
