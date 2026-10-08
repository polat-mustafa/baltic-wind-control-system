"""
Load flow analysis for 510 MW offshore wind farm network.

Runs Newton-Raphson power flow for four operating scenarios to verify voltage
compliance across the full operating envelope. The STATCOM auto-dispatch
function adjusts reactive power to maintain voltage at the OSS within limits.

Physics — Newton-Raphson Load Flow
-----------------------------------
The Newton-Raphson method solves the power balance equations:
  P_i = V_i × Σ_j V_j × (G_ij × cos(θ_ij) + B_ij × sin(θ_ij))
  Q_i = V_i × Σ_j V_j × (G_ij × sin(θ_ij) - B_ij × cos(θ_ij))

where G_ij + jB_ij are elements of the bus admittance matrix Y_bus.

The Jacobian matrix [∂P/∂θ, ∂P/∂V; ∂Q/∂θ, ∂Q/∂V] is updated each iteration
until the mismatch vector ||ΔP, ΔQ|| < tolerance (typically 1e-8 MVA).

Scenarios
---------
1. Full load (510 MW): maximum export, cable and transformer thermal loading
2. Partial load (255 MW): typical operating point
3. No load (0 MW): cable charging only — the reactors and STATCOM hold the voltage
4. N-1 (array): string 6 (5 WTGs, 75 MW) tripped — feeder breaker open, its
   cables de-energised. Export-cable and transformer N-1 are in the SCOPF.

Voltage band
------------
The platform checks 0.95–1.05 p.u. at every farm bus — a planning band,
tighter than the continuous range NC RfG Table 6.1 allows (0.90–1.118 p.u.
at 110–300 kV, 0.90–1.05 p.u. at 300–400 kV).

References
----------
- Pandapower: pp.runpp() — Newton-Raphson load flow solver
- PSE IRiESP: Polish grid code voltage limits
- ENTSO-E NC RfG Type D: Generator performance requirements
- Glover, Sarma, Overbye: Power Systems Analysis & Design (6th ed.)

Constants (SB-510)
-----------------------------
- Rated power: 510 MW (34 × 15 MW)
- Voltage limits: 0.95–1.05 p.u.
- STATCOM range: ±120 MVAR
- Convergence tolerance: 1e-8 MVA
"""

import math
from dataclasses import dataclass

import pandapower as pp

from app.core.exceptions import DomainError
from app.schemas.grid import (
    BusResult,
    LineResult,
    LiveLoadFlowResponse,
    LoadFlowResponse,
    LoadFlowScenario,
    TransformerResult,
)
from app.services.p2.network_model import (
    SB510,
    STRING_LAYOUT,
    FarmSpec,
    build_network,
)

# PSE IRiESP voltage limits [p.u.]
V_MIN_PU = 0.95
V_MAX_PU = 1.05


@dataclass(frozen=True)
class ScenarioConfig:
    """Configuration for a single load flow scenario.

    Attributes
    ----------
    scenario : LoadFlowScenario
        Scenario enum value.
    generation_fraction : float
        Fraction of rated power [0.0–1.0].
    disable_string : int | None
        If not None, disable all WTGs in this string (0-indexed; −1 = the last).
    description : str
        Human-readable scenario description.
    """

    scenario: LoadFlowScenario
    generation_fraction: float
    disable_string: int | None
    description: str


# Scenario definitions
SCENARIOS: dict[LoadFlowScenario, ScenarioConfig] = {
    LoadFlowScenario.FULL_LOAD: ScenarioConfig(
        scenario=LoadFlowScenario.FULL_LOAD,
        generation_fraction=1.0,
        disable_string=None,
        description="All 34 WTGs at rated power (510 MW)",
    ),
    LoadFlowScenario.PARTIAL_LOAD: ScenarioConfig(
        scenario=LoadFlowScenario.PARTIAL_LOAD,
        generation_fraction=0.5,
        disable_string=None,
        description="50% generation (255 MW)",
    ),
    LoadFlowScenario.NO_LOAD: ScenarioConfig(
        scenario=LoadFlowScenario.NO_LOAD,
        generation_fraction=0.0,
        disable_string=None,
        description="0 MW generation — Ferranti voltage rise test",
    ),
    LoadFlowScenario.N_MINUS_1: ScenarioConfig(
        scenario=LoadFlowScenario.N_MINUS_1,
        generation_fraction=1.0,
        disable_string=-1,  # the last string — SB-510: string 6 (5 WTGs = 75 MW)
        description="Last string out of service (N-1 contingency)",
    ),
}


