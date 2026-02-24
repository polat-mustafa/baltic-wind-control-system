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

Scenarios (PSE IRiESP)
-----------------------
1. Full load (510 MW): Maximum active power export, tests cable thermal limits
2. Partial load (255 MW): Average condition, tests normal operating voltages
3. No load (0 MW): Tests Ferranti voltage rise on export cable
4. N-1 (one string out): Tests redundancy, string 7 (4 WTGs = 60 MW) removed

Voltage Limits (PSE IRiESP / ENTSO-E NC RfG)
----------------------------------------------
All bus voltages must remain within 0.95–1.05 p.u. during normal operation.

References
----------
- Pandapower: pp.runpp() — Newton-Raphson load flow solver
- PSE IRiESP: Polish grid code voltage limits
- ENTSO-E NC RfG Type D: Generator performance requirements
- Glover, Sarma, Overbye: Power Systems Analysis & Design (6th ed.)

Constants (Baltic Wind Alpha)
-----------------------------
- Rated power: 510 MW (34 × 15 MW)
- Voltage limits: 0.95–1.05 p.u.
- STATCOM range: ±120 MVAR
- Convergence tolerance: 1e-8 MVA
"""

from dataclasses import dataclass

import pandapower as pp  # type: ignore[import-untyped]

from app.schemas.grid import (
    BusResult,
    LineResult,
    LoadFlowResponse,
    LoadFlowScenario,
    TransformerResult,
)
from app.services.p2.network_model import (
    STATCOM_RATING_MVAR,
    STRING_LAYOUT,
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
        If not None, disable all WTGs in this string (0-indexed).
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
        disable_string=6,  # String 7 (4 WTGs = 60 MW)
        description="String 7 out of service (N-1 contingency)",
    ),
}


def _apply_n_minus_1(net: pp.pandapowerNet, disable_string: int) -> None:
    """Disable all WTGs and cables in a specific string for N-1 analysis.

    Parameters
    ----------
    net : pp.pandapowerNet
        Network to modify in-place.
    disable_string : int
        0-indexed string number to disable.
    """
    # Calculate WTG range for this string
    start_idx = sum(STRING_LAYOUT[:disable_string])
    end_idx = start_idx + STRING_LAYOUT[disable_string]

    # Disable WTG generators (set P and Q to zero, mark out of service)
    for sgen_idx in range(len(net.sgen)):
        name = str(net.sgen.at[sgen_idx, "name"])
        if name == "STATCOM":
            continue
        # WTG names are WTG_01 to WTG_34
        wtg_num = int(name.split("_")[1])
        if start_idx + 1 <= wtg_num <= end_idx:
            net.sgen.at[sgen_idx, "in_service"] = False


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

    for _ in range(max_iterations):
        pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)

        if not net.converged:
            break

        v_oss = float(net.res_bus.at[oss_bus_idx, "vm_pu"])
        deviation = target_vm_pu - v_oss

        if abs(deviation) <= tolerance_pu:
            break

        # Proportional adjustment: ~50 MVAR per 0.01 pu deviation
        # (empirical gain for this network topology)
        adjustment = deviation * 5000.0
        current_q += adjustment

        # Clamp to STATCOM rating
        current_q = max(-STATCOM_RATING_MVAR, min(STATCOM_RATING_MVAR, current_q))
        net.sgen.at[statcom_idx, "q_mvar"] = current_q

    return current_q


def run_load_flow(
    scenario: LoadFlowScenario,
    auto_dispatch: bool = True,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
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
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.

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
    )

    # Apply N-1 contingency if needed
    if config.disable_string is not None:
        _apply_n_minus_1(net, config.disable_string)

    # Auto-dispatch STATCOM
    if auto_dispatch:
        auto_statcom_dispatch(net)

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
    non_slack_vm = [b.vm_pu for b in buses if "PSE" not in b.name]
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

    return LoadFlowResponse(
        scenario=scenario,
        converged=True,
        v_min_pu=round(v_min, 4),
        v_max_pu=round(v_max, 4),
        total_loss_mw=round(total_loss, 2),
        total_generation_mw=round(total_gen, 2),
        voltage_compliant=voltage_compliant,
        buses=buses,
        lines=lines,
        transformers=transformers,
    )


def _extract_bus_results(net: pp.pandapowerNet) -> list[BusResult]:
    """Extract per-bus results from converged load flow."""
    results = []
    for idx in range(len(net.bus)):
        results.append(
            BusResult(
                name=str(net.bus.at[idx, "name"]),
                vn_kv=float(net.bus.at[idx, "vn_kv"]),
                vm_pu=round(float(net.res_bus.at[idx, "vm_pu"]), 4),
                va_deg=round(float(net.res_bus.at[idx, "va_degree"]), 2),
                p_mw=round(float(net.res_bus.at[idx, "p_mw"]), 2),
                q_mvar=round(float(net.res_bus.at[idx, "q_mvar"]), 2),
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
                loading_percent=round(float(net.res_line.at[idx, "loading_percent"]), 1),
                p_from_mw=round(float(net.res_line.at[idx, "p_from_mw"]), 2),
                q_from_mvar=round(float(net.res_line.at[idx, "q_from_mvar"]), 2),
                pl_mw=round(float(net.res_line.at[idx, "pl_mw"]), 2),
                ql_mvar=round(float(net.res_line.at[idx, "ql_mvar"]), 2),
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
                loading_percent=round(float(net.res_trafo.at[idx, "loading_percent"]), 1),
                p_hv_mw=round(float(net.res_trafo.at[idx, "p_hv_mw"]), 2),
                q_hv_mvar=round(float(net.res_trafo.at[idx, "q_hv_mvar"]), 2),
                pl_mw=round(float(net.res_trafo.at[idx, "pl_mw"]), 2),
                ql_mvar=round(float(net.res_trafo.at[idx, "ql_mvar"]), 2),
            )
        )
    return results


def run_all_scenarios(
    auto_dispatch: bool = True,
) -> list[LoadFlowResponse]:
    """Run load flow for all four standard scenarios.

    Returns
    -------
    list[LoadFlowResponse]
        Results for full_load, partial_load, no_load, and n_minus_1.
    """
    return [run_load_flow(scenario, auto_dispatch=auto_dispatch) for scenario in LoadFlowScenario]
