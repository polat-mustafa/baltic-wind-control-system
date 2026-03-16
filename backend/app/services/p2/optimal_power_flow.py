"""
Optimal Power Flow (OPF) for 510 MW offshore wind farm network.

Determines the least-cost dispatch of WTGs and STATCOM reactive power
while respecting network constraints (voltage limits, cable thermal
limits, transformer loading). Extends the existing Newton-Raphson load
flow with economic optimization.

Physics — Optimal Power Flow
-----------------------------
OPF minimizes a cost objective subject to power balance and network
constraints:

    min  Σ c_i × P_i                        [total operating cost]
    s.t. P_balance: Σ P_gen - Σ P_load = P_loss (at each bus)
         Q_balance: Σ Q_gen - Σ Q_load = Q_loss (at each bus)
         V_min ≤ V_i ≤ V_max                [voltage limits, 0.95-1.05 pu]
         I_line ≤ I_max                      [cable thermal limits]
         S_trafo ≤ S_max                     [transformer loading]
         P_min ≤ P_i ≤ P_max                [generator bounds]
         Q_min ≤ Q_i ≤ Q_max                [reactive power bounds]

DC OPF linearizes the problem (ignore voltage magnitudes, assume V=1.0),
giving a fast linear program. AC OPF solves the full nonlinear problem
using interior point methods.

Cost Model
----------
For a wind farm, the "cost" represents curtailment cost — the revenue
lost by not generating at available power. The optimizer minimizes
curtailment while respecting grid constraints.

    WTG marginal cost: 0 EUR/MWh (wind is free once built)
    Grid import cost: 72 EUR/MWh (market price)
    Curtailment penalty: 72 EUR/MWh (lost revenue per curtailed MWh)

Standard
--------
- PSE IRiESP: Voltage 0.95-1.05 pu, line loading < 100%
- ENTSO-E NC RfG: Generator reactive power capability
- Pandapower OPP documentation: pp.runopp(), pp.rundcopp()

References
----------
- Pandapower: Optimal Power Flow (OPP) module
- Glover, Sarma, Overbye: Power Systems Analysis & Design (6th ed.)
- MATPOWER: AC/DC OPF formulation reference
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandapower as pp

from app.services.p2.network_model import (
    NUM_TURBINES,
    STATCOM_RATING_MVAR,
    STRING_LAYOUT,
    TOTAL_CAPACITY_MW,
    TURBINE_RATED_MW,
    build_network,
)

# ── OPF Constants ────────────────────────────────────────────────

V_MIN_PU: float = 0.95
V_MAX_PU: float = 1.05
WTG_MARGINAL_COST: float = 0.0  # EUR/MWh — wind is free
GRID_IMPORT_COST: float = 72.0  # EUR/MWh — market price
CURTAILMENT_PENALTY: float = 72.0  # EUR/MWh — lost revenue
WTG_Q_CAPABILITY_FRACTION: float = 0.33  # ±33% of rated MVA


@dataclass(frozen=True)
class GeneratorDispatch:
    """Optimal dispatch for a single generator.

    Attributes
    ----------
    name : str
        Generator name (e.g., "WTG_01", "STATCOM").
    p_mw : float
        Active power dispatch [MW].
    q_mvar : float
        Reactive power dispatch [MVAR].
    p_max_mw : float
        Maximum available active power [MW].
    curtailed_mw : float
        Curtailed active power [MW]. P_max - P_dispatch.
    marginal_cost_eur_mwh : float
        Marginal cost used in optimization [EUR/MWh].
    """

    name: str
    p_mw: float
    q_mvar: float
    p_max_mw: float
    curtailed_mw: float
    marginal_cost_eur_mwh: float


@dataclass(frozen=True)
class OPFResult:
    """Optimal Power Flow result.

    Attributes
    ----------
    converged : bool
        Whether the OPF solver converged.
    method : str
        OPF method used ("dc" or "ac").
    objective_value_eur_h : float
        Objective function value [EUR/hour]. Total cost of dispatch.
    total_generation_mw : float
        Total active power generation after optimization [MW].
    total_curtailment_mw : float
        Total curtailed active power [MW].
    curtailment_percent : float
        Curtailment as fraction of available power [%].
    total_loss_mw : float
        Total network losses [MW].
    v_min_pu : float
        Minimum bus voltage [p.u.].
    v_max_pu : float
        Maximum bus voltage [p.u.].
    voltage_compliant : bool
        All bus voltages within 0.95-1.05 pu.
    max_line_loading_percent : float
        Maximum cable loading [%].
    max_trafo_loading_percent : float
        Maximum transformer loading [%].
    generators : list[GeneratorDispatch]
        Per-generator dispatch results.
    statcom_q_mvar : float
        STATCOM reactive power setpoint [MVAR].
    cost_saving_vs_curtailment_eur_h : float
        Hourly saving compared to full curtailment [EUR/h].
    """

    converged: bool
    method: str
    objective_value_eur_h: float
    total_generation_mw: float
    total_curtailment_mw: float
    curtailment_percent: float
    total_loss_mw: float
    v_min_pu: float
    v_max_pu: float
    voltage_compliant: bool
    max_line_loading_percent: float
    max_trafo_loading_percent: float
    generators: list[GeneratorDispatch] = field(default_factory=list)
    statcom_q_mvar: float = 0.0
    cost_saving_vs_curtailment_eur_h: float = 0.0


def _add_opf_constraints(
    net: pp.pandapowerNet,
    generation_fraction: float = 1.0,
) -> None:
    """Add OPF cost functions and constraints to the network.

    Sets generator bounds (P_min, P_max, Q_min, Q_max) and assigns
    piecewise-linear cost functions for the OPF solver.

    Parameters
    ----------
    net : pp.pandapowerNet
        Network model (modified in-place).
    generation_fraction : float
        Available generation as fraction of rated [0-1].
    """
    p_available = TURBINE_RATED_MW * generation_fraction
    q_capability = TURBINE_RATED_MW * WTG_Q_CAPABILITY_FRACTION

    for idx in range(len(net.sgen)):
        name = str(net.sgen.at[idx, "name"])

        if name == "STATCOM":
            # STATCOM: P=0, Q adjustable
            net.sgen.at[idx, "min_p_mw"] = 0.0
            net.sgen.at[idx, "max_p_mw"] = 0.0
            net.sgen.at[idx, "min_q_mvar"] = -STATCOM_RATING_MVAR
            net.sgen.at[idx, "max_q_mvar"] = STATCOM_RATING_MVAR
            net.sgen.at[idx, "controllable"] = True
            # Zero cost for STATCOM (reactive power only)
            pp.create_poly_cost(net, idx, "sgen", cp1_eur_per_mw=0.0)
        else:
            # WTG: dispatchable between 0 and available power
            net.sgen.at[idx, "min_p_mw"] = 0.0
            net.sgen.at[idx, "max_p_mw"] = p_available
            net.sgen.at[idx, "min_q_mvar"] = -q_capability
            net.sgen.at[idx, "max_q_mvar"] = q_capability
            net.sgen.at[idx, "controllable"] = True
            # Negative cost = reward for generating (minimize curtailment)
            pp.create_poly_cost(
                net, idx, "sgen", cp1_eur_per_mw=-CURTAILMENT_PENALTY,
            )

    # External grid cost (import from PSE grid)
    for idx in range(len(net.ext_grid)):
        pp.create_poly_cost(
            net, idx, "ext_grid", cp1_eur_per_mw=GRID_IMPORT_COST,
        )

    # Set voltage constraints on all buses
    net.bus["min_vm_pu"] = V_MIN_PU
    net.bus["max_vm_pu"] = V_MAX_PU

    # Slack bus (PSE grid): wider limits
    slack_buses = net.ext_grid["bus"].values
    for bus_idx in slack_buses:
        net.bus.at[bus_idx, "min_vm_pu"] = 0.90
        net.bus.at[bus_idx, "max_vm_pu"] = 1.10


def run_dc_opf(
    generation_fraction: float = 1.0,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> OPFResult:
    """Run DC Optimal Power Flow (linearized, fast).

    DC OPF assumes flat voltage profile (V=1.0 pu everywhere) and
    linear power flow equations. Fast for screening and dispatch.

    Parameters
    ----------
    generation_fraction : float
        Available generation fraction [0-1]. Default: 1.0 (full wind).
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.

    Returns
    -------
    OPFResult
        Optimal dispatch, costs, and constraint compliance.
    """
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
    )
    _add_opf_constraints(net, generation_fraction)

    try:
        pp.rundcopp(net)
    except Exception:
        return OPFResult(
            converged=False, method="dc",
            objective_value_eur_h=0.0, total_generation_mw=0.0,
            total_curtailment_mw=0.0, curtailment_percent=0.0,
            total_loss_mw=0.0, v_min_pu=0.0, v_max_pu=0.0,
            voltage_compliant=False,
            max_line_loading_percent=0.0, max_trafo_loading_percent=0.0,
        )

    return _extract_opf_results(net, "dc", generation_fraction)


def run_ac_opf(
    generation_fraction: float = 1.0,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> OPFResult:
    """Run AC Optimal Power Flow (full nonlinear, accurate).

    AC OPF solves the full power balance equations including voltage
    magnitudes and angles. Uses interior point method (PDIPM).

    Parameters
    ----------
    generation_fraction : float
        Available generation fraction [0-1]. Default: 1.0.
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.

    Returns
    -------
    OPFResult
        Optimal dispatch with accurate voltage and loss calculations.
    """
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
    )
    _add_opf_constraints(net, generation_fraction)

    try:
        pp.runopp(net, init="flat", calculate_voltage_angles=True)
    except Exception:
        return OPFResult(
            converged=False, method="ac",
            objective_value_eur_h=0.0, total_generation_mw=0.0,
            total_curtailment_mw=0.0, curtailment_percent=0.0,
            total_loss_mw=0.0, v_min_pu=0.0, v_max_pu=0.0,
            voltage_compliant=False,
            max_line_loading_percent=0.0, max_trafo_loading_percent=0.0,
        )

    return _extract_opf_results(net, "ac", generation_fraction)


def _extract_opf_results(
    net: pp.pandapowerNet,
    method: str,
    generation_fraction: float,
) -> OPFResult:
    """Extract OPF results from a converged Pandapower network.

    Parameters
    ----------
    net : pp.pandapowerNet
        Converged OPF network.
    method : str
        "dc" or "ac".
    generation_fraction : float
        Available generation fraction for curtailment calculation.

    Returns
    -------
    OPFResult
        Complete OPF result.
    """
    p_available = TURBINE_RATED_MW * generation_fraction

    generators: list[GeneratorDispatch] = []
    total_gen = 0.0
    total_curtail = 0.0
    statcom_q = 0.0

    for idx in range(len(net.sgen)):
        name = str(net.sgen.at[idx, "name"])
        p_opt = float(net.res_sgen.at[idx, "p_mw"])
        q_opt = float(net.res_sgen.at[idx, "q_mvar"])

        if name == "STATCOM":
            statcom_q = q_opt
            generators.append(GeneratorDispatch(
                name=name, p_mw=round(p_opt, 3), q_mvar=round(q_opt, 3),
                p_max_mw=0.0, curtailed_mw=0.0, marginal_cost_eur_mwh=0.0,
            ))
        else:
            curtailed = max(0.0, p_available - p_opt)
            total_gen += p_opt
            total_curtail += curtailed
            generators.append(GeneratorDispatch(
                name=name, p_mw=round(p_opt, 3), q_mvar=round(q_opt, 3),
                p_max_mw=round(p_available, 3), curtailed_mw=round(curtailed, 3),
                marginal_cost_eur_mwh=CURTAILMENT_PENALTY,
            ))

    # Network losses
    line_losses = float(net.res_line["pl_mw"].sum()) if len(net.res_line) > 0 else 0.0
    trafo_losses = float(net.res_trafo["pl_mw"].sum()) if len(net.res_trafo) > 0 else 0.0
    total_loss = line_losses + trafo_losses

    # Voltage results (for AC OPF; DC assumes V=1.0)
    if method == "ac" and len(net.res_bus) > 0:
        # Exclude slack bus from compliance check
        slack_buses = set(net.ext_grid["bus"].values)
        non_slack_vm = [
            float(net.res_bus.at[i, "vm_pu"])
            for i in range(len(net.bus))
            if i not in slack_buses
        ]
        v_min = min(non_slack_vm) if non_slack_vm else 1.0
        v_max = max(non_slack_vm) if non_slack_vm else 1.0
    else:
        v_min = 1.0
        v_max = 1.0

    # Loading
    max_line = float(net.res_line["loading_percent"].max()) if len(net.res_line) > 0 else 0.0
    max_trafo = float(net.res_trafo["loading_percent"].max()) if len(net.res_trafo) > 0 else 0.0

    # Objective value
    obj_val = float(net.res_cost) if hasattr(net, "res_cost") else 0.0

    # Curtailment percentage
    total_available = p_available * NUM_TURBINES
    curtail_pct = (total_curtail / total_available * 100.0) if total_available > 0 else 0.0

    # Cost saving: full curtailment cost vs optimal dispatch cost
    full_curtail_cost = total_available * CURTAILMENT_PENALTY
    cost_saving = full_curtail_cost + obj_val  # obj_val is negative (reward)

    return OPFResult(
        converged=True,
        method=method,
        objective_value_eur_h=round(obj_val, 2),
        total_generation_mw=round(total_gen, 2),
        total_curtailment_mw=round(total_curtail, 2),
        curtailment_percent=round(curtail_pct, 2),
        total_loss_mw=round(total_loss, 2),
        v_min_pu=round(v_min, 4),
        v_max_pu=round(v_max, 4),
        voltage_compliant=(v_min >= V_MIN_PU and v_max <= V_MAX_PU),
        max_line_loading_percent=round(max_line, 1),
        max_trafo_loading_percent=round(max_trafo, 1),
        generators=generators,
        statcom_q_mvar=round(statcom_q, 2),
        cost_saving_vs_curtailment_eur_h=round(cost_saving, 2),
    )