def _apply_n_minus_1(
    net: pp.pandapowerNet, disable_string: int, layout: tuple[int, ...] | list[int] = STRING_LAYOUT
) -> None:
    """Trip one array string: its WTGs and cables out of service (feeder breaker open).

    Parameters
    ----------
    net : pp.pandapowerNet
        Network to modify in-place.
    disable_string : int
        0-indexed string number to disable (−1 = the last).
    layout : sequence of int
        Turbines per string (default SB-510).
    """
    disable_string %= len(layout)
    # Calculate WTG range for this string
    start_idx = sum(layout[:disable_string])
    end_idx = start_idx + layout[disable_string]

    # Disable WTG generators (set P and Q to zero, mark out of service)
    for sgen_idx in range(len(net.sgen)):
        name = str(net.sgen.at[sgen_idx, "name"])
        if name == "STATCOM":
            continue
        # WTG names are WTG_01 … WTG_nn
        wtg_num = int(name.split("_")[1])
        if start_idx + 1 <= wtg_num <= end_idx:
            net.sgen.at[sgen_idx, "in_service"] = False
    string_lines = net.line["name"].str.startswith(f"Array_S{disable_string + 1}_")
    net.line.loc[string_lines, "in_service"] = False


def auto_statcom_dispatch(
    net: pp.pandapowerNet,
    target_vm_pu: float = 1.0,
    tolerance_pu: float = 0.01,
    max_iterations: int = 10,
) -> float:
    """Adjust STATCOM reactive power to maintain voltage at OSS 220 kV.

    Uses iterative load flow with STATCOM Q adjustment. Each iteration
    runs a load flow and adjusts Q proportionally to voltage deviation.

    Parameters
    ----------
    net : pp.pandapowerNet
        Network with STATCOM sgen element.
    target_vm_pu : float
        Target voltage magnitude at OSS 220 kV [p.u.]. Default: 1.0.
    tolerance_pu : float
        Acceptable voltage deviation [p.u.]. Default: 0.01.
    max_iterations : int
        Maximum STATCOM adjustment iterations.

    Returns
    -------
    float
        Final STATCOM Q setpoint [MVAR]. Positive = generating (Rule 4).
    """
    # Find STATCOM sgen index
    statcom_idx = None
    for idx in range(len(net.sgen)):
        if str(net.sgen.at[idx, "name"]) == "STATCOM":
            statcom_idx = idx
            break

    if statcom_idx is None:
        msg = "STATCOM element not found in network"
        raise ValueError(msg)

    # Find OSS 220 kV bus index
    oss_bus_idx = None
    for idx in range(len(net.bus)):
        if str(net.bus.at[idx, "name"]) == "OSS_220kV":
            oss_bus_idx = idx
            break

    if oss_bus_idx is None:
        msg = "OSS_220kV bus not found in network"
        raise ValueError(msg)

    current_q = float(net.sgen.at[statcom_idx, "q_mvar"])
    rating = float(net.sgen.at[statcom_idx, "sn_mva"])  # ± STATCOM rating of this farm
    # Initial guess for dQ/dV [MVAR/pu]; refined each step by the secant method
    # from the measured response, so the step size adapts to the grid strength
    # (e.g. 2 export cables make the OSS bus stiffer: ~33 MVAR per 0.01 pu).
    dq_dv = 3000.0
    prev: tuple[float, float] | None = None  # (q, v) of the previous iteration

    for _ in range(max_iterations):
        pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)

        if not net.converged:
            break

        v_oss = float(net.res_bus.at[oss_bus_idx, "vm_pu"])
        deviation = target_vm_pu - v_oss

        if abs(deviation) <= tolerance_pu:
            break

        if prev is not None and abs(v_oss - prev[1]) > 1e-6:
            dq_dv = (current_q - prev[0]) / (v_oss - prev[1])
        prev = (current_q, v_oss)

        new_q = current_q + deviation * dq_dv

        # Clamp to STATCOM rating
        new_q = max(-rating, min(rating, new_q))
        if new_q == current_q:
            break  # saturated at the limit — no further correction possible
        current_q = new_q
        net.sgen.at[statcom_idx, "q_mvar"] = current_q
    else:
        # Loop exhausted after a setpoint change: refresh results so they match current_q
        pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)

    return current_q


