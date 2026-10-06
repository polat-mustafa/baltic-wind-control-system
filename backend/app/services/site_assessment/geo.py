"""Small, vectorised planar geometry for site screening.

Coordinates come in as WGS84 (lon, lat) and are projected to a local
equirectangular plane around the region centre:

    x = R · cos(φ0) · (λ − λ0),   y = R · (φ − φ0)      [km]

with R = 6371.0088 km (IUGG mean Earth radius). Using cos(φ0) instead of
cos(φ) scales east-west distances by cos φ / cos φ0: for the Southern
Baltic region (53.85–55.95 °N about 54.9 °N) that is within ±2 %, well
inside the precision of screening criteria. It is not a survey-grade
projection.

All functions take NumPy arrays and return arrays; no GIS dependency.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

EARTH_RADIUS_KM = 6371.0088

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class LocalProjection:
    """Equirectangular projection about (lon0, lat0) [deg] → (x, y) [km]."""

    lon0: float
    lat0: float

    @property
    def kx(self) -> float:
        """km per degree of longitude at lat0."""
        return EARTH_RADIUS_KM * math.cos(math.radians(self.lat0)) * math.pi / 180.0

    @property
    def ky(self) -> float:
        """km per degree of latitude."""
        return EARTH_RADIUS_KM * math.pi / 180.0

    def forward(self, lon: FloatArray, lat: FloatArray) -> tuple[FloatArray, FloatArray]:
        return (np.asarray(lon) - self.lon0) * self.kx, (np.asarray(lat) - self.lat0) * self.ky

    def inverse(self, x: FloatArray, y: FloatArray) -> tuple[FloatArray, FloatArray]:
        return np.asarray(x) / self.kx + self.lon0, np.asarray(y) / self.ky + self.lat0

    def ring(self, coords: list[list[float]]) -> FloatArray:
        """(n, 2) array of projected [x, y] from [[lon, lat], …]."""
        a = np.asarray(coords, dtype=float)
        x, y = self.forward(a[:, 0], a[:, 1])
        return np.column_stack([x, y])


def points_in_polygon(px: FloatArray, py: FloatArray, ring: FloatArray) -> NDArray[np.bool_]:
    """Even-odd (ray casting) test of points against one closed ring.

    Points exactly on an edge may fall either way, which is irrelevant for
    gridded screening.
    """
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    inside = np.zeros(px.shape, dtype=bool)
    xs, ys = ring[:, 0], ring[:, 1]
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi, xj, yj = xs[i], ys[i], xs[j], ys[j]
        crosses = (yi > py) != (yj > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_at = (xj - xi) * (py - yi) / (yj - yi) + xi
        inside ^= crosses & (px < x_at)
        j = i
    return inside


def points_in_polygons(
    px: FloatArray, py: FloatArray, polygons: list[list[FloatArray]]
) -> NDArray[np.bool_]:
    """Inside any polygon; each polygon is [outer ring, hole rings…].

    Only the points inside a polygon's bounding box are tested against it.
    """
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    x, y = px.ravel(), py.ravel()
    result = np.zeros(x.shape, dtype=bool)
    for rings in polygons:
        outer = rings[0]
        (x0, y0), (x1, y1) = outer.min(axis=0), outer.max(axis=0)
        idx = np.nonzero(~result & (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1))[0]
        if idx.size == 0:
            continue
        inside = points_in_polygon(x[idx], y[idx], outer)
        for hole in rings[1:]:
            inside &= ~points_in_polygon(x[idx], y[idx], hole)
        result[idx] |= inside
    return result.reshape(px.shape)


#: Point × segment pairs evaluated at once (bounds the temporary arrays to ≈ 100 MB).
_PAIRS_PER_CHUNK = 2_000_000


def distance_to_polyline(px: FloatArray, py: FloatArray, line: FloatArray) -> FloatArray:
    """Shortest distance [km] from each point to a polyline (n ≥ 1 vertices)."""
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    if len(line) == 1:
        return np.asarray(np.hypot(px - line[0, 0], py - line[0, 1]), dtype=float)
    ax, ay = line[:-1, 0], line[:-1, 1]
    bx, by = line[1:, 0], line[1:, 1]
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    x, y = px.ravel(), py.ravel()
    out = np.empty(x.shape)
    step = max(1, _PAIRS_PER_CHUNK // len(ax))
    for k in range(0, x.size, step):
        cx_, cy_ = x[k : k + step, None], y[k : k + step, None]
        with np.errstate(divide="ignore", invalid="ignore"):
            t = ((cx_ - ax) * dx + (cy_ - ay) * dy) / seg_len2
        t = np.where(seg_len2 > 0, np.clip(t, 0.0, 1.0), 0.0)
        out[k : k + step] = np.min(np.hypot(cx_ - (ax + t * dx), cy_ - (ay + t * dy)), axis=-1)
    return out.reshape(px.shape)


def distance_to_lines(px: FloatArray, py: FloatArray, lines: list[FloatArray]) -> FloatArray:
    """Distance [km] to the nearest of several polylines (inf when none).

    A line is only measured for the points whose distance to its bounding box
    is below their current nearest distance (a cheap lower bound).
    """
    px = np.asarray(px, dtype=float)
    x, y = px.ravel(), np.asarray(py, dtype=float).ravel()
    d = np.full(x.shape, np.inf)
    for line in lines:
        (x0, y0), (x1, y1) = line.min(axis=0), line.max(axis=0)
        lower = np.hypot(
            np.maximum(np.maximum(x0 - x, x - x1), 0.0), np.maximum(np.maximum(y0 - y, y - y1), 0.0)
        )
        idx = np.nonzero(lower < d)[0]
        if idx.size:
            d[idx] = np.minimum(d[idx], distance_to_polyline(x[idx], y[idx], line))
    return d.reshape(px.shape)


def distance_to_polygons(
    px: FloatArray, py: FloatArray, polygons: list[list[FloatArray]]
) -> FloatArray:
    """Distance [km] to the nearest polygon; 0 inside one (inf when none)."""
    # One pass over every ring, so the bounding-box pruning carries across polygons.
    d = distance_to_lines(px, py, [ring for rings in polygons for ring in rings])
    return np.where(points_in_polygons(px, py, polygons), 0.0, d)


def polygon_area_km2(ring: FloatArray) -> float:
    """Shoelace area [km²] of a projected ring (orientation-independent)."""
    x, y = ring[:, 0], ring[:, 1]
    return float(abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))) / 2.0)


def is_simple(ring: FloatArray) -> bool:
    """True when no two non-adjacent edges of the closed ring intersect."""
    pts = ring[:-1] if np.allclose(ring[0], ring[-1]) else ring
    n = len(pts)
    if n < 3:
        return False

    def orient(a: FloatArray, b: FloatArray, c: FloatArray) -> float:
        return float((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))

    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        for j in range(i + 1, n):
            if j == i or (j + 1) % n == i or j == (i + 1) % n:
                continue
            c, d = pts[j], pts[(j + 1) % n]
            o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
            if o1 * o2 < 0 and o3 * o4 < 0:
                return False
    return True
