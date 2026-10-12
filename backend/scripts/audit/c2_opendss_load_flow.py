# ruff: noqa: E501
"""Audit C-2 — the app's SB-510 load flow (pandapower) re-solved in OpenDSS.

The dispatched network of each scenario (``build_network`` + ``dispatch_with_reactor_switching``,
exactly what the Grid tab solves: 72 buses, every array section, the exact-π export
circuits, 34 WTG transformers, both transformer stages with their taps, reactors, filter,
STATCOM and auxiliary load) is converted element by element to OpenDSS (EPRI's
distribution solver, an independent code base) and solved there. Same data, different
solver: bus voltages and the grid exchange must agree.

Conversion (balanced positive sequence, so every transformer is modelled Y-y: the 30°
shifts change angles, not magnitudes or losses):
  ext_grid → Vsource (stiff, as pandapower's slack); line → Line (R1, X1, C1 per km,
  `parallel` copies), its dielectric G → constant-Z loads half at each end; trafo →
  Transformer (XHL, %Rs, %noloadloss, %imag, tap from tap_pos); shunt → constant-Z load;
  sgen → constant-PQ Generator; load → constant-PQ Load.

Needs: pip install opendssdirect.py (0.9.x). Run: cd backend && PYTHONPATH=. python scripts/audit/c2_opendss_load_flow.py
"""

from __future__ import annotations

import logging
import math
import warnings

warnings.filterwarnings("ignore")
logging.disable(logging.WARNING)


def _name(s: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in str(s)).lower()


def to_opendss(net) -> list[str]:
    cmds = ["clear", "set defaultbasefrequency=50"]  # OpenDSS defaults to 60 Hz
    bus = {i: _name(f"b{i}_{net.bus.at[i, 'name']}") for i in net.bus.index}
    kv = net.bus.vn_kv.to_dict()
    eg = net.ext_grid.iloc[0]
    cmds.append(
        f"new circuit.sb510 basekv={kv[eg.bus]} pu={eg.vm_pu} angle={eg.va_degree} "
        f"bus1={bus[eg.bus]} MVAsc3=1e9 MVAsc1=1e9"
    )
    for i, ln in net.line[net.line.in_service].iterrows():
        for k in range(int(ln.parallel)):
            cmds.append(
                f"new line.l{i}_{k} bus1={bus[ln.from_bus]} bus2={bus[ln.to_bus]} phases=3 "
                f"units=km length={ln.length_km} r1={ln.r_ohm_per_km} x1={ln.x_ohm_per_km} "
                f"c1={ln.c_nf_per_km} r0={ln.r_ohm_per_km} x0={ln.x_ohm_per_km} c0={ln.c_nf_per_km}"
            )
            g = float(ln.get("g_us_per_km", 0.0) or 0.0)
            if g > 0:  # dielectric loss: G·L/2 at each end, constant impedance
                for b in (ln.from_bus, ln.to_bus):
                    p_kw = g * 1e-6 * ln.length_km / 2 * (kv[b] * 1e3) ** 2 / 1e3
                    cmds.append(
                        f"new load.g{i}_{k}_{b} bus1={bus[b]} kv={kv[b]} kw={p_kw} kvar=0 model=2 vminpu=0.5 vmaxpu=1.5"
                    )
    for i, t in net.trafo[net.trafo.in_service].iterrows():
        x = math.sqrt(t.vk_percent**2 - t.vkr_percent**2)
        nll = t.pfe_kw / (t.sn_mva * 1e3) * 100
        imag = math.sqrt(max(t.i0_percent**2 - nll**2, 0.0))
        tap = 1.0
        if t.get("tap_side") in ("hv", "lv") and not math.isnan(t.tap_pos):
            tap = 1 + (t.tap_pos - t.tap_neutral) * t.tap_step_percent / 100
        tap_hv, tap_lv = (tap, 1.0) if t.get("tap_side") == "hv" else (1.0, tap)
        for k in range(int(t.parallel)):
            cmds.append(
                f"new transformer.t{i}_{k} phases=3 windings=2 xhl={x} %noloadloss={nll} %imag={imag} "
                f"buses=({bus[t.hv_bus]}, {bus[t.lv_bus]}) conns=(wye, wye) "
                f"kvs=({t.vn_hv_kv}, {t.vn_lv_kv}) kvas=({t.sn_mva * 1e3}, {t.sn_mva * 1e3}) "
                f"%rs=({t.vkr_percent / 2}, {t.vkr_percent / 2}) taps=({tap_hv}, {tap_lv})"
            )
    for i, s in net.shunt[net.shunt.in_service].iterrows():
        # pandapower: q > 0 absorbs, values at vn_kv, scaled by `step`
        cmds.append(
            f"new load.sh{i} bus1={bus[s.bus]} kv={s.vn_kv} kw={s.p_mw * 1e3 * s.step} "
            f"kvar={s.q_mvar * 1e3 * s.step} model=2 vminpu=0.5 vmaxpu=1.5"
        )
    for i, g in net.sgen[net.sgen.in_service].iterrows():
        p, q = g.p_mw * g.scaling, g.q_mvar * g.scaling
        if p >= 0:
            cmds.append(
                f"new generator.g{i} bus1={bus[g.bus]} kv={kv[g.bus]} kw={p * 1e3} kvar={q * 1e3} model=1 vminpu=0.5 vmaxpu=1.5"
            )
        else:  # a consuming sgen (STATCOM losses): load, keeping Q generating-positive
            cmds.append(
                f"new load.sg{i} bus1={bus[g.bus]} kv={kv[g.bus]} kw={-p * 1e3} kvar={-q * 1e3} model=1 vminpu=0.5 vmaxpu=1.5"
            )
    for i, ld in net.load[net.load.in_service].iterrows():
        cmds.append(
            f"new load.ld{i} bus1={bus[ld.bus]} kv={kv[ld.bus]} kw={ld.p_mw * ld.scaling * 1e3} "
            f"kvar={ld.q_mvar * ld.scaling * 1e3} model=1 vminpu=0.5 vmaxpu=1.5"
        )
    cmds += [
        f"set voltagebases=[{', '.join(str(v) for v in sorted(set(kv.values())))}]",
        "calcvoltagebases",
    ]
    cmds += ["set maxiterations=100", "set tolerance=1e-8", "solve"]
    return cmds


