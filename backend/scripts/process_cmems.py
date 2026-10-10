"""Copernicus Marine (CMEMS) Baltic reanalyses → the metocean data the platform uses.

Download the two subsets from the Copernicus Marine Data Store (free account, "Download"
on the product page; NetCDF), then:

    cd backend && python scripts/process_cmems.py WAVES.nc PHYSICS.nc

* WAVES = BALTICSEA_MULTIYEAR_WAV_003_015, dataset cmems_mod_bal_wav_my_PT1H-i (hourly,
  1980 → ), variables VHM0 VTPK VTM02 VMDR VCMX, box 55.04–55.09 °N 16.50–16.58 °E
  (3 × 3 cells around SB-510); doi:10.48670/moi-00014.
* PHYSICS = BALTICSEA_MULTIYEAR_PHY_003_011, dataset cmems_mod_bal_phy_my_P1D-m (daily,
  1993 → ), variables bottomT siconc sithick thetao uo vo at 0.5 m, box 54.43–55.10 °N
  16.38–16.60 °E (the site and the export route to landfall); doi:10.48670/moi-00013.

Writes (the raw NetCDF stays out of the repository):

* ``app/services/lifecycle/data/sb510_metocean_6h.csv.gz`` — Hs column from CMEMS (worst
  hour of each 6-hour block, centre cell), the ERA5 10 m wind column kept;
* ``app/services/lifecycle/data/sb510_ice.json`` — a ``cmems`` block next to NOAA OISST;
* ``app/services/p1/data/cmems_metocean.json`` — wave statistics and the 50-year Hs,
  surface currents, seabed temperature along the export route, sea surface temperature.

Files are NetCDF-4 (HDF5): read with pyfive, which needs no compiled HDF5 library.
"""

from __future__ import annotations

import csv
import gzip
import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pyfive

BACKEND = Path(__file__).resolve().parents[1]
LIFECYCLE = BACKEND / "app/services/lifecycle/data"
OUT = BACKEND / "app/services/p1/data/cmems_metocean.json"
ATTRIBUTION = "Generated using E.U. Copernicus Marine Service Information"
LICENCE = "Copernicus Marine Service licence: free and open, attribution required"
WAVE_PRODUCT = "BALTICSEA_MULTIYEAR_WAV_003_015 (doi:10.48670/moi-00014)"
PHY_PRODUCT = "BALTICSEA_MULTIYEAR_PHY_003_011 (doi:10.48670/moi-00013)"
#: Seabed temperature along the export route: (label, lat, lon). Positions on the route of
#: constants/windFarmLayout EXPORT_CABLE_GEO; water depths from the site bathymetry.
ROUTE_POINTS = (
    ("SB-510 site (≈ 45 m)", 55.06, 16.54),
    ("Mid-route (≈ 30 m)", 54.75, 16.45),
    ("Near landfall (≈ 10 m)", 54.48, 16.41),
)
ICE_CONC = 0.15  # an "ice day": concentration above 15 % (the usual ice-edge threshold)


def _months(t: np.ndarray) -> np.ndarray:
    return np.asarray(t.astype("datetime64[M]").astype(int) % 12)


def _r(x: float, d: int = 2) -> float:
    return round(float(x), d)


def gumbel(maxima: np.ndarray, years: float) -> float:
    """Return value of annual maxima, Gumbel by moments: x_T = μ − β·ln(−ln(1 − 1/T))."""
    beta = float(np.std(maxima, ddof=1)) * math.sqrt(6) / math.pi
    mu = float(np.mean(maxima)) - 0.5772 * beta
    return mu - beta * math.log(-math.log(1 - 1 / years))


def waves(path: Path) -> tuple[dict[str, Any], np.ndarray, np.ndarray]:
    f = pyfive.File(str(path))
    t = np.array(f["time"][:], dtype="datetime64[s]")
    hs = np.array(f["VHM0"][:, 1, 1], dtype=float)  # centre cell of the 3 × 3 box
    tp = np.array(f["VTPK"][:, 1, 1], dtype=float)
    hmax = np.array(f["VCMX"][:, 1, 1], dtype=float)
    year = t.astype("datetime64[Y]").astype(int) + 1970
    full = [y for y in range(int(year.min()), int(year.max())) if (year == y).sum() > 8000]
    am = np.array([np.nanmax(hs[year == y]) for y in full])
    m = _months(t)
    where = f"{f['latitude'][1]:.3f} °N {f['longitude'][1]:.3f} °E"
    summary = {
        "source": f"{WAVE_PRODUCT}, hourly, centre cell {where}",
        "period": [str(t[0])[:10], str(t[-1])[:10]],
        "hs_mean_m": _r(np.nanmean(hs)),
        "hs_p50_m": _r(np.nanpercentile(hs, 50)),
        "hs_p90_m": _r(np.nanpercentile(hs, 90)),
        "hs_p99_m": _r(np.nanpercentile(hs, 99)),
        "hs_max_m": _r(np.nanmax(hs)),
        "hs_max_time": str(t[int(np.nanargmax(hs))])[:13],
        "hmax_max_m": _r(np.nanmax(hmax)),
        "tp_at_hs_p99_s": _r(np.nanmedian(tp[hs >= np.nanpercentile(hs, 99)]), 1),
        "annual_max_years": [full[0], full[-1]],
        "annual_max_mean_m": _r(am.mean()),
        "hs_50yr_m": _r(gumbel(am, 50)),
        "hs_monthly_mean_m": [_r(np.nanmean(hs[m == k])) for k in range(12)],
        "access_hs_le_1_5_pct": [_r(100 * np.mean(hs[m == k] <= 1.5), 1) for k in range(12)],
        "access_hs_le_2_5_pct": [_r(100 * np.mean(hs[m == k] <= 2.5), 1) for k in range(12)],
    }
    return summary, t, hs


