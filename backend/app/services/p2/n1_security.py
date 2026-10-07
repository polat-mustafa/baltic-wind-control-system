"""
N-1 security of the 510 MW export system — which single outage the farm rides
through as it is (preventive security) and which needs a runback (corrective).

For a radial wind farm at zero marginal cost an OPF has nothing to trade: the
answer is "produce what the wind gives". The binding constraints are the N-1
thermal limits, so the useful study is the contingency list below, each solved
as an AC load flow with the automatic controls that act within seconds.

Base case: available power on all 34 WTGs, STATCOM holding OSS 220 kV at
1.0 p.u. (``auto_statcom_dispatch``) — the same operating point as the Grid tab.

Contingencies
-------------
- String feeder trip (6, preventive): the feeder breaker opens, the string's
  cables and turbines go dark. Losing generation only unloads the rest.
- Export circuit trip (corrective): one of the 2 × 220 kV circuits. The
  remaining circuit (~362 MVA) is ~140 % loaded at full output. Protection
  intertrips that circuit's shunt reactor — without it 240 MVAR of reactors
  against 130 MVAR of cable would drag the OSS voltage to ~0.93 p.u.
- One OSS or onshore transformer (corrective): one of 2 × 300 MVA; the other
  unit is ~170 % loaded at full output.

Corrective action = the PPC runs the turbines back until no limit is violated
(bisection on the WTG output). Cables and transformers carry such overloads for
minutes (thermal time constants of hours, see the Cable DTS tab and IEC 60076-7),
so a runback in seconds is acceptable; holding the farm below the post-outage
limit permanently (preventive security) would waste ~1/3 of its output.

Assumptions (not grid-code values): operating voltage band 0.95–1.05 p.u.;
runback rate 2 % Pn/s (10.2 MW/s) — turbine pitch systems can be faster.

References
----------
- Commission Regulation (EU) 2017/1485 (SO GL) — (N-1) criterion,
  contingency list, remedial actions
- F. Capitanescu et al., "State-of-the-art, challenges, and future trends in
  security constrained optimal power flow", Electric Power Systems Research 81
  (2011) 1731–1741 — preventive vs corrective security
"""

from __future__ import annotations

import copy
from collections.abc import Callable
from functools import lru_cache
from typing import Any

import pandapower as pp

from app.services.p2.load_flow import auto_statcom_dispatch
from app.services.p2.network_model import (
    GRID_SSC_MVA,
    SB510,
    FarmSpec,
    build_network,
)

Outage = Callable[[pp.pandapowerNet], None]

V_MIN_PU = 0.95
V_MAX_PU = 1.05
RUNBACK_PU_PER_S = 0.02  # of the farm capacity per second — assumption, see module docstring
RUNBACK_MW_PER_S = RUNBACK_PU_PER_S * SB510.capacity_mw
BISECTION_STEPS = 8  # resolution 1/256 of the output (~2 MW at 510 MW)


def _solve(net: pp.pandapowerNet) -> dict[str, Any] | None:
    """AC load flow with STATCOM re-dispatch → loading, voltages and violations."""
    try:
        auto_statcom_dispatch(net)
    except Exception:
        return None
    if not net.converged:
        return None
    vm = net.res_bus["vm_pu"].drop(index=list(net.ext_grid["bus"])).dropna()
    branches = [
        *zip(net.line["name"], net.res_line["loading_percent"], strict=True),
        *zip(net.trafo["name"], net.res_trafo["loading_percent"], strict=True),
    ]
    name, loading = max(branches, key=lambda b: b[1])
    wtg = net.sgen["name"] != "STATCOM"
    return {
        "limiting_element": str(name),
        "loading_pct": round(float(loading), 1),
        "v_min_pu": round(float(vm.min()), 4),
        "v_max_pu": round(float(vm.max()), 4),
        "output_mw": round(float(net.res_sgen.loc[wtg, "p_mw"].sum()), 1),
        "export_mw": round(float(-net.res_ext_grid["p_mw"].sum()), 1),
        "statcom_q_mvar": round(float(net.res_sgen.loc[~wtg, "q_mvar"].sum()), 1),
        "secure": bool(loading <= 100.0 and vm.min() >= V_MIN_PU and vm.max() <= V_MAX_PU),
    }


def _trip_string(n: int) -> Callable[[pp.pandapowerNet], None]:
    def apply(net: pp.pandapowerNet) -> None:
        net.line.loc[net.line["name"].str.startswith(f"Array_S{n}_"), "in_service"] = False

    return apply