def compare(scenario_fraction: float) -> dict[str, float]:
    import opendssdirect as dss
    import pandapower as pp

    from app.services.p2.load_flow import dispatch_with_reactor_switching
    from app.services.p2.network_model import SB510, build_network

    net = build_network(generation_fraction=scenario_fraction)
    dispatch_with_reactor_switching(net, SB510.statcom_mvar)
    pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)
    for c in to_opendss(net):
        dss.Text.Command(c)
    assert dss.Solution.Converged(), "OpenDSS did not converge"
    names = {_name(f"b{i}_{net.bus.at[i, 'name']}"): i for i in net.bus.index}
    worst_dv = 0.0
    for b in dss.Circuit.AllBusNames():
        dss.Circuit.SetActiveBus(b)
        v_pu = dss.Bus.puVmagAngle()[0]
        worst_dv = max(worst_dv, abs(v_pu - net.res_bus.vm_pu.at[names[b]]))
    # OpenDSS TotalPower: kW/kvar the source delivers *into* the circuit, negative when the
    # circuit exports; pandapower's ext_grid result: power the grid supplies (same sign)
    p_dss, q_dss = (-x / 1e3 for x in dss.Circuit.TotalPower())
    p_pp, q_pp = net.res_ext_grid.p_mw.iat[0], net.res_ext_grid.q_mvar.iat[0]
    return {
        "buses": len(net.bus),
        "max_dv_pu": worst_dv,
        "p_grid_pp": p_pp,
        "p_grid_dss": p_dss,
        "q_grid_pp": q_pp,
        "q_grid_dss": q_dss,
    }


def main() -> None:
    print(
        f"{'output':>7s}{'buses':>7s}{'max |ΔV| pu':>13s}{'P_grid pp':>11s}{'P_grid dss':>12s}{'Q_grid pp':>11s}{'Q_grid dss':>12s}"
    )
    for frac in (1.0, 0.5, 0.0):
        r = compare(frac)
        print(
            f"{frac:7.0%}{r['buses']:7d}{r['max_dv_pu']:13.5f}{r['p_grid_pp']:11.2f}{r['p_grid_dss']:12.2f}"
            f"{r['q_grid_pp']:11.2f}{r['q_grid_dss']:12.2f}"
        )


if __name__ == "__main__":
    main()