def run_load_flow(
    scenario: LoadFlowScenario,
    auto_dispatch: bool = True,
    export_length_km: float | None = None,
    grid_ssc_mva: float = 10_000.0,
    spec: FarmSpec = SB510,
) -> LoadFlowResponse:
    """Run load flow analysis for a specified operating scenario.

    Builds the network, optionally adjusts STATCOM Q via auto-dispatch,
    runs Newton-Raphson load flow, and returns comprehensive results.

    Parameters
    ----------
    scenario : LoadFlowScenario
        Operating scenario to analyse.
    auto_dispatch : bool
        If True, auto-adjust STATCOM Q before final load flow. Default: True.
    export_length_km : float | None
        Export cable length [km]; None = the spec's (SB-510: 76.5).
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.
    spec : FarmSpec
        Farm design. Default: SB-510.

    Returns
    -------
    LoadFlowResponse
        Complete load flow results with per-element breakdown.
    """
    config = SCENARIOS[scenario]

    # Build network for this scenario
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=config.generation_fraction,
        spec=spec,
    )

    # Apply N-1 contingency if needed (a one-string farm has no string N-1 case)
    if config.disable_string is not None and len(spec.string_layout) > 1:
        _apply_n_minus_1(net, config.disable_string, spec.string_layout)

    # Auto-dispatch STATCOM (and switch reactors out where it saturates)
    if auto_dispatch:
        dispatch_with_reactor_switching(net, spec.statcom_mvar)

    # Run final load flow
    pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)

    if not net.converged:
        return LoadFlowResponse(
            scenario=scenario,
            converged=False,
            v_min_pu=0.0,
            v_max_pu=0.0,
            total_loss_mw=0.0,
            total_generation_mw=float(net.sgen.p_mw.sum()),
            voltage_compliant=False,
        )

    # Extract results
    buses = _extract_bus_results(net)
    lines = _extract_line_results(net)
    transformers = _extract_transformer_results(net)

    # Non-slack bus voltages for compliance check
    # De-energised buses (vm = 0, e.g. the tripped string) are not voltage violations
    non_slack_vm = [b.vm_pu for b in buses if "PSE" not in b.name and b.vm_pu > 0]
    v_min = min(non_slack_vm) if non_slack_vm else 0.0
    v_max = max(non_slack_vm) if non_slack_vm else 0.0

    # Total losses = sum of line losses + transformer losses
    total_loss = sum(ln.pl_mw for ln in lines) + sum(t.pl_mw for t in transformers)

    # Total generation (WTGs only, exclude STATCOM)
    total_gen = sum(
        float(net.sgen.at[i, "p_mw"])
        for i in range(len(net.sgen))
        if str(net.sgen.at[i, "name"]) != "STATCOM" and bool(net.sgen.at[i, "in_service"])
    )

    voltage_compliant = v_min >= V_MIN_PU and v_max <= V_MAX_PU
    statcom = net.sgen.index[net.sgen["name"] == "STATCOM"][0]

    return LoadFlowResponse(
        scenario=scenario,
        converged=True,
        # ext_grid absorbs the export: delivered = −(grid injection); Rule 4 sign
        poc_p_mw=round(-float(net.res_ext_grid.p_mw.sum()), 2),
        poc_q_mvar=round(-float(net.res_ext_grid.q_mvar.sum()), 2),
        statcom_q_mvar=round(float(net.res_sgen.at[statcom, "q_mvar"]), 1),
        v_min_pu=round(v_min, 4),
        v_max_pu=round(v_max, 4),
        total_loss_mw=round(total_loss, 2),
        total_generation_mw=round(total_gen, 2),
        voltage_compliant=voltage_compliant,
        buses=buses,
        lines=lines,
        transformers=transformers,
    )


def _num(value: object) -> float:
    """pandapower reports de-energised elements as NaN; the API reports 0."""
    x = float(value)  # type: ignore[arg-type]
    return 0.0 if math.isnan(x) else x


