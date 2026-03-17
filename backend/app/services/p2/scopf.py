"""
Security-Constrained Optimal Power Flow (SCOPF) for 510 MW offshore wind farm.

Extends OPF to ensure the dispatch remains feasible under N-1 contingencies.
For each possible single-element outage (cable string or transformer), the
system must remain within voltage and thermal limits.

Physics — Security-Constrained OPF
------------------------------------
SCOPF solves:

    min  Σ c_i × P_i                        [same objective as OPF]
    s.t. Base case constraints               [normal operation]
         ∀ contingency k:
           V_min ≤ V_i^(k) ≤ V_max          [post-contingency voltage]
           I_line^(k) ≤ I_max               [post-contingency thermal]

The iterative approach:
1. Solve base case OPF
2. For each contingency, run post-contingency load flow
3. Check for constraint violations
4. If violations exist, add preventive constraints and re-solve
5. Repeat until no violations remain or max iterations reached

Contingencies (Baltic Wind Alpha)
----------------------------------
- String outages: 7 strings (S1-S7), each removes 4-5 WTGs (60-75 MW)
- Export cable outage: removes 220 kV link (catastrophic — full curtailment)
- Transformer outage: 66/220 kV or 220/400 kV (full curtailment)

For practical screening, only string outages are included (recoverable N-1).
Cable and transformer outages require full shutdown (non-recoverable N-1).

Standard
--------
- PSE IRiESP: N-1 security criterion for transmission-connected generators
- ENTSO-E SOGL: System operation guideline — N-1 security assessment
- IEC 60909: Short-circuit current for post-contingency analysis

References
----------
- Capitanescu, F. (2011). State-of-the-art for SCOPF. Eur. Trans. Electr. Power.
- Pandapower: contingency analysis documentation
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandapower as pp

from app.services.p2.network_model import (
    STRING_LAYOUT,
    TURBINE_RATED_MW,
    build_network,
)
from app.services.p2.optimal_power_flow import (
    V_MAX_PU,
    V_MIN_PU,
    OPFResult,
    _add_opf_constraints,
    _extract_opf_results,
)

# ── SCOPF Constants ──────────────────────────────────────────────

MAX_SCOPF_ITERATIONS: int = 5
"""Maximum number of SCOPF re-dispatch iterations."""


@dataclass(frozen=True)
class ContingencyViolation:
    """A constraint violation in a post-contingency state.

    Attributes
    ----------
    contingency_name : str
        Name of the contingency (e.g., "String_1_outage").
    violation_type : str
        Type: "voltage_low", "voltage_high", "line_overload", "trafo_overload".
    element_name : str
        Name of the violated element (bus or line name).
    value : float
        Actual value of the violated quantity.
    limit : float
        Limit that was violated.
    severity : float
        Violation magnitude (value - limit for overload, limit - value for undervoltage).
    """

    contingency_name: str
    violation_type: str
    element_name: str
    value: float
    limit: float
    severity: float


@dataclass(frozen=True)
class ContingencyResult:
    """Result of post-contingency analysis for a single contingency.

    Attributes
    ----------
    name : str
        Contingency name.
    description : str
        Human-readable description.
    converged : bool
        Whether post-contingency load flow converged.
    v_min_pu : float
        Minimum bus voltage after contingency [p.u.].
    v_max_pu : float
        Maximum bus voltage after contingency [p.u.].
    max_line_loading_percent : float
        Maximum cable loading after contingency [%].
    max_trafo_loading_percent : float
        Maximum transformer loading after contingency [%].
    violations : list[ContingencyViolation]
        List of constraint violations.
    secure : bool
        True if no violations exist.
    """

    name: str
    description: str
    converged: bool
    v_min_pu: float
    v_max_pu: float
    max_line_loading_percent: float
    max_trafo_loading_percent: float
    violations: list[ContingencyViolation] = field(default_factory=list)
    secure: bool = True


@dataclass(frozen=True)
class SCOPFResult:
    """Security-Constrained OPF result.

    Attributes
    ----------
    base_case : OPFResult
        Base case optimal dispatch.
    contingency_results : list[ContingencyResult]
        Post-contingency analysis for each N-1 scenario.
    n1_secure : bool
        True if all contingencies are secure.
    num_violations : int
        Total number of constraint violations across all contingencies.
    worst_contingency : str
        Name of the contingency with the worst violation.
    iterations : int
        Number of SCOPF iterations performed.
    total_curtailment_for_security_mw : float
        Additional curtailment required for N-1 security [MW].
    """

    base_case: OPFResult
    contingency_results: list[ContingencyResult] = field(default_factory=list)
    n1_secure: bool = True
    num_violations: int = 0
    worst_contingency: str = ""
    iterations: int = 1
    total_curtailment_for_security_mw: float = 0.0


def _apply_string_outage(net: pp.pandapowerNet, string_idx: int) -> str:
    """Disable all WTGs in a specific string for contingency analysis.

    Parameters
    ----------
    net : pp.pandapowerNet
        Network to modify in-place.
    string_idx : int
        0-indexed string number.

    Returns
    -------
    str
        Description of the outage.
    """
    start_idx = sum(STRING_LAYOUT[:string_idx])
    end_idx = start_idx + STRING_LAYOUT[string_idx]
    n_wtgs = STRING_LAYOUT[string_idx]
    mw_lost = n_wtgs * TURBINE_RATED_MW

    for sgen_idx in range(len(net.sgen)):
        name = str(net.sgen.at[sgen_idx, "name"])
        if name == "STATCOM":
            continue
        wtg_num = int(name.split("_")[1])
        if start_idx + 1 <= wtg_num <= end_idx:
            net.sgen.at[sgen_idx, "in_service"] = False

    return f"String {string_idx + 1} outage ({n_wtgs} WTGs, {mw_lost:.0f} MW lost)"


def _check_contingency_violations(
    net: pp.pandapowerNet,
    contingency_name: str,
) -> list[ContingencyViolation]:
    """Check for constraint violations in a post-contingency state.

    Parameters
    ----------
    net : pp.pandapowerNet
        Converged post-contingency network.
    contingency_name : str
        Name of the contingency for reporting.

    Returns
    -------
    list[ContingencyViolation]
        All detected violations.
    """
    violations: list[ContingencyViolation] = []

    # Voltage violations (exclude slack bus)
    slack_buses = set(net.ext_grid["bus"].values)
    for idx in range(len(net.bus)):
        if idx in slack_buses:
            continue
        vm = float(net.res_bus.at[idx, "vm_pu"])
        name = str(net.bus.at[idx, "name"])
        if vm < V_MIN_PU:
            violations.append(
                ContingencyViolation(
                    contingency_name=contingency_name,
                    violation_type="voltage_low",
                    element_name=name,
                    value=round(vm, 4),
                    limit=V_MIN_PU,
                    severity=round(V_MIN_PU - vm, 4),
                )
            )
        if vm > V_MAX_PU:
            violations.append(
                ContingencyViolation(
                    contingency_name=contingency_name,
                    violation_type="voltage_high",
                    element_name=name,
                    value=round(vm, 4),
                    limit=V_MAX_PU,
                    severity=round(vm - V_MAX_PU, 4),
                )
            )

    # Line overload violations
    for idx in range(len(net.line)):
        loading = float(net.res_line.at[idx, "loading_percent"])
        if loading > 100.0:
            name = str(net.line.at[idx, "name"])
            violations.append(
                ContingencyViolation(
                    contingency_name=contingency_name,
                    violation_type="line_overload",
                    element_name=name,
                    value=round(loading, 1),
                    limit=100.0,
                    severity=round(loading - 100.0, 1),
                )
            )

    # Transformer overload violations
    for idx in range(len(net.trafo)):
        loading = float(net.res_trafo.at[idx, "loading_percent"])
        if loading > 100.0:
            name = str(net.trafo.at[idx, "name"])
            violations.append(
                ContingencyViolation(
                    contingency_name=contingency_name,
                    violation_type="trafo_overload",
                    element_name=name,
                    value=round(loading, 1),
                    limit=100.0,
                    severity=round(loading - 100.0, 1),
                )
            )

    return violations


def run_scopf(
    generation_fraction: float = 1.0,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> SCOPFResult:
    """Run Security-Constrained Optimal Power Flow.

    Solves base case AC OPF, then checks all N-1 string contingencies.
    If violations are found, reduces generation and re-solves until
    the dispatch is N-1 secure or maximum iterations are reached.

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
    SCOPFResult
        Base case dispatch + all contingency results + security verdict.
    """
    current_gen_fraction = generation_fraction

    for iteration in range(1, MAX_SCOPF_ITERATIONS + 1):
        # Step 1: Solve base case OPF
        net = build_network(
            export_length_km=export_length_km,
            grid_ssc_mva=grid_ssc_mva,
            generation_fraction=current_gen_fraction,
        )
        _add_opf_constraints(net, current_gen_fraction)

        try:
            pp.runopp(net, init="flat", calculate_voltage_angles=True)
        except Exception:
            return SCOPFResult(
                base_case=OPFResult(
                    converged=False,
                    method="ac",
                    objective_value_eur_h=0.0,
                    total_generation_mw=0.0,
                    total_curtailment_mw=0.0,
                    curtailment_percent=0.0,
                    total_loss_mw=0.0,
                    v_min_pu=0.0,
                    v_max_pu=0.0,
                    voltage_compliant=False,
                    max_line_loading_percent=0.0,
                    max_trafo_loading_percent=0.0,
                ),
                iterations=iteration,
            )

        base_result = _extract_opf_results(net, "ac", current_gen_fraction)

        # Step 2: Check all string contingencies
        contingency_results: list[ContingencyResult] = []
        all_violations: list[ContingencyViolation] = []

        for string_idx in range(len(STRING_LAYOUT)):
            # Build fresh network with base case dispatch
            cont_net = build_network(
                export_length_km=export_length_km,
                grid_ssc_mva=grid_ssc_mva,
                generation_fraction=current_gen_fraction,
            )

            # Apply base case dispatch results to generators
            for sgen_idx in range(len(cont_net.sgen)):
                if sgen_idx < len(net.res_sgen):
                    cont_net.sgen.at[sgen_idx, "p_mw"] = float(net.res_sgen.at[sgen_idx, "p_mw"])
                    cont_net.sgen.at[sgen_idx, "q_mvar"] = float(
                        net.res_sgen.at[sgen_idx, "q_mvar"]
                    )

            # Apply contingency
            cont_name = f"String_{string_idx + 1}_outage"
            description = _apply_string_outage(cont_net, string_idx)

            # Run post-contingency load flow
            try:
                pp.runpp(cont_net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)
            except Exception:
                contingency_results.append(
                    ContingencyResult(
                        name=cont_name,
                        description=description,
                        converged=False,
                        v_min_pu=0.0,
                        v_max_pu=0.0,
                        max_line_loading_percent=0.0,
                        max_trafo_loading_percent=0.0,
                        secure=False,
                    )
                )
                continue

            if not cont_net.converged:
                contingency_results.append(
                    ContingencyResult(
                        name=cont_name,
                        description=description,
                        converged=False,
                        v_min_pu=0.0,
                        v_max_pu=0.0,
                        max_line_loading_percent=0.0,
                        max_trafo_loading_percent=0.0,
                        secure=False,
                    )
                )
                continue

            # Check violations
            violations = _check_contingency_violations(cont_net, cont_name)
            all_violations.extend(violations)

            # Extract results
            slack_buses = set(cont_net.ext_grid["bus"].values)
            non_slack_vm = [
                float(cont_net.res_bus.at[i, "vm_pu"])
                for i in range(len(cont_net.bus))
                if i not in slack_buses
            ]
            v_min = min(non_slack_vm) if non_slack_vm else 1.0
            v_max = max(non_slack_vm) if non_slack_vm else 1.0
            max_line = (
                float(cont_net.res_line["loading_percent"].max())
                if len(cont_net.res_line) > 0
                else 0.0
            )
            max_trafo = (
                float(cont_net.res_trafo["loading_percent"].max())
                if len(cont_net.res_trafo) > 0
                else 0.0
            )

            contingency_results.append(
                ContingencyResult(
                    name=cont_name,
                    description=description,
                    converged=True,
                    v_min_pu=round(v_min, 4),
                    v_max_pu=round(v_max, 4),
                    max_line_loading_percent=round(max_line, 1),
                    max_trafo_loading_percent=round(max_trafo, 1),
                    violations=violations,
                    secure=len(violations) == 0,
                )
            )

        # Step 3: Check if N-1 secure
        if not all_violations:
            # All secure — done
            curtailment_for_security = (
                (generation_fraction - current_gen_fraction) * TURBINE_RATED_MW * len(STRING_LAYOUT)
            )
            return SCOPFResult(
                base_case=base_result,
                contingency_results=contingency_results,
                n1_secure=True,
                num_violations=0,
                worst_contingency="",
                iterations=iteration,
                total_curtailment_for_security_mw=round(max(0.0, curtailment_for_security), 2),
            )

        # Step 4: Reduce generation to address violations (preventive re-dispatch)
        # Simple heuristic: reduce by 5% per iteration
        current_gen_fraction = max(0.1, current_gen_fraction - 0.05)

    # Max iterations reached — return last result with violations
    worst_cont = max(
        contingency_results,
        key=lambda c: sum(v.severity for v in c.violations),
        default=None,
    )

    curtailment_for_security = (
        (generation_fraction - current_gen_fraction) * TURBINE_RATED_MW * len(STRING_LAYOUT)
    )

    return SCOPFResult(
        base_case=base_result,
        contingency_results=contingency_results,
        n1_secure=False,
        num_violations=len(all_violations),
        worst_contingency=worst_cont.name if worst_cont else "",
        iterations=MAX_SCOPF_ITERATIONS,
        total_curtailment_for_security_mw=round(max(0.0, curtailment_for_security), 2),
    )
