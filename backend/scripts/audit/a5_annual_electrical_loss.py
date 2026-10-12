# ruff: noqa: E501
"""Audit A5 — annual electrical loss from the app's own load flow vs the fixed 2.0 % default.

P1's loss cascade uses DEFAULT_ELECTRICAL_LOSS = 2.0 % (aep_calculator.py), while P2's
load flow gives 10.2 MW (2.0 %) only at 510 MW. This script runs the app's load flow
(``build_network`` + ``dispatch_with_reactor_switching``) at 0…100 % output and weights the
losses with the farm's output distribution: SB-510 Weibull (A 10.80 m/s, k 2.04) through the
IEA 15 MW curve, free stream (wakes would shift weight to lower output → lower loss share).

Also shown: shunt-reactor losses the network leaves out (p_mw = 0). ASSUMPTION: 0.2 % of
rated Mvar per reactor (typical oil-immersed shunt reactor), U² dependence ignored.

Run: cd backend && PYTHONPATH=. python scripts/audit/a5_annual_electrical_loss.py
"""

from __future__ import annotations

import logging
import warnings

import numpy as np
import pandapower as pp

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)
REACTOR_LOSS_PU = 0.002


def main() -> None:
    from app.services.p1.turbine_models import get_turbine
    from app.services.p2.load_flow import dispatch_with_reactor_switching
    from app.services.p2.network_model import SB510, build_network
    from app.services.site_assessment.wind_climate import SB510_WEIBULL_A as A
    from app.services.site_assessment.wind_climate import SB510_WEIBULL_K as K

    fr = np.linspace(0.0, 1.0, 11)
    loss, react = [], []
    for f in fr:
        net = build_network(generation_fraction=float(f))
        dispatch_with_reactor_switching(net, SB510.statcom_mvar)
        pp.runpp(net, algorithm="nr", tolerance_mva=1e-8)
        loss.append(net.res_line.pl_mw.sum() + net.res_trafo.pl_mw.sum())
        on = net.shunt[net.shunt.name.str.startswith("Reactor_") & net.shunt.in_service]
        react.append(REACTOR_LOSS_PU * on.q_mvar.sum())
    loss, react = np.array(loss), np.array(react)

    v = np.arange(0.0, 35.0, 0.01)
    pdf = (K / A) * (v / A) ** (K - 1) * np.exp(-((v / A) ** K))
    frac = get_turbine(None).power_curve_kw(v) / 15_000.0
    w = pdf * 0.01 * 8760.0  # hours per bin
    gen = float(np.sum(w * frac * SB510.capacity_mw))  # MWh/yr, free stream
    l_lf = float(np.sum(w * np.interp(frac, fr, loss)))
    l_re = float(np.sum(w * np.interp(frac, fr, react)))
    for f, a, b in zip(fr, loss, react, strict=True):
        share = f"{100 * a / (f * 510):5.2f} %" if f > 0 else "  n/a  "
        print(f"P = {f * 510:5.0f} MW  load-flow loss {a:6.2f} MW ({share})  reactors {b:4.2f} MW")
    print(f"\nFree-stream gross {gen / 1e3:.0f} GWh/yr, CF {gen / (510 * 8760):.1%}")
    print(
        f"Annual loss, load flow only : {l_lf / 1e3:6.1f} GWh = {100 * l_lf / gen:.2f} % (app default: 2.00 %)"
    )
    print(f"+ shunt-reactor losses      : {l_re / 1e3:6.1f} GWh = {100 * l_re / gen:.2f} %")
    print(
        f"Total                       : {(l_lf + l_re) / 1e3:6.1f} GWh = {100 * (l_lf + l_re) / gen:.2f} %"
    )


if __name__ == "__main__":
    main()
