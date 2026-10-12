# ruff: noqa: E501
"""Audit A4 — effect of the WTG step-up transformers the P2 network leaves out.

The app's network connects the 34 converters straight to the 66 kV array buses
(``network_model.build_network``; ``p5/energisation.py`` lists "WTG step-up transformers"
as not modelled). This script adds one 66 kV / LV unit per turbine with generic
parameters (ASSUMPTION, typical for a 15 MW unit: 17 MVA, uk 9 %, ukr 0.6 %,
P0 15 kW, i0 0.1 %) and repeats the app's full-load operating point (STATCOM dispatch +
reactor switching), then the IEC 60909 maximum case.

Run: cd backend && PYTHONPATH=. python scripts/audit/a4_wtg_transformers.py
"""

from __future__ import annotations

import logging
import warnings

import pandapower as pp
import pandapower.shortcircuit as sc

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)

TX = dict(sn_mva=17.0, vn_hv_kv=66.0, vn_lv_kv=4.77, vk_percent=9.0, vkr_percent=0.6, pfe_kw=15.0,
          i0_percent=0.1, shift_degree=330.0, vector_group="Dyn11")  # fmt: skip


def network(with_tx: bool):
    from app.services.p2.load_flow import dispatch_with_reactor_switching
    from app.services.p2.network_model import SB510, build_network

    net = build_network(generation_fraction=1.0)
    if with_tx:
        for i in net.sgen.index[net.sgen.name.str.startswith("WTG_")]:
            hv = int(net.sgen.at[i, "bus"])
            lv = pp.create_bus(net, vn_kv=TX["vn_lv_kv"], name=f"{net.sgen.at[i, 'name']}_LV")
            pp.create_transformer_from_parameters(net, hv, lv, **TX)
            net.sgen.at[i, "bus"] = lv
    q, n_on = dispatch_with_reactor_switching(net, SB510.statcom_mvar)
    pp.runpp(net, algorithm="nr", tolerance_mva=1e-8)
    return net, q, n_on


def reactor_choice(with_tx: bool) -> None:
    """Which reactor the operator switches out decides the cable current at P_max."""
    from app.services.p2.load_flow import auto_statcom_dispatch
    from app.services.p2.network_model import build_network

    for out in ("Reactor_ONS_1", "Reactor_OSS_1"):
        net = build_network(generation_fraction=1.0)
        if with_tx:
            for i in net.sgen.index[net.sgen.name.str.startswith("WTG_")]:
                hv = int(net.sgen.at[i, "bus"])
                lv = pp.create_bus(net, vn_kv=TX["vn_lv_kv"])
                pp.create_transformer_from_parameters(net, hv, lv, **TX)
                net.sgen.at[i, "bus"] = lv
        net.shunt.loc[net.shunt.name.str.startswith(out), "in_service"] = False
        q = auto_statcom_dispatch(net, tolerance_pu=0.002)  # OSS 220 kV held at 1.00 ± 0.002 pu
        r = net.res_line[net.line.name == "Export_220kV"].iloc[0]
        print(f"  {out} out: STATCOM {q:+6.1f} Mvar, export {r.loading_percent:5.1f} %, "
              f"OSS end {r.i_to_ka / 2 * 1e3:4.0f} A, shore end {r.i_from_ka / 2 * 1e3:4.0f} A")  # fmt: skip


def main() -> None:
    print(
        f"{'':28s}{'POC P MW':>10s}{'losses MW':>11s}{'STATCOM Mvar':>14s}{'reactors':>9s}{'export %':>9s}{'Ik″ OSS66 kA':>13s}"
    )
    for with_tx in (False, True):
        net, q, n_on = network(with_tx)
        loss = net.res_line.pl_mw.sum() + net.res_trafo.pl_mw.sum()
        exp = net.res_line[net.line.name == "Export_220kV"].loading_percent.iloc[0]
        sc.calc_sc(net, case="max", ip=False)
        ik = net.res_bus_sc.loc[net.bus.index[net.bus.name == "OSS_66kV"][0], "ikss_ka"]
        label = "with WTG transformers" if with_tx else "app model (no WTG trafo)"
        print(
            f"{label:28s}{-net.res_ext_grid.p_mw.sum():10.1f}{loss:11.2f}{q:14.1f}{n_on:9d}{exp:9.1f}{ik:13.2f}"
        )
    for with_tx in (False, True):
        print(
            f"\nReactor switched out at 510 MW ({'with' if with_tx else 'without'} WTG transformers):"
        )
        reactor_choice(with_tx)


if __name__ == "__main__":
    main()