def rewrite_hindcast(t: np.ndarray, hs: np.ndarray) -> tuple[float, float]:
    """Hs of the bundled 6-hourly hindcast from CMEMS (worst hour of each block); wind kept."""
    path = LIFECYCLE / "sb510_metocean_6h.csv.gz"
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        rows = list(csv.reader(fh))
    hour = {int(x): v for x, v in zip(t.astype("datetime64[h]").astype(int), hs, strict=True)}
    old, new, out = [], [], [rows[0]]
    for r in rows[1:]:
        h0 = int(np.datetime64(r[0].rstrip("Z"), "h").astype(int))
        block = [hour[h] for h in range(h0, h0 + 6) if h in hour and np.isfinite(hour[h])]
        if not block:
            raise SystemExit(f"no CMEMS wave hours for {r[0]} — pack left unchanged")
        old.append(float(r[1]))
        new.append(max(block))
        out.append([r[0], f"{max(block):.2f}", r[2]])
    with gzip.open(path, "wt", newline="", encoding="utf-8") as fh:
        csv.writer(fh).writerows(out)
    return float(np.mean(old)), float(np.mean(new))


def physics(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    f = pyfive.File(str(path))
    t = np.array(f["time"][:], dtype="datetime64[s]").astype("datetime64[D]")
    lat, lon = np.array(f["latitude"][:]), np.array(f["longitude"][:])
    m = _months(t)

    def cell(la: float, lo: float) -> tuple[int, int]:
        return int(np.argmin(abs(lat - la))), int(np.argmin(abs(lon - lo)))

    bottom = np.array(f["bottomT"][:], dtype=float)
    seabed = []
    for label, la, lo in ROUTE_POINTS:
        j, i = cell(la, lo)
        s = bottom[:, j, i]
        seabed.append(
            {
                "label": label,
                "cell": [_r(lat[j], 3), _r(lon[i], 3)],
                "monthly_mean_c": [_r(np.nanmean(s[m == k]), 1) for k in range(12)],
                "monthly_p99_c": [_r(np.nanpercentile(s[m == k], 99), 1) for k in range(12)],
                "max_c": _r(np.nanmax(s), 1),
                "max_date": str(t[int(np.nanargmax(s))]),
            }
        )
    sj, si = cell(55.06, 16.54)
    sst = np.array(f["thetao"][:, 0, sj, si], dtype=float)
    speed = np.hypot(
        np.array(f["uo"][:, 0, sj, si], dtype=float), np.array(f["vo"][:, 0, sj, si], dtype=float)
    )
    conc = np.array(f["siconc"][:, sj, si], dtype=float)
    thick = np.array(f["sithick"][:, sj, si], dtype=float)
    winter = np.array([int(str(d)[:4]) - (int(str(d)[5:7]) < 7) for d in t])
    ice_days = {
        str(w): int((np.nan_to_num(conc[winter == w]) > ICE_CONC).sum())
        for w in range(int(winter.min()) + 1, int(winter.max()))
    }
    summary = {
        "source": f"{PHY_PRODUCT}, daily means, 0.5 m and sea floor",
        "period": [str(t[0]), str(t[-1])],
        "seabed": seabed,
        "sst_monthly_mean_c": [_r(np.nanmean(sst[m == k]), 1) for k in range(12)],
        "current_mean_ms": _r(np.nanmean(speed)),
        "current_p99_ms": _r(np.nanpercentile(speed, 99)),
        "current_max_ms": _r(np.nanmax(speed)),
    }
    ice = {
        "source": f"{PHY_PRODUCT}: model sea ice with assimilation, site cell "
        f"{lat[sj]:.3f} °N {lon[si]:.3f} °E; ice day = concentration > {ICE_CONC:.0%}",
        "ice_days_by_winter": ice_days,
        "max_concentration": _r(np.nanmax(conc)),
        "max_thickness_m": _r(np.nanmax(thick), 2),
    }
    return summary, ice


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    wave_summary, t, hs = waves(Path(sys.argv[1]))
    phy_summary, ice = physics(Path(sys.argv[2]))
    old, new = rewrite_hindcast(t, hs)
    print(f"  hindcast Hs (6-h worst hour, mean): ERA5 {old:.2f} m → CMEMS {new:.2f} m")
    ice_path = LIFECYCLE / "sb510_ice.json"
    pack = json.loads(ice_path.read_text(encoding="utf-8"))
    pack["cmems"] = ice
    ice_path.write_text(json.dumps(pack, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "attribution": ATTRIBUTION,
        "licence": LICENCE,
        "waves": wave_summary,
        "sea": phy_summary,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(
        f"  Hs P99 {wave_summary['hs_p99_m']} m, 50-yr {wave_summary['hs_50yr_m']} m; "
        f"seabed max near landfall {phy_summary['seabed'][-1]['max_c']} °C; "
        f"ice winters {sum(v > 0 for v in ice['ice_days_by_winter'].values())}"
    )
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
