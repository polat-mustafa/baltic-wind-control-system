"""Shortest distance by sea on the region's bathymetry grid.

Ports and wind farms are linked by the shortest path through water: the
bathymetry raster's cells with a depth are sea; a cell the coastline passes
through is land, so narrow spits (Hel, the Vistula Spit) block the path even
where the block-averaged depth is defined. Moves go to the 16 neighbours
(orthogonal, diagonal, knight's moves) with true lengths at the cell's
latitude; a diagonal or knight's move needs the cells it brushes to be sea.
On such a grid the path is at most ≈ 3 % longer than the straight water
route (16-connected metric error), well inside the screening accuracy.

A port is attached to its nearest cell of the open sea (the largest connected
water body; lagoons and harbour pockets cut off on the grid are not); the
straight distance to that cell is added (harbour basins, river mouths and
entrance channels are below the 0.01° grid).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import pairwise

import numpy as np
from numpy.typing import NDArray
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import connected_components, dijkstra

from app.services.site_assessment.geo import EARTH_RADIUS_KM
from app.services.site_assessment.layers import Raster, RegionPack

#: (di, dj) moves of the 16-neighbourhood and the cells each one brushes.
_MOVES: tuple[tuple[int, int, tuple[tuple[int, int], ...]], ...] = (
    (1, 0, ()),
    (0, 1, ()),
    (1, 1, ((1, 0), (0, 1))),
    (1, -1, ((1, 0), (0, -1))),
    (2, 1, ((1, 0), (1, 1))),
    (1, 2, ((0, 1), (1, 1))),
    (2, -1, ((1, 0), (1, -1))),
    (1, -2, ((0, -1), (1, -1))),
)
#: How far a port may lie from open sea on the grid [km].
MAX_SNAP_KM = 15.0


@dataclass(frozen=True)
class SeaGrid:
    raster: Raster
    sea: NDArray[np.bool_]  # (ny, nx) cells of the open sea (largest connected water body)
    graph: csr_matrix
    #: distance fields by start point (lon, lat), filled on first use
    fields: dict[tuple[float, float], NDArray[np.float64]] = field(default_factory=dict)

    def node(self, lon: float, lat: float) -> tuple[int, float] | None:
        """Nearest open-sea cell (flat index) and the straight distance to it [km]."""
        nx = self.sea.shape[1]
        jj, ii = np.nonzero(self.sea)
        lon_c = self.raster.lon0 + ii * self.raster.dlon
        lat_c = self.raster.lat0 + jj * self.raster.dlat
        kx = EARTH_RADIUS_KM * math.cos(math.radians(lat)) * math.pi / 180
        ky = EARTH_RADIUS_KM * math.pi / 180
        d = np.hypot((lon_c - lon) * kx, (lat_c - lat) * ky)
        k = int(np.argmin(d))
        if d[k] > MAX_SNAP_KM:
            return None
        return int(jj[k] * nx + ii[k]), float(d[k])


def _coast_cells(pack: RegionPack, r: Raster, shape: tuple[int, int]) -> NDArray[np.bool_]:
    """Cells a coastline segment passes through (sampled every ¼ cell)."""
    ny, nx = shape
    hit = np.zeros(shape, dtype=bool)
    step = min(r.dlon, r.dlat) / 4
    for layer in pack.by_role("shore"):
        for f in layer.features:
            pts = np.asarray(f.coordinates, dtype=float)
            if pts.ndim != 2 or len(pts) < 2:
                continue
            for (x0, y0), (x1, y1) in pairwise(pts):
                n = max(1, math.ceil(max(abs(x1 - x0), abs(y1 - y0)) / step))
                t = np.linspace(0.0, 1.0, n + 1)
                i = np.rint((x0 + t * (x1 - x0) - r.lon0) / r.dlon).astype(int)
                j = np.rint((y0 + t * (y1 - y0) - r.lat0) / r.dlat).astype(int)
                ok = (i >= 0) & (i < nx) & (j >= 0) & (j < ny)
                hit[j[ok], i[ok]] = True
    return hit


def _build(pack: RegionPack, r: Raster) -> SeaGrid:
    ny, nx = r.values.shape
    sea = np.isfinite(r.values) & ~_coast_cells(pack, r, (ny, nx))
    lat = r.lat0 + r.dlat * np.arange(ny)
    kx = EARTH_RADIUS_KM * np.cos(np.radians(lat)) * math.pi / 180 * r.dlon  # km per cell, per row
    ky = EARTH_RADIUS_KM * math.pi / 180 * r.dlat
    rows: list[NDArray[np.int64]] = []
    cols: list[NDArray[np.int64]] = []
    lengths: list[NDArray[np.float64]] = []
    jj, ii = np.mgrid[0:ny, 0:nx]
    for di, dj, brushed in _MOVES:
        j2, i2 = jj + dj, ii + di
        ok = sea & (j2 >= 0) & (j2 < ny) & (i2 >= 0) & (i2 < nx)
        ok[ok] &= sea[j2[ok], i2[ok]]
        for bi, bj in brushed:
            jb, ib = jj + bj, ii + bi
            inside = (jb >= 0) & (jb < ny) & (ib >= 0) & (ib < nx)
            ok &= inside
            ok[ok] &= sea[jb[ok], ib[ok]]
        a = jj[ok] * nx + ii[ok]
        b = j2[ok] * nx + i2[ok]
        mid_lat_kx = (kx[jj[ok]] + kx[j2[ok]]) / 2
        length = np.hypot(di * mid_lat_kx, dj * ky)
        rows += [a, b]
        cols += [b, a]
        lengths += [length, length]
    graph = csr_matrix(
        (np.concatenate(lengths), (np.concatenate(rows), np.concatenate(cols))),
        shape=(ny * nx, ny * nx),
    )
    _, label = connected_components(graph, directed=False)
    main = np.bincount(label[sea.ravel()]).argmax()
    open_sea = sea & (label.reshape(ny, nx) == main)
    return SeaGrid(r, open_sea, graph)


#: Routing graphs by the layers they are built from (bathymetry raster + coastlines); the
#: cached value holds those objects so their ids stay unique.
#: ponytail: never evicted — a handful of region packs per process.
_GRIDS: dict[tuple[int, ...], tuple[tuple[object, ...], SeaGrid]] = {}


def sea_grid(pack: RegionPack) -> SeaGrid | None:
    """Routing graph of a region pack (None without bathymetry)."""
    layer = next((ly for ly in pack.by_role("bathymetry") if ly.raster is not None), None)
    r = pack.raster("bathymetry")
    if layer is None or r is None:
        return None
    sources: tuple[object, ...] = (layer.raster, *pack.by_role("shore"))
    key = tuple(id(o) for o in sources)
    if key not in _GRIDS:
        _GRIDS[key] = (sources, _build(pack, r))
    return _GRIDS[key][1]


def distance_field(grid: SeaGrid, lon: float, lat: float) -> NDArray[np.float64] | None:
    """Sea distance [km] from a point (a port) to every cell, inf where unreachable."""
    key = (round(lon, 5), round(lat, 5))
    if key not in grid.fields:
        start = grid.node(lon, lat)
        if start is None:
            return None
        node, snap = start
        d = dijkstra(grid.graph, directed=False, indices=node)
        grid.fields[key] = np.asarray(d, dtype=float).reshape(grid.sea.shape) + snap
    return grid.fields[key]


def sea_km(
    pack: RegionPack,
    port: tuple[float, float],
    lon: NDArray[np.float64],
    lat: NDArray[np.float64],
) -> float | None:
    """Shortest sea distance [km] from a port to the nearest of the points (None: no route)."""
    grid = sea_grid(pack)
    km = None if grid is None else distance_field(grid, *port)
    if grid is None or km is None:
        return None
    r = grid.raster
    ny, nx = km.shape
    i = np.rint((np.asarray(lon, dtype=float) - r.lon0) / r.dlon).astype(int)
    j = np.rint((np.asarray(lat, dtype=float) - r.lat0) / r.dlat).astype(int)
    inside = (i >= 0) & (i < nx) & (j >= 0) & (j < ny)
    d = km[j[inside], i[inside]]
    d = d[np.isfinite(d)]
    return float(d.min()) if d.size else None
