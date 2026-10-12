# ruff: noqa: N806
"""Audit A2 — OffshoreForge's TurbOPark vs. Ørsted's reference implementation.

Python port of Ørsted's published Matlab code (github.com/OrstedRD/TurbOPark: TurbOPark.m,
CharacteristicWakeWidth.m; A = 0.04, c1 = 1.5, c2 = 0.8, ε = 0.25·√min(β_b, 3), Gaussian
overlap integrated over the downstream rotor, ground image turbines, Katić root-sum-square
superposition on the free-stream speed). Compared on the Horns Rev 1 layout (PyWake data,
V80, 8 m/s, TI 5.6 %) at 270° with the app's ``turbopark_model`` and with measured row data.

Run: cd backend && PYTHONPATH=. python scripts/audit/a2_turbopark_reference.py
"""

from __future__ import annotations

import numpy as np


def wake_width(x_d: np.ndarray, ti0: float, ct: np.ndarray, a: float = 0.04) -> np.ndarray:
    alpha, beta = 1.5 * ti0, 0.8 * ti0 / np.sqrt(ct)
    s = np.sqrt((alpha + beta * x_d) ** 2 + 1)
    return (
        a
        * ti0
        / beta
        * (
            s
            - np.sqrt(1 + alpha**2)
            - np.log((s + 1) * alpha / ((np.sqrt(1 + alpha**2) + 1) * (alpha + beta * x_d)))
        )
    )


def overlap(r_over_sigma: float, radius_over_sigma: float, n: int = 400) -> float:
    """Mean of exp(-r²/2σ²) over a disc of radius R whose centre is r from the wake axis."""
    rr = np.linspace(0, radius_over_sigma, n)[1:]
    th = np.linspace(0, 2 * np.pi, n, endpoint=False)
    R, T = np.meshgrid(rr, th)
    d2 = (R * np.cos(T) + r_over_sigma) ** 2 + (R * np.sin(T)) ** 2
    w = R  # polar area element
    return float((np.exp(-d2 / 2) * w).sum() / w.sum())


def orsted_turbopark(x, y, hub, d, u0, ti0, ct_curve, p_curve, wd=270.0):
    m = np.array(
        [
            [-np.sin(np.radians(wd)), -np.cos(np.radians(wd))],
            [np.cos(np.radians(wd)), -np.sin(np.radians(wd))],
        ]
    )
    xr, yr = m @ np.vstack([x, y])
    order = np.argsort(xr)
    n = len(x)
    u, ct, p = np.full(n, u0), np.zeros(n), np.zeros(n)
    for k, i in enumerate(order):
        deficits = []
        for j in order[:k]:
            xd = (xr[i] - xr[j]) / d
            if xd <= 0:
                continue
            eps = 0.25 * np.sqrt(min(0.5 * (1 + np.sqrt(1 - ct[j])) / np.sqrt(1 - ct[j]), 3))
            sig = d * (eps + wake_width(np.array([xd]), ti0, np.array([ct[j]]))[0])
            c = 1 - np.sqrt(1 - ct[j] / (8 * (sig / d) ** 2))
            for dz in (0.0, 2 * hub):  # real and ground image turbine
                r = np.hypot(yr[i] - yr[j], dz)
                if 4 * sig / 2 + d / 2 > np.hypot(yr[i] - yr[j], 0.0):
                    deficits.append(c * overlap(r / sig, d / 2 / sig))
        dt = np.sqrt(np.sum(np.square(deficits))) if deficits else 0.0
        u[i] = u0 * (1 - min(dt, 1))
        ct[i], p[i] = ct_curve(u[i]), p_curve(u[i])
    return p


def main() -> None:
    import warnings

    warnings.filterwarnings("ignore")
    from py_wake.examples.data.hornsrev1 import HornsrevV80, wt_x, wt_y
    from py_wake.site import UniformSite

    from app.services.p1.wake_model import turbopark_model

    wt = HornsrevV80()
    d, hub = wt.diameter(), wt.hub_height()
    ct_c = lambda u: float(wt.ct(u))  # noqa: E731
    p_c = lambda u: float(wt.power(u))  # noqa: E731
    ref = orsted_turbopark(np.asarray(wt_x), np.asarray(wt_y), hub, d, 8.0, 0.056, ct_c, p_c)
    app = turbopark_model(UniformSite(ti=0.056), wt)(wt_x, wt_y, wd=[270], ws=[8]).Power.values[
        :, 0, 0
    ]
    row = lambda p: (lambda r: r / r[0])(np.asarray(p).reshape(10, 8)[:, 1:7].sum(axis=1))  # noqa: E731
    print("Horns Rev 1, 270°, 8 m/s, inner rows, P_n / P_1")
    print("Ørsted reference port :", np.round(row(ref), 3))
    print("OffshoreForge app     :", np.round(row(app), 3))
    print("max |difference|      :", round(float(np.max(np.abs(row(ref) - row(app)))), 4))


if __name__ == "__main__":
    main()