def _extract_bus_results(net: pp.pandapowerNet) -> list[BusResult]:
    """Per-bus results. pandapower's res_bus uses the load convention; the API
    reports net injection, generating positive (Rule 4), so the sign is flipped."""
    results = []
    for idx in range(len(net.bus)):
        results.append(
            BusResult(
                name=str(net.bus.at[idx, "name"]),
                vn_kv=float(net.bus.at[idx, "vn_kv"]),
                vm_pu=round(_num(net.res_bus.at[idx, "vm_pu"]), 4),
                va_deg=round(_num(net.res_bus.at[idx, "va_degree"]), 2),
                p_mw=round(-_num(net.res_bus.at[idx, "p_mw"]), 2),
                q_mvar=round(-_num(net.res_bus.at[idx, "q_mvar"]), 2),
            )
        )
    return results


def _extract_line_results(net: pp.pandapowerNet) -> list[LineResult]:
    """Extract per-line/cable results from converged load flow."""
    results = []
    for idx in range(len(net.line)):
        results.append(
            LineResult(
                name=str(net.line.at[idx, "name"]),
                from_bus=str(net.bus.at[int(net.line.at[idx, "from_bus"]), "name"]),
                to_bus=str(net.bus.at[int(net.line.at[idx, "to_bus"]), "name"]),
                loading_percent=round(_num(net.res_line.at[idx, "loading_percent"]), 1),
                p_from_mw=round(_num(net.res_line.at[idx, "p_from_mw"]), 2),
                q_from_mvar=round(_num(net.res_line.at[idx, "q_from_mvar"]), 2),
                pl_mw=round(_num(net.res_line.at[idx, "pl_mw"]), 2),
                ql_mvar=round(_num(net.res_line.at[idx, "ql_mvar"]), 2),
            )
        )
    return results


def _extract_transformer_results(net: pp.pandapowerNet) -> list[TransformerResult]:
    """Extract per-transformer results from converged load flow."""
    results = []
    for idx in range(len(net.trafo)):
        results.append(
            TransformerResult(
                name=str(net.trafo.at[idx, "name"]),
                loading_percent=round(_num(net.res_trafo.at[idx, "loading_percent"]), 1),
                p_hv_mw=round(_num(net.res_trafo.at[idx, "p_hv_mw"]), 2),
                q_hv_mvar=round(_num(net.res_trafo.at[idx, "q_hv_mvar"]), 2),
                pl_mw=round(_num(net.res_trafo.at[idx, "pl_mw"]), 2),
                ql_mvar=round(_num(net.res_trafo.at[idx, "ql_mvar"]), 2),
            )
        )
    return results


def dispatch_with_reactor_switching(net: pp.pandapowerNet, rating: float) -> tuple[float, int]:
    """STATCOM voltage control plus the operator's reactor switching.

    All N+1 reactors start in service (the design case). While the STATCOM
    injects more than half its rating, one reactor is switched out — kept out
    only if that relieves the STATCOM (|Q| falls), as the landing estimate
    does (frontend ``reactiveBalance``). SB-510 (3 × 170 MVAR on 442 MVAR of
    charging) runs on two at full output; so does a long single circuit.
    Every operating-point study uses it: Grid tab, N-1, live map.

    Returns the STATCOM set-point [MVAR, generating +] and the reactors in service.
    """
    reactors = [i for i in net.shunt.index if str(net.shunt.at[i, "name"]).startswith("Reactor_")]
    q = auto_statcom_dispatch(net)
    on = len(reactors)
    while on > 0 and q > 0.5 * rating:
        net.shunt.at[reactors[on - 1], "in_service"] = False
        q_out = auto_statcom_dispatch(net)
        if abs(q_out) >= abs(q):
            net.shunt.at[reactors[on - 1], "in_service"] = True
            q = auto_statcom_dispatch(net)
            break
        on, q = on - 1, q_out
    return q, on


