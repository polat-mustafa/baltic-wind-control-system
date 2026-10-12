# ruff: noqa: E501
"""Audit A7 — IEC 60909-0 maximum Ik″ by hand vs the app (pandapower), SB-510.

Independent impedance chain referred to each bus (c = 1.10, K_T = 0.95·c/(1 + 0.6·x_T),
network feeder Z_Q = c·U²/S″kQ with R/X 0.1, export cable series Z only — IEC 60909 neglects
line capacitance), plus the converters as current sources k·I_r (k = 1.0 as the app sets).

Run: cd backend && PYTHONPATH=. python scripts/audit/a7_short_circuit_hand_calc.py
"""

from __future__ import annotations

import logging
import math
import warnings

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)


def main() -> None:
    from app.services.p2 import network_model as nm
    from app.services.p2.short_circuit import calc_short_circuit

    c = 1.10
    s_sc = nm.GRID_SSC_MVA

    def zq(u_kv: float) -> complex:
        x = c * u_kv**2 / s_sc / math.sqrt(1 + 0.1**2)
        return complex(0.1 * x, x)

    def ztx(vk: float, vkr: float, s: float, n: int, u_kv: float) -> complex:
        kt = 0.95 * c / (1 + 0.6 * math.sqrt(vk**2 - vkr**2) / 100)
        zabs = vk / 100 * u_kv**2 / s
        r = vkr / 100 * u_kv**2 / s
        return kt * complex(r, math.sqrt(zabs**2 - r**2)) / n

    cab = nm.EXPORT_CABLE_1000
    z_cable_220 = (
        complex(cab.r_ohm_per_km, cab.x_ohm_per_km)
        * nm.EXPORT_CABLE_LENGTH_KM
        / nm.NUM_EXPORT_CABLES
    )
    z400 = zq(400.0)
    z220_ons = zq(220.0) + ztx(
        nm.TRAFO_220_400_VK_PERCENT, nm.TRAFO_220_400_VKR_PERCENT, 300.0, 2, 220.0
    )
    z220_oss = z220_ons + z_cable_220
    z66 = z220_oss * (66 / 220) ** 2 + ztx(
        nm.TRAFO_66_220_VK_PERCENT, nm.TRAFO_66_220_VKR_PERCENT, 300.0, 2, 66.0
    )

    conv_mva = nm.TOTAL_CAPACITY_MW + nm.STATCOM_RATING_MVAR  # k = 1.0 current sources
    app = {b.bus_name: b.ikss_ka for b in calc_short_circuit("max").bus_results}
    print(f"{'bus':16s}{'grid part kA':>14s}{'+ converters kA':>17s}{'app kA':>9s}{'diff %':>8s}")
    for name, u, z in (
        ("PSE_400kV", 400.0, z400),
        ("Onshore_220kV", 220.0, z220_ons),
        ("OSS_220kV", 220.0, z220_oss),
        ("OSS_66kV", 66.0, z66),
    ):
        ik_grid = c * u / (math.sqrt(3) * abs(z))
        ik = ik_grid + conv_mva / (math.sqrt(3) * u)
        print(
            f"{name:16s}{ik_grid:14.2f}{ik:17.2f}{app[name]:9.2f}{100 * (app[name] / ik - 1):8.1f}"
        )
    print(
        "\nConverter currents are added arithmetically (upper bound); pandapower adds them as phasors."
    )


if __name__ == "__main__":
    main()