def _trip_export_circuit(net: pp.pandapowerNet) -> None:
    idx = net.line.index[net.line["name"] == "Export_220kV"][0]
    if net.line.at[idx, "parallel"] > 1:
        net.line.at[idx, "parallel"] -= 1
    else:
        net.line.at[idx, "in_service"] = False  # single circuit: the farm loses its export
    if len(net.shunt):
        net.shunt.at[net.shunt.index[0], "in_service"] = False  # reactor intertrip


def _trip_trafo(name: str) -> Callable[[pp.pandapowerNet], None]:
    def apply(net: pp.pandapowerNet) -> None:
        idx = net.trafo.index[net.trafo["name"] == name][0]
        net.trafo.at[idx, "parallel"] -= 1

    return apply


def contingencies(
    spec: FarmSpec = SB510,
) -> list[tuple[str, str, str, Callable[[pp.pandapowerNet], None]]]:
    """Every string (preventive) + export circuit, OSS and onshore transformer (corrective)."""
    return [
        *(
            (f"string_{i + 1}", f"String {i + 1} ({n} WTGs)", "preventive", _trip_string(i + 1))
            for i, n in enumerate(spec.string_layout)
        ),
        ("export_circuit", "Export circuit 1", "corrective", _trip_export_circuit),
        ("oss_trafo", "OSS transformer 1", "corrective", _trip_trafo("Trafo_66_220kV")),
        (
            "onshore_trafo",
            "Onshore transformer 1",
            "corrective",
            _trip_trafo("Trafo_220_400kV"),
        ),
    ]


CONTINGENCIES = contingencies()


def _with_output(base: pp.pandapowerNet, scale: float) -> pp.pandapowerNet:
    net = copy.deepcopy(base)
    wtg = net.sgen["name"] != "STATCOM"
    net.sgen.loc[wtg, "p_mw"] *= scale
    return net


def _contingency(
    base: pp.pandapowerNet,
    cid: str,
    label: str,
    kind: str,
    apply: Outage,
    runback_mw_per_s: float = RUNBACK_MW_PER_S,
) -> dict[str, Any]:
    def solve(scale: float) -> dict[str, Any] | None:
        net = _with_output(base, scale)
        apply(net)
        return _solve(net)

    immediate = solve(1.0)
    final, scale = immediate, 1.0
    if kind == "corrective" and immediate is not None and not immediate["secure"]:
        low, high, final = 0.0, 1.0, solve(0.0)
        if final is not None and final["secure"]:
            for _ in range(BISECTION_STEPS):
                mid = (low + high) / 2.0
                trial = solve(mid)
                if trial is not None and trial["secure"]:
                    low, final = mid, trial
                else:
                    high = mid
        scale = low
    runback = immediate["output_mw"] - final["output_mw"] if immediate and final else 0.0
    return {
        "id": cid,
        "label": label,
        "kind": kind,
        "converged": immediate is not None,
        "immediate": immediate,
        "after_action": final,
        "runback_mw": round(runback, 1),
        "runback_s": round(runback / runback_mw_per_s, 1),
        "secure": bool(final and final["secure"]),
        "output_scale": round(scale, 4),
    }


@lru_cache(maxsize=32)
def run_n1_security(
    generation_fraction: float = 1.0, grid_ssc_mva: float = GRID_SSC_MVA, spec: FarmSpec = SB510
) -> dict[str, Any]:
    """Base case + every contingency of the list (cached: ~1 s per call)."""
    base = build_network(
        generation_fraction=generation_fraction, grid_ssc_mva=grid_ssc_mva, spec=spec
    )
    base_case = _solve(base)
    runback = RUNBACK_PU_PER_S * spec.capacity_mw
    results = [_contingency(base, *c, runback_mw_per_s=runback) for c in contingencies(spec)]
    corrective = [r for r in results if r["kind"] == "corrective" and r["secure"]]
    needs_runback = [r for r in corrective if r["runback_mw"] > 0]
    output = base_case["output_mw"] if base_case else 0.0
    for r in results:
        r["lost_mw"] = round(output - r["immediate"]["output_mw"], 1) if r["immediate"] else 0.0
    return {
        "generation_fraction": generation_fraction,
        "grid_ssc_mva": grid_ssc_mva,
        "base_case": base_case,
        "contingencies": results,
        "n1_secure": all(r["secure"] for r in results),
        # highest output every contingency survives without runback (≥ output if none runs back)
        "firm_output_mw": round(
            min((output - r["runback_mw"] for r in needs_runback), default=output), 1
        ),
        "runback_mw_per_s": runback,
        "voltage_band_pu": [V_MIN_PU, V_MAX_PU],
    }