def run_live_load_flow(wtg_p_mw: list[float], spec: FarmSpec = SB510) -> LiveLoadFlowResponse:
    """Load flow for the live operating point of the landing simulation.

    Every WTG sgen gets its own active power (WTG_01 … WTG_n string by string,
    the order of the frontend's live fleet), the STATCOM is auto-dispatched to
    hold the OSS 220 kV bus at 1.0 p.u., then Newton-Raphson is solved. The
    compact result feeds the map's KPI ribbon and the OSS / cable panels, so
    the P-Q-V shown there is pandapower's, not a browser estimate.

    Parameters
    ----------
    wtg_p_mw : list[float]
        One active power per turbine of ``spec`` [MW] (validated 0 … 15 MW by
        the request schema).
    spec : FarmSpec
        The farm (SB-510 or the learner's design).
    """
    if len(wtg_p_mw) != spec.num_turbines:
        raise DomainError(
            f"{spec.name} has {spec.num_turbines} turbines, got {len(wtg_p_mw)} powers.",
            status_code=422,
        )
    net = build_network(generation_fraction=0.0, spec=spec)
    for idx in range(len(net.sgen)):
        name = str(net.sgen.at[idx, "name"])
        if name.startswith("WTG_"):
            net.sgen.at[idx, "p_mw"] = float(wtg_p_mw[int(name[4:]) - 1])
    statcom_q, reactors_on = dispatch_with_reactor_switching(net, spec.statcom_mvar)
    pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)

    total_gen = float(sum(wtg_p_mw))
    if not net.converged:
        return LiveLoadFlowResponse(
            converged=False,
            total_generation_mw=round(total_gen, 2),
            poc_p_mw=0.0,
            poc_q_mvar=0.0,
            total_loss_mw=0.0,
            statcom_q_mvar=round(statcom_q, 1),
            reactors_in_service=reactors_on,
            v_poc_pu=0.0,
            v_onshore_220_pu=0.0,
            v_oss_220_pu=0.0,
            v_oss_66_pu=0.0,
            export_cable_loading_pct=0.0,
            max_array_cable_loading_pct=0.0,
            oss_trafo_loading_pct=0.0,
            onshore_trafo_loading_pct=0.0,
            voltage_compliant=False,
        )

    bus = {str(net.bus.at[i, "name"]): float(net.res_bus.at[i, "vm_pu"]) for i in net.bus.index}
    line_load = {
        str(net.line.at[i, "name"]): float(net.res_line.at[i, "loading_percent"])
        for i in net.line.index
    }
    trafo_load = {
        str(net.trafo.at[i, "name"]): float(net.res_trafo.at[i, "loading_percent"])
        for i in net.trafo.index
    }
    losses = float(net.res_line.pl_mw.sum() + net.res_trafo.pl_mw.sum())
    # ext_grid absorbs the farm's export: its injection is the negative of what we deliver
    poc_p = -float(net.res_ext_grid.p_mw.sum())
    poc_q = -float(net.res_ext_grid.q_mvar.sum())
    non_slack = [v for name, v in bus.items() if "PSE" not in name]

    return LiveLoadFlowResponse(
        converged=True,
        total_generation_mw=round(total_gen, 2),
        poc_p_mw=round(poc_p, 2),
        poc_q_mvar=round(poc_q, 2),
        total_loss_mw=round(losses, 3),
        statcom_q_mvar=round(statcom_q, 1),
        reactors_in_service=reactors_on,
        v_poc_pu=round(bus["PSE_400kV"], 4),
        v_onshore_220_pu=round(bus["Onshore_220kV"], 4),
        v_oss_220_pu=round(bus["OSS_220kV"], 4),
        v_oss_66_pu=round(bus["OSS_66kV"], 4),
        export_cable_loading_pct=round(line_load["Export_220kV"], 1),
        max_array_cable_loading_pct=round(
            max(v for k, v in line_load.items() if k.startswith("Array_")), 1
        ),
        oss_trafo_loading_pct=round(trafo_load["Trafo_66_220kV"], 1),
        onshore_trafo_loading_pct=round(trafo_load["Trafo_220_400kV"], 1),
        voltage_compliant=min(non_slack) >= V_MIN_PU and max(non_slack) <= V_MAX_PU,
    )


def run_all_scenarios(
    auto_dispatch: bool = True,
    spec: FarmSpec = SB510,
) -> list[LoadFlowResponse]:
    """Run load flow for all four standard scenarios.

    Returns
    -------
    list[LoadFlowResponse]
        Results for full_load, partial_load, no_load, and n_minus_1.
    """
    return [
        run_load_flow(scenario, auto_dispatch=auto_dispatch, spec=spec)
        for scenario in LoadFlowScenario
    ]
