# ruff: noqa: E501, N811
"""Audit A3 — 220 kV export cable at P_max: current profile, thermal margin, lumped-π error.

1. Builds the SB-510 network exactly as the app's load flow does (STATCOM dispatch + reactor
   switching) at 510 MW and reads the export-line results (one pandapower line, nominal π).
2. Re-solves the same cable with the exact long-line (hyperbolic) equations from the OSS-end
   voltage and current, and reports the current along the cable per circuit.
3. Re-runs the load flow with the cable split into 54 × 2 km π sections (converges to the
   distributed line) and compares end currents, reactive power and losses.

Run: cd backend && PYTHONPATH=. python scripts/audit/a3_export_cable.py
"""

from __future__ import annotations

import copy
import logging
import warnings

import numpy as np
import pandapower as pp

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)


def operating_point(sections: int = 1):
    from app.services.p2.load_flow import dispatch_with_reactor_switching
    from app.services.p2.network_model import SB510, build_network

    net = build_network(generation_fraction=1.0, spec=SB510)
    if sections > 1:
        li = net.line.index[net.line.name == "Export_220kV"][0]
        row = copy.deepcopy(net.line.loc[li])
        a, b = int(row.from_bus), int(row.to_bus)
        net.line.drop(li, inplace=True)
        seg = row.length_km / sections
        prev = a
        for k in range(sections):
            nxt = b if k == sections - 1 else pp.create_bus(net, vn_kv=220.0, name=f"EXP_{k + 1}")
            pp.create_line_from_parameters(
                net, prev, nxt, seg, row.r_ohm_per_km, row.x_ohm_per_km, row.c_nf_per_km,
                row.max_i_ka, parallel=int(row.parallel), name=f"Export_220kV_{k + 1}",
            )  # fmt: skip
            prev = nxt
    q, n_on = dispatch_with_reactor_switching(net, SB510.statcom_mvar)
    pp.runpp(net, algorithm="nr", tolerance_mva=1e-8)
    return net, q, n_on


def main() -> None:
    from app.services.p2.network_model import EXPORT_CABLE_1000 as cab

    net, q, n_on = operating_point(1)
    li = net.line.index[net.line.name == "Export_220kV"][0]
    par = int(net.line.at[li, "parallel"])
    r = net.res_line.loc[li]
    print(f"Nominal π, 1 section — STATCOM {q:+.1f} Mvar, reactors in service {n_on}")
    print(f"  onshore end {r.i_from_ka / par * 1e3:.0f} A, OSS end {r.i_to_ka / par * 1e3:.0f} A per circuit "
          f"(rating {cab.max_i_ka * 1e3:.0f} A) → loading {r.loading_percent:.1f} %, loss {r.pl_mw:.2f} MW")  # fmt: skip

    # Exact long-line profile from the OSS end (per circuit)
    to_bus = int(net.line.at[li, "to_bus"])
    v = (
        net.res_bus.at[to_bus, "vm_pu"]
        * 220e3
        / np.sqrt(3)
        * np.exp(1j * np.radians(net.res_bus.at[to_bus, "va_degree"]))
    )
    s_into_line_at_oss = (
        (r.p_to_mw + 1j * r.q_to_mvar) * 1e6 / par
    )  # power entering the line at the OSS end
    i_oss = np.conj(s_into_line_at_oss / 3 / v)  # flows from OSS into the line
    w = 2 * np.pi * 50
    z = net.line.at[li, "r_ohm_per_km"] + 1j * cab.x_ohm_per_km
    y = 1j * w * cab.c_nf_per_km * 1e-9
    g, zc = np.sqrt(z * y), np.sqrt(z / y)
    xs = np.linspace(0, net.line.at[li, "length_km"], 109)
    # travelling from the OSS end towards shore, current flowing towards shore = i_oss at x = 0
    i_x = np.abs(i_oss * np.cosh(g * xs) - v / zc * np.sinh(g * xs))
    print(f"Exact distributed line — |I| per circuit: OSS end {i_x[0]:.0f} A, minimum {i_x.min():.0f} A at "
          f"{xs[i_x.argmin()]:.0f} km, shore end {i_x[-1]:.0f} A, max {i_x.max():.0f} A")  # fmt: skip

    net54, q54, n54 = operating_point(54)
    ex = net54.res_line[net54.line.name.str.startswith("Export_220kV")]
    print(f"54 × 2 km π sections — STATCOM {q54:+.1f} Mvar, reactors {n54}: max loading "
          f"{ex.loading_percent.max():.1f} %, loss {ex.pl_mw.sum():.2f} MW, "
          f"POC P {-net54.res_ext_grid.p_mw.sum():.1f} MW vs {-net.res_ext_grid.p_mw.sum():.1f} MW")  # fmt: skip


if __name__ == "__main__":
    main()
