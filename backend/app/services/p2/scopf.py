"""
Security-Constrained Optimal Power Flow (SCOPF) for 510 MW offshore wind farm.

Extends OPF to ensure the dispatch remains feasible under N-1 contingencies.
For each screened single-element outage (array string, export cable circuit),
the system must remain within voltage and thermal limits.

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
2. For each contingency, run the post-contingency load flow INCLUDING automatic
   controls: the STATCOM voltage controller re-dispatches Q (seconds) and
   protection intertrips act. Freezing STATCOM Q at its base value shows
   spurious ~1.051 pu overvoltages and curtails MW for a reactive-power problem.
3. Check for constraint violations
4. Preventive contingencies: if violated, reduce base generation and re-solve.
   Corrective contingencies: find the post-contingency runback that restores limits.
5. Repeat until no preventive violations remain or max iterations reached

Contingencies (Baltic Wind Alpha)
----------------------------------
- String outages (preventive): 6 strings (S1-S6), each removes 5-6 WTGs (75-90 MW)
- Export cable circuit outage (corrective): one of the 2 × 220 kV circuits trips.
  The remaining circuit carries ≈ 362 MVA, so the state right after the trip is
  ~140 % loaded. Preventive security would cap the farm at ~350 MW permanently;
  instead (standard for radial offshore connections) protection intertrips the
  lost cable's shunt reactor and the PPC runs the farm back at the PSE emergency
  ramp (2 % Pn/s ≈ 10.2 MW/s) — seconds, well inside the cable's thermal time
  constant (hours). Without the reactor intertrip, 240 MVAR of reactors against
  130 MVAR of cable Q would drag the OSS voltage down to ~0.93 pu.
- Transformer outage (corrective): one of the 2 × 300 MVA units at the OSS or
  onshore — the remaining unit is ~170 % loaded at 510 MW; the PPC runs back to
  what one 300 MVA unit carries (~300 MW). Transformers tolerate short overloads
  (IEC 60076-7 thermal time constants of hours), so seconds of runback are fine.

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

from collections.abc import Callable
from dataclasses import dataclass, field, replace

import pandapower as pp

from app.services.p2.load_flow import auto_statcom_dispatch
from app.services.p2.network_model import (
    STRING_LAYOUT,
    TOTAL_CAPACITY_MW,
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

EMERGENCY_RAMP_MW_PER_S: float = 0.02 * TOTAL_CAPACITY_MW
"""PSE IRiESP emergency ramp: 2 % Pn/s = 10.2 MW/s (corrective runback time)."""

RUNBACK_BISECTION_STEPS: int = 8
"""Bisection steps for the corrective runback level (resolution 1/256 of dispatch)."""


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
        List of constraint violations (after corrective action, if any).
    secure : bool
        True if no violations exist.
    security_type : str
        "preventive" (base dispatch must survive it) or "corrective"
        (post-contingency runback allowed).
    corrective_action : str
        Automatic/corrective actions applied (empty for preventive).
    corrective_curtailment_mw : float
        Generation reduction of the corrective runback [MW].
    pre_corrective_max_line_loading_percent : float
        Max cable loading after automatic controls, before the runback [%].
    pre_corrective_max_trafo_loading_percent : float
        Max transformer loading after automatic controls, before the runback [%].
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
    security_type: str = "preventive"
    corrective_action: str = ""
    corrective_curtailment_mw: float = 0.0
    pre_corrective_max_line_loading_percent: float = 0.0
    pre_corrective_max_trafo_loading_percent: float = 0.0


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


def _apply_export_cable_outage(net: pp.pandapowerNet) -> str:
    """Trip one export cable circuit and intertrip its shunt reactor.

    The export cables are one pandapower line element with ``parallel=n``;
    losing a circuit reduces ``parallel`` by one. Reactor 1 belongs to export
    cable 1 and trips with it (reactor 3 is the N+1 spare).

    Returns
    -------
    str
        Description of the outage.
    """
    export_idx = net.line.index[net.line["name"] == "Export_220kV"][0]
    circuits = int(net.line.at[export_idx, "parallel"])
    net.line.at[export_idx, "parallel"] = circuits - 1
    if len(net.shunt):
        net.shunt.at[net.shunt.index[0], "in_service"] = False
    return f"Export cable circuit 1 of {circuits} outage (reactor 1 intertripped)"


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

        # Step 2: Check all string contingencies (preventive)
        dispatch = _base_dispatch(net)
        contingency_results: list[ContingencyResult] = []
        all_violations: list[ContingencyViolation] = []

        for string_idx in range(len(STRING_LAYOUT)):
            cont_name = f"String_{string_idx + 1}_outage"
            cont_net = _base_network(export_length_km, grid_ssc_mva, current_gen_fraction, dispatch)
            description = _apply_string_outage(cont_net, string_idx)
            result = _post_contingency(cont_net, cont_name, description)
            all_violations.extend(result.violations)
            contingency_results.append(result)

        # Step 3: Preventive contingencies secure → add the corrective export cable case
        if not all_violations:
            curtailment_for_security = (
                generation_fraction - current_gen_fraction
            ) * TOTAL_CAPACITY_MW
            corrective = _corrective_contingencies(
                export_length_km, grid_ssc_mva, current_gen_fraction, dispatch
            )
            contingency_results.extend(corrective)
            insecure = [c.name for c in corrective if not c.secure]
            return SCOPFResult(
                base_case=base_result,
                contingency_results=contingency_results,
                n1_secure=not insecure,
                num_violations=sum(len(c.violations) for c in corrective),
                worst_contingency=insecure[0] if insecure else "",
                iterations=iteration,
                total_curtailment_for_security_mw=round(max(0.0, curtailment_for_security), 2),
            )

        # Step 4: Reduce generation to address violations (preventive re-dispatch)
        # Simple heuristic: reduce by 5% per iteration (not after the last check)
        if iteration < MAX_SCOPF_ITERATIONS:
            current_gen_fraction = max(0.1, current_gen_fraction - 0.05)

    # Max iterations reached — return last result with violations
    worst_cont = max(
        contingency_results,
        key=lambda c: sum(v.severity for v in c.violations),
        default=None,
    )

    curtailment_for_security = (generation_fraction - current_gen_fraction) * TOTAL_CAPACITY_MW
    corrective = _corrective_contingencies(
        export_length_km, grid_ssc_mva, current_gen_fraction, dispatch
    )
    contingency_results.extend(corrective)

    return SCOPFResult(
        base_case=base_result,
        contingency_results=contingency_results,
        n1_secure=False,
        num_violations=len(all_violations) + sum(len(c.violations) for c in corrective),
        worst_contingency=worst_cont.name if worst_cont else "",
        iterations=MAX_SCOPF_ITERATIONS,
        total_curtailment_for_security_mw=round(max(0.0, curtailment_for_security), 2),
    )


def _base_dispatch(net: pp.pandapowerNet) -> list[tuple[float, float]]:
    """(P, Q) of every sgen from the solved base-case OPF."""
    return [
        (float(net.res_sgen.at[i, "p_mw"]), float(net.res_sgen.at[i, "q_mvar"]))
        for i in net.sgen.index
    ]


def _base_network(
    export_length_km: float,
    grid_ssc_mva: float,
    generation_fraction: float,
    dispatch: list[tuple[float, float]],
    wtg_scale: float = 1.0,
) -> pp.pandapowerNet:
    """Fresh network carrying the base-case dispatch (WTG P scaled by ``wtg_scale``)."""
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
    )
    for i, (p_mw, q_mvar) in zip(net.sgen.index, dispatch, strict=True):
        is_statcom = str(net.sgen.at[i, "name"]) == "STATCOM"
        net.sgen.at[i, "p_mw"] = p_mw if is_statcom else p_mw * wtg_scale
        net.sgen.at[i, "q_mvar"] = q_mvar
    return net


def _post_contingency(
    net: pp.pandapowerNet,
    name: str,
    description: str,
) -> ContingencyResult:
    """Solve the post-contingency state with STATCOM voltage control and check limits."""
    try:
        auto_statcom_dispatch(net)
        converged = bool(net.converged)
    except Exception:
        converged = False
    if not converged:
        return ContingencyResult(
            name=name,
            description=description,
            converged=False,
            v_min_pu=0.0,
            v_max_pu=0.0,
            max_line_loading_percent=0.0,
            max_trafo_loading_percent=0.0,
            secure=False,
        )

    violations = _check_contingency_violations(net, name)
    non_slack_vm = net.res_bus["vm_pu"].drop(index=list(net.ext_grid["bus"].values))
    return ContingencyResult(
        name=name,
        description=description,
        converged=True,
        v_min_pu=round(float(non_slack_vm.min()), 4),
        v_max_pu=round(float(non_slack_vm.max()), 4),
        max_line_loading_percent=round(float(net.res_line["loading_percent"].max()), 1),
        max_trafo_loading_percent=round(float(net.res_trafo["loading_percent"].max()), 1),
        violations=violations,
        secure=len(violations) == 0,
    )


def _corrective_contingency(
    name: str,
    apply_outage: Callable[[pp.pandapowerNet], str],
    automatic_action: str,
    export_length_km: float,
    grid_ssc_mva: float,
    generation_fraction: float,
    dispatch: list[tuple[float, float]],
) -> ContingencyResult:
    """Corrective N-1: apply the outage, then PPC runback until limits hold.

    Bisection on the WTG output scale k ∈ [0, 1] for the highest output whose
    post-contingency state (automatic actions + STATCOM re-dispatch) has no
    violations.
    """

    def solve(scale: float) -> ContingencyResult:
        net = _base_network(export_length_km, grid_ssc_mva, generation_fraction, dispatch, scale)
        description = apply_outage(net)
        return _post_contingency(net, name, description)

    immediate = solve(1.0)
    scale, final = 1.0, immediate
    if not immediate.secure:
        scale, final = 0.0, solve(0.0)
        if final.secure:
            low, high = 0.0, 1.0
            for _ in range(RUNBACK_BISECTION_STEPS):
                mid = (low + high) / 2.0
                result = solve(mid)
                if result.secure:
                    low, final = mid, result
                else:
                    high = mid
            scale = low

    wtg_mw = sum(p for p, _ in dispatch)  # STATCOM P is 0
    curtailment_mw = wtg_mw * (1.0 - scale) if final.secure else 0.0
    action = automatic_action
    if curtailment_mw > 0.0:
        runback_s = curtailment_mw / EMERGENCY_RAMP_MW_PER_S
        action += (
            f" + PPC emergency runback {wtg_mw:.0f} → {wtg_mw * scale:.0f} MW"
            f" (~{runback_s:.0f} s at 2 % Pn/s)"
        )
    return replace(
        final,
        description=immediate.description,
        security_type="corrective",
        corrective_action=action,
        corrective_curtailment_mw=round(curtailment_mw, 1),
        pre_corrective_max_line_loading_percent=immediate.max_line_loading_percent,
        pre_corrective_max_trafo_loading_percent=immediate.max_trafo_loading_percent,
    )


def _apply_transformer_outage(trafo_name: str) -> Callable[[pp.pandapowerNet], str]:
    """Outage of one unit of a parallel transformer element (``parallel`` − 1)."""

    def apply(net: pp.pandapowerNet) -> str:
        idx = net.trafo.index[net.trafo["name"] == trafo_name][0]
        units = int(net.trafo.at[idx, "parallel"])
        net.trafo.at[idx, "parallel"] = units - 1
        mva = float(net.trafo.at[idx, "sn_mva"])
        return f"{trafo_name}: unit 1 of {units} × {mva:.0f} MVA outage"

    return apply


def _corrective_contingencies(
    export_length_km: float,
    grid_ssc_mva: float,
    generation_fraction: float,
    dispatch: list[tuple[float, float]],
) -> list[ContingencyResult]:
    """Loss of one export circuit, one OSS transformer, one onshore transformer."""
    args = (export_length_km, grid_ssc_mva, generation_fraction, dispatch)
    return [
        _corrective_contingency(
            "Export_cable_1_outage",
            _apply_export_cable_outage,
            "Reactor 1 intertrip + STATCOM voltage control",
            *args,
        ),
        _corrective_contingency(
            "OSS_transformer_1_outage",
            _apply_transformer_outage("Trafo_66_220kV"),
            "STATCOM voltage control",
            *args,
        ),
        _corrective_contingency(
            "Onshore_transformer_1_outage",
            _apply_transformer_outage("Trafo_220_400kV"),
            "STATCOM voltage control",
            *args,
        ),
    ]
