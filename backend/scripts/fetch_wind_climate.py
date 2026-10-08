"""Build the site wind climate layers of the region pack from real data.

    cd backend && python scripts/fetch_wind_climate.py            # writes the layers
    cd backend && python scripts/fetch_wind_climate.py --dry-run  # prints a summary only

Writes two raster layers into app/services/site_assessment/data/southern_baltic.json
(other layers are kept; scripts/fetch_marine_layers.py keeps these two in turn):

* ``wind_climate`` (role ``wind``), 0.05° grid, hub height 150 m, bands
  ``mean`` [m/s], ``k`` [-], ``A`` [m/s]:
    - mean: NEWA Mesoscale Atlas ``wind_speed_mean`` at 150 m (WRF, 3 km, 1989–2018),
      sampled bilinearly on its LAEA grid (EPSG:3035);
    - k: NEWA Microscale Atlas ``weib_k_combined`` at 100 and 200 m on a 0.5° grid of
      sea points, interpolated to 150 m in ln(z), spread to the 0.05° grid (nearest
      fill, then bilinear);
    - A = mean / Γ(1 + 1/k) (Weibull mean).
  Land cells (NEWA landmask) are null.
  Licence: NEWA is CC BY-NC 4.0 (non-commercial). OffshoreForge is free, open-source
  and non-commercial; a commercial re-user must replace this layer.
  (NEWA's ``wind_speed_std`` is a long-term statistic, not the hourly spread — a
  moment fit with it gives k ≈ 4.5 offshore — so k comes from the microscale atlas.)
* ``wind_rose`` (role ``wind_rose``), 1° grid, bands ``f000``…``f330``: share of
  hours per 30° sector (centre, wind FROM), ERA5 hourly 100 m wind 2020–2024 through
  the Open-Meteo archive API (ERA5: Copernicus C3S, CC BY 4.0; Open-Meteo CC BY 4.0).

If a source cannot be reached the script stops without touching the pack, and the
backend keeps its labelled approximation ("real data not found — closest approximation").
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

PACK = (
    Path(__file__).resolve().parents[1] / "app/services/site_assessment/data/southern_baltic.json"
)
REGION_BBOX = (14.15, 53.85, 19.85, 55.95)  # same box as fetch_marine_layers.py
HUB_HEIGHT_M = 150
GRID_DEG = 0.05
K_GRID_DEG = 0.5
MICRO_PAUSE_S = 1.0
ROSE_GRID_DEG = 1.0
SECTORS = 12
ERA5_YEARS = ("2020-01-01", "2024-12-31")

NEWA = "https://wps.neweuropeanwindatlas.eu/api"
OPEN_METEO = "https://archive-api.open-meteo.com/v1/archive"

FloatArray = NDArray[np.float64]


# ── EPSG:3035 (ETRS89 / LAEA Europe), ellipsoidal forward projection ──────────
# Snyder (1987), Map Projections — A Working Manual, USGS PP 1395, §24.
# Check: EPSG Guidance Note 7-2 example, 50°N 5°E → E 3 962 799.45 m, N 2 999 718.85 m.

_A = 6378137.0
_F = 1 / 298.257222101
_E2 = 2 * _F - _F * _F
_E = math.sqrt(_E2)


def _q(phi: FloatArray) -> FloatArray:
    s = np.sin(phi)
    return (1 - _E2) * (s / (1 - _E2 * s * s) - np.log((1 - _E * s) / (1 + _E * s)) / (2 * _E))


def laea_3035(lon: FloatArray, lat: FloatArray) -> tuple[FloatArray, FloatArray]:
    """WGS84/ETRS89 lon, lat [deg] → EPSG:3035 easting, northing [m]."""
    phi, lam = np.radians(lat), np.radians(lon)
    phi1, lam0 = math.radians(52.0), math.radians(10.0)
    qp = float(_q(np.array(math.pi / 2)))
    beta = np.arcsin(_q(phi) / qp)
    beta1 = math.asin(float(_q(np.array(phi1))) / qp)
    rq = _A * math.sqrt(qp / 2)
    m1 = math.cos(phi1) / math.sqrt(1 - _E2 * math.sin(phi1) ** 2)
    d = _A * m1 / (rq * math.cos(beta1))
    cosd = np.cos(lam - lam0)
    b = rq * np.sqrt(
        2 / (1 + math.sin(beta1) * np.sin(beta) + math.cos(beta1) * np.cos(beta) * cosd)
    )
    x = b * d * np.cos(beta) * np.sin(lam - lam0) + 4321000.0
    y = (b / d) * (
        math.cos(beta1) * np.sin(beta) - math.sin(beta1) * np.cos(beta) * cosd
    ) + 3210000.0
    return x, y


# ── Downloads ─────────────────────────────────────────────────────────────────


CACHE = Path(tempfile.gettempdir()) / "offshoreforge-wind-cache"


def _get(url: str, timeout: int = 300) -> bytes:
    """GET with an on-disk cache (re-runs do not hit the rate-limited services again)."""
    key = hashlib.sha256(url.encode()).hexdigest()
    hit = CACHE / key
    if hit.exists():
        return hit.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "OffshoreForge data script"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data: bytes = resp.read()
    CACHE.mkdir(parents=True, exist_ok=True)
    hit.write_bytes(data)
    return data


def _get_patient(url: str, timeout: int, label: str) -> bytes:
    """_get that waits out HTTP 429 (Retry-After, else 60 s × attempt), 6 tries."""
    import time
    import urllib.error

    for attempt in range(6):
        try:
            return _get(url, timeout)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == 5:
                raise
            wait = float(exc.headers.get("Retry-After") or 60 * (attempt + 1))
            print(f"  {label}: rate-limited, waiting {wait:.0f} s", flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def newa_meso_bbox(variable: str, height: int | None) -> Any:
    """NEWA mesoscale field over the region box as an xarray DataArray (LAEA x, y)."""
    import xarray as xr

    lon0, lat0, lon1, lat1 = REGION_BBOX
    q = {
        "southBoundLatitude": lat0 - 0.1,
        "northBoundLatitude": lat1 + 0.1,
        "westBoundLongitude": lon0 - 0.1,
        "eastBoundLongitude": lon1 + 0.1,
        "variable": variable,
    }
    if height is not None:
        q["height"] = height
    raw = _get(f"{NEWA}/mesoscale-atlas/v1/get-data-bbox?{urllib.parse.urlencode(q)}")
    return xr.open_dataset(io.BytesIO(raw))[variable].squeeze(drop=True)


def _micro_bytes(lon: float, lat: float, variable: str, height: int) -> bytes | None:
    """Download one microscale point; waits out HTTP 429 (Retry-After), 5 tries."""
    import time
    import urllib.error

    q = {"latitude": lat, "longitude": lon, "height": height, "variable": variable}
    url = f"{NEWA}/microscale-atlas/v1/get-data-point?{urllib.parse.urlencode(q)}"
    for attempt in range(5):
        try:
            data = _get(url, 120)
            time.sleep(MICRO_PAUSE_S)  # the service rate-limits bursts
            return data
        except urllib.error.HTTPError as exc:
            wait = float(exc.headers.get("Retry-After") or 30) if exc.code == 429 else 5.0
        except Exception:
            wait = 5.0
        time.sleep(wait * (attempt + 1))
    print(f"  microscale {lat:.2f} N {lon:.2f} E failed after 5 tries", flush=True)
    return None


def newa_micro_points(points: list[tuple[float, float]], variable: str, height: int) -> list[float]:
    """Microscale values at (lon, lat) points, one request at a time."""
    import xarray as xr

    out = []
    for n, (lon, lat) in enumerate(points, 1):
        raw = _micro_bytes(lon, lat, variable, height)
        v = math.nan
        if raw is not None:
            v = float(xr.open_dataset(io.BytesIO(raw))[variable].values.ravel()[0])
        out.append(v if math.isfinite(v) and v > 0 else math.nan)
        if n % 20 == 0:
            print(f"  {variable} {height} m: {n}/{len(points)}", flush=True)
    return out


def era5_roses(points: list[tuple[float, float]]) -> list[FloatArray]:
    """12-sector frequency of the hourly 100 m wind direction, ERA5 via Open-Meteo."""
    out: list[FloatArray] = []
    for i in range(0, len(points), 6):
        batch = points[i : i + 6]
        q = {
            "latitude": ",".join(f"{lat:.3f}" for _, lat in batch),
            "longitude": ",".join(f"{lon:.3f}" for lon, _ in batch),
            "start_date": ERA5_YEARS[0],
            "end_date": ERA5_YEARS[1],
            "hourly": "wind_direction_100m",
            "models": "era5",
        }
        data = json.loads(
            _get_patient(f"{OPEN_METEO}?{urllib.parse.urlencode(q)}", 600, "Open-Meteo")
        )
        for loc in data if isinstance(data, list) else [data]:
            wd = np.array(loc["hourly"]["wind_direction_100m"], dtype=float)
            wd = wd[np.isfinite(wd)]
            sector = ((wd + 180 / SECTORS) % 360 // (360 / SECTORS)).astype(int)
            out.append(np.bincount(sector, minlength=SECTORS) / max(len(wd), 1))
        print(f"  ERA5 roses {len(out)}/{len(points)}")
    return out


#: Interannual variability: 30 full years of ERA5 at the SB-510 site (the southern Baltic
#: varies smoothly; the value is used region-wide by services/p1/aep_calculator.py).
IAV_YEARS = (1995, 2024)
IAV_POINT = (16.54, 55.06)


def era5_iav(lon: float, lat: float, years: tuple[int, int] = IAV_YEARS) -> tuple[float, int]:
    """Interannual variability of the annual mean 100 m wind speed [% of the mean], ERA5."""
    q = {
        "latitude": f"{lat:.3f}",
        "longitude": f"{lon:.3f}",
        "start_date": f"{years[0]}-01-01",
        "end_date": f"{years[1]}-12-31",
        "hourly": "wind_speed_100m",
        "wind_speed_unit": "ms",
        "models": "era5",
    }
    data = json.loads(_get_patient(f"{OPEN_METEO}?{urllib.parse.urlencode(q)}", 900, "Open-Meteo"))
    ws = np.array(data["hourly"]["wind_speed_100m"], dtype=float)
    year = np.array([int(t[:4]) for t in data["hourly"]["time"]])
    means = np.array([np.nanmean(ws[year == y]) for y in range(years[0], years[1] + 1)])
    return float(100 * means.std(ddof=1) / means.mean()), len(means)


# ── Grids ─────────────────────────────────────────────────────────────────────


def _axis(lo: float, hi: float, step: float) -> FloatArray:
    start = math.floor(lo / step) * step
    return np.round(np.arange(start, hi + step / 2, step), 6)


def _fill_nearest(grid: FloatArray) -> FloatArray:
    """Replace NaN by the nearest valid value (index distance)."""
    ok = np.argwhere(np.isfinite(grid))
    if len(ok) == 0:
        raise SystemExit("no valid value to fill from")
    out = grid.copy()
    for j, i in np.argwhere(~np.isfinite(grid)):
        d = (ok[:, 0] - j) ** 2 + (ok[:, 1] - i) ** 2
        jj, ii = ok[int(np.argmin(d))]
        out[j, i] = grid[jj, ii]
    return out


def _bilinear(
    lons: FloatArray, lats: FloatArray, grid: FloatArray, lon: FloatArray, lat: FloatArray
) -> FloatArray:
    from scipy.interpolate import RegularGridInterpolator

    f = RegularGridInterpolator((lats, lons), grid, bounds_error=False, fill_value=None)
    return np.asarray(f(np.column_stack([lat.ravel(), lon.ravel()])).reshape(lon.shape))


def _rows(a: FloatArray, digits: int) -> list[list[float | None]]:
    return [[None if not math.isfinite(v) else round(float(v), digits) for v in row] for row in a]


def build(today: str) -> list[dict[str, Any]]:
    from scipy.special import gamma

    lon0, lat0, lon1, lat1 = REGION_BBOX

    # Mean wind speed at hub height and the land mask (NEWA mesoscale, LAEA grid).
    print("NEWA mesoscale: wind_speed_mean 150 m, landmask")
    mean_da = newa_meso_bbox("wind_speed_mean", HUB_HEIGHT_M)
    land_da = newa_meso_bbox("landmask", None)
    lons, lats = _axis(lon0, lon1, GRID_DEG), _axis(lat0, lat1, GRID_DEG)
    glon, glat = np.meshgrid(lons, lats)
    gx, gy = laea_3035(glon, glat)

    def sample(da: Any, x: FloatArray, y: FloatArray) -> FloatArray:
        import xarray as xr

        xs = xr.DataArray(x.ravel(), dims="p")
        ys = xr.DataArray(y.ravel(), dims="p")
        return np.asarray(da.interp(west_east=xs, south_north=ys).values).reshape(x.shape)

    mean = sample(mean_da, gx, gy)
    land = sample(land_da, gx, gy) >= 0.5

    # Weibull k at 150 m from the microscale atlas (100 and 200 m), sea points only.
    klons, klats = _axis(lon0, lon1, K_GRID_DEG), _axis(lat0, lat1, K_GRID_DEG)
    kx, ky = laea_3035(*np.meshgrid(klons, klats))
    ksea = sample(land_da, kx, ky) < 0.5
    pts = [(float(klons[i]), float(klats[j])) for j, i in np.argwhere(ksea)]
    print(f"NEWA microscale: weib_k_combined at 100 / 200 m, {len(pts)} sea points")
    k100 = newa_micro_points(pts, "weib_k_combined", 100)
    k200 = newa_micro_points(pts, "weib_k_combined", 200)
    kgrid = np.full(ksea.shape, np.nan)
    w = math.log(HUB_HEIGHT_M / 100) / math.log(200 / 100)
    for (lon, lat), a, b in zip(pts, k100, k200, strict=True):
        j = int(np.argmin(np.abs(klats - lat)))
        i = int(np.argmin(np.abs(klons - lon)))
        kgrid[j, i] = a + (b - a) * w
    valid = int(np.isfinite(kgrid).sum())
    print(f"  k valid at {valid}/{len(pts)} sea points")
    if valid < 0.5 * len(pts):
        raise SystemExit("too few microscale k values — pack left unchanged")
    k = _bilinear(klons, klats, _fill_nearest(kgrid), glon, glat)
    a = mean / gamma(1 + 1 / k)
    for arr in (mean, k, a):
        arr[land] = np.nan

    # Wind rose from ERA5.
    rlons, rlats = _axis(lon0, lon1, ROSE_GRID_DEG), _axis(lat0, lat1, ROSE_GRID_DEG)
    rpts = [(float(lon), float(lat)) for lat in rlats for lon in rlons]
    print(
        f"ERA5 (Open-Meteo): 100 m wind direction {ERA5_YEARS[0]}…{ERA5_YEARS[1]}, "
        f"{len(rpts)} points"
    )
    roses = np.array(era5_roses(rpts)).reshape(len(rlats), len(rlons), SECTORS)

    sb = (16.4, 54.8)  # SB-510 centroid, printed as a sanity check
    jj, ii = int(np.argmin(np.abs(lats - sb[1]))), int(np.argmin(np.abs(lons - sb[0])))
    print(
        f"  SB-510: mean {mean[jj, ii]:.2f} m/s, k {k[jj, ii]:.2f}, "
        f"A {a[jj, ii]:.2f} m/s at {HUB_HEIGHT_M} m"
    )

    sea_mean = mean[np.isfinite(mean)]
    if not (7.0 < float(np.median(sea_mean)) < 12.0):
        raise SystemExit("implausible offshore mean wind speed — pack left unchanged")

    wind_layer = {
        "id": "wind_climate",
        "title": f"Wind climate at {HUB_HEIGHT_M} m (mean, Weibull k and A)",
        "role": "wind",
        "geometry": "raster",
        "source": (
            "NEWA Mesoscale Atlas wind_speed_mean 150 m (doi:10.11583/DTU.14414096.v1) and "
            "Microscale Atlas weib_k_combined 100/200 m, ln(z)-interpolated to 150 m; "
            "A = mean / Γ(1 + 1/k)"
        ),
        "license": "CC BY-NC 4.0 (NEWA — non-commercial use; replace for commercial re-use)",
        "retrieved": today,
        "features": [],
        "raster": {
            "lon0": float(lons[0]),
            "lat0": float(lats[0]),
            "dlon": GRID_DEG,
            "dlat": GRID_DEG,
            "height_m": HUB_HEIGHT_M,
            "unit": "mean, A: m/s; k: -",
            "bands": {"mean": _rows(mean, 2), "k": _rows(k, 3), "A": _rows(a, 2)},
        },
    }
    rose_layer = {
        "id": "wind_rose",
        "title": "Wind direction frequency, 12 sectors (100 m)",
        "role": "wind_rose",
        "geometry": "raster",
        "source": (
            f"ERA5 hourly 100 m wind direction {ERA5_YEARS[0][:4]}–{ERA5_YEARS[1][:4]} "
            "(Copernicus C3S) via the Open-Meteo archive API"
        ),
        "license": "CC BY 4.0 (ERA5: Copernicus; Open-Meteo)",
        "retrieved": today,
        "features": [],
        "raster": {
            "lon0": float(rlons[0]),
            "lat0": float(rlats[0]),
            "dlon": ROSE_GRID_DEG,
            "dlat": ROSE_GRID_DEG,
            "unit": "share of hours per sector, wind FROM, sector centre in the band name [deg]",
            "bands": {f"f{s * 30:03d}": _rows(roses[:, :, s], 4) for s in range(SECTORS)},
        },
    }
    return [wind_layer, rose_layer]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--iav", action="store_true", help="print the ERA5 interannual variability (no pack write)"
    )
    args = ap.parse_args()
    if args.iav:
        iav, n = era5_iav(*IAV_POINT)
        print(f"ERA5 100 m annual mean wind, {n} years {IAV_YEARS} at {IAV_POINT}: IAV {iav:.2f} %")
        return
    today = datetime.now(UTC).date().isoformat()
    fresh = build(today)
    for lyr in fresh:
        print(f"  {lyr['id']:<13} {len(json.dumps(lyr)) / 1024:7.1f} KiB")
    if args.dry_run:
        return
    pack = json.loads(PACK.read_text(encoding="utf-8"))
    ids = {lyr["id"] for lyr in fresh}
    pack["layers"] = [lyr for lyr in pack["layers"] if lyr["id"] not in ids] + fresh
    PACK.write_text(
        json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    print(f"wrote {PACK} ({PACK.stat().st_size / 1024:.0f} KiB)")


if __name__ == "__main__":
    sys.exit(main())
