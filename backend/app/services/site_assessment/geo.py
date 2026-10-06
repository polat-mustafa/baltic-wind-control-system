"""Small, vectorised planar geometry for site screening.

Coordinates come in as WGS84 (lon, lat) and are projected to a local
equirectangular plane around the region centre:

    x = R · cos(φ0) · (λ − λ0),   y = R · (φ − φ0)      [km]

with R = 6371.0088 km (IUGG mean Earth radius). Using cos(φ0) instead of
cos(φ) scales east-west distances by cos φ / cos φ0: for the Southern
Baltic region (54.45–55.20 °N about 54.83 °N) that is within ±1 %, well
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
    """Inside any polygon; each polygon is [outer ring, hole rings…]."""
    result = np.zeros(np.asarray(px).shape, dtype=bool)
    for rings in polygons:
        inside = points_in_polygon(px, py, rings[0])
        for hole in rings[1:]:
            inside &= ~points_in_polygon(px, py, hole)
        result |= inside
    return result


def distance_to_polyline(px: FloatArray, py: FloatArray, line: FloatArray) -> FloatArray:
    """Shortest distance [km] from each point to a polyline (n ≥ 1 vertices)."""
    px = np.asarray(px, dtype=float)[..., None]
    py = np.asarray(py, dtype=float)[..., None]
    if len(line) == 1:
        return np.asarray(np.hypot(px - line[0, 0], py - line[0, 1])[..., 0], dtype=float)
    ax, ay = line[:-1, 0], line[:-1, 1]
    bx, by = line[1:, 0], line[1:, 1]
    dx, dy = bx - ax, by - ay
    seg_len2 = dx * dx + dy * dy
    with np.errstate(divide="ignore", invalid="ignore"):
        t = ((px - ax) * dx + (py - ay) * dy) / seg_len2
    t = np.where(seg_len2 > 0, np.clip(t, 0.0, 1.0), 0.0)
    cx, cy = ax + t * dx, ay + t * dy
    return np.asarray(np.min(np.hypot(px - cx, py - cy), axis=-1), dtype=float)


def distance_to_lines(px: FloatArray, py: FloatArray, lines: list[FloatArray]) -> FloatArray:
    """Distance [km] to the nearest of several polylines (inf when none)."""
    d = np.full(np.asarray(px).shape, np.inf)
    for line in lines:
        d = np.minimum(d, distance_to_polyline(px, py, line))
    return d


def distance_to_polygons(
    px: FloatArray, py: FloatArray, polygons: list[list[FloatArray]]
) -> FloatArray:
    """Distance [km] to the nearest polygon; 0 inside one (inf when none)."""
    d = np.full(np.asarray(px).shape, np.inf)
    for rings in polygons:
        d = np.minimum(d, distance_to_lines(px, py, rings))
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
