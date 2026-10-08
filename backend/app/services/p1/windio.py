"""
windIO 2.x export of a saved project (``wind_energy_system`` plant file).

windIO (IEA Wind Task 37 / IEA Wind Systems, https://github.com/IEAWindSystems/windIO,
schemas/plant) is the open exchange format of wind-farm tools (PyWake, FLORIS,
FOXES, WAYVE): site boundary, wind resource, layout and turbine. Everything
windIO has no place for (cost inputs, permit stage, lifecycle campaigns) stays
in the project document, exported next to it as ``<name>.offshoreforge.json``.

Coordinates are metres east / north of the turbines' centroid, the same
equirectangular projection as the layout canvas and the stored turbine
positions; ``crs`` gives it as a PROJ string (eqc with that origin), so a GIS
tool can turn them back into WGS84 exactly.
"""

from __future__ import annotations

import math
from typing import Any

import yaml

from app.schemas.project import ProjectData
from app.services.p1.turbine_models import get_turbine
from app.services.site_assessment.wind_climate import WindClimate

M_PER_DEG = 111_320.0  # as frontend/src/lib/layout/geometry.ts and routers/projects.py
SECTORS = [30.0 * i for i in range(12)]  # wind FROM, sector centres [deg]
TURBULENCE_INTENSITY = 0.06  # ambient TI of the PyWake runs (routers/p1.CustomWakeRequest)


def origin(data: ProjectData) -> tuple[float, float]:
    """Projection origin (lon, lat): turbine centroid, else the site polygon's mean."""
    pts = [(t.lon, t.lat) for t in data.turbines] or list(data.site.polygon or [])
    if not pts:
        raise ValueError("The project has neither turbines nor a site")
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def crs(lon0: float, lat0: float) -> str:
    """PROJ string of x = R(λ−λ0)cos φ0, y = R(φ−φ0) with R = M_PER_DEG·180/π."""
    r = M_PER_DEG * 180.0 / math.pi
    return (
        f"+proj=eqc +lat_ts={lat0:.6f} +lat_0={lat0:.6f} +lon_0={lon0:.6f} "
        f"+R={r:.1f} +units=m +no_defs"
    )


def _xy(points: list[tuple[float, float]], lon0: float, lat0: float, ref: str) -> dict[str, Any]:
    c = math.cos(math.radians(lat0))
    return {
        "x": [round((lon - lon0) * M_PER_DEG * c, 1) for lon, _ in points],
        "y": [round((lat - lat0) * M_PER_DEG, 1) for _, lat in points],
        "crs": ref,
    }


def wind_energy_system(data: ProjectData, wind: WindClimate) -> dict[str, Any]:
    """The project as a windIO 2.x ``wind_energy_system`` mapping (plain lists / floats)."""
    lon0, lat0 = origin(data)
    ref = crs(lon0, lat0)
    model = get_turbine(data.turbine_model)
    freqs = list(wind.frequencies) if wind.frequencies else [1.0 / 12] * 12

    def by_sector(values: list[float]) -> dict[str, Any]:
        return {"data": values, "dims": ["wind_direction"]}

    layout = _xy([(t.lon, t.lat) for t in data.turbines], lon0, lat0, ref)
    if data.site.polygon:
        boundary = _xy(list(data.site.polygon), lon0, lat0, ref)
    else:  # windIO needs a boundary: the layout's bounding box + one rotor diameter
        pad = model.rotor_diameter_m
        x0, x1 = min(layout["x"]) - pad, max(layout["x"]) + pad
        y0, y1 = min(layout["y"]) - pad, max(layout["y"]) + pad
        boundary = {"x": [x0, x1, x1, x0], "y": [y0, y0, y1, y1], "crs": ref}

    site = {
        "name": f"{data.name} site",
        "boundaries": {"polygons": [boundary]},
        "energy_resource": {
            "name": f"{data.name} wind climate at {wind.height_m:.0f} m",
            "wind_resource": {
                "wind_direction": SECTORS,
                "sector_probability": by_sector([round(f, 5) for f in freqs]),
                "weibull_a": by_sector([round(wind.a_ms, 3)] * 12),
                "weibull_k": by_sector([round(wind.k, 3)] * 12),
                "turbulence_intensity": {"dims": [], "data": TURBULENCE_INTENSITY},
            },
        },
    }

    farm: dict[str, Any] = {
        "name": data.name,
        "layouts": [
            {
                "coordinates": layout,
                "turbine_identifiers": [t.id for t in data.turbines],
            }
        ],
        "turbines": {
            "name": model.name,
            "hub_height": model.hub_height_m,
            "rotor_diameter": model.rotor_diameter_m,
            "performance": {
                "rated_power": model.rated_kw * 1000.0,  # W
                "rated_wind_speed": model.rated_ms,
                "cutin_wind_speed": model.cut_in_ms,
                "cutout_wind_speed": model.cut_out_ms,
                "power_curve": {
                    "power_values": [round(float(p) * 1000.0, 1) for p in model.power_kw],  # W
                    "power_wind_speeds": [float(v) for v in model.ws_ms],
                },
                "Ct_curve": {
                    "Ct_values": [round(float(c), 4) for c in model.ct],
                    "Ct_wind_speeds": [float(v) for v in model.ws_ms],
                },
            },
        },
    }
    if data.oss:
        farm["electrical_substations"] = [
            {"electrical_substation": {"coordinates": _xy([data.oss], lon0, lat0, ref)}}
        ]

    return {
        "name": data.name,
        "site": site,
        "wind_farm": farm,
        "attributes": {
            "flow_model": {"name": "PyWake"},
            "analysis": {
                # PyWake NiayifarGaussianDeficit: k* = k_a + k_b·TI = 0.004 + 0.38·TI
                "wind_deficit_model": {
                    "name": "Bastankhah2014",
                    "wake_expansion_coefficient": {
                        "k_a": 0.004,
                        "k_b": 0.38,
                        "free_stream_ti": False,
                    },
                },
                "turbulence_model": {"name": "STF2017"},
                "superposition_model": {"ws_superposition": "Linear"},
            },
        },
    }


def header(data: ProjectData, wind: WindClimate) -> str:
    """YAML comment block: what the file is, where the numbers come from."""
    rose = "site rose" if wind.frequencies else "uniform rose (no site rose in the region pack)"
    return (
        "# windIO 2.x plant file (wind_energy_system), exported by OffshoreForge (training).\n"
        f"# Project: {data.name}. Turbine: {data.turbine_model}. Units: m, m/s, W.\n"
        f"# Wind: Weibull A {wind.a_ms:.2f} m/s, k {wind.k:.2f} at {wind.height_m:.0f} m, {rose};\n"
        f"#   source: {wind.source} ({wind.license}).\n"
        "# Costs, permit stage and lifecycle inputs: the sidecar <name>.offshoreforge.json.\n"
        "# Educational data — re-verify before any real use.\n"
    )


def dump(data: ProjectData, wind: WindClimate) -> str:
    body: str = yaml.safe_dump(
        wind_energy_system(data, wind),
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=None,  # number lists inline: x: [0.0, 1448.1, ...]
        width=100,
    )
    return header(data, wind) + body
