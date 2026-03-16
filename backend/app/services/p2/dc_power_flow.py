"""
DC (linearized) power flow for fast network screening.

Physics — DC Power Flow
-------------------------
DC power flow linearizes the AC power flow equations by assuming:
1. Voltage magnitudes V_i ≈ 1.0 p.u. (flat voltage profile)
2. Voltage angle differences θ_ij are small → sin(θ_ij) ≈ θ_ij, cos(θ_ij) ≈ 1
3. Line resistances are negligible (lossless)
4. Reactive power is ignored (P-only analysis)

This reduces the nonlinear AC power balance to a linear system:
    P = B' × θ

where B' is the DC bus susceptance matrix (purely imaginary part of Y_bus).

Advantages:
- 100-1000× faster than AC power flow (single matrix solve)
- Always converges (no iterative solution needed)
- Accurate for high-voltage transmission networks (small angles, R << X)

Limitations:
- No voltage magnitude information
- No reactive power / losses
- Inaccurate for low-voltage or heavily loaded networks

Use cases:
- Contingency screening (check hundreds of N-1 cases quickly)
- Dispatch studies (active power only)
- Market clearing / economic dispatch
- Preliminary thermal limit checks

References
----------
- Stott, B. et al. (2009). DC Power Flow Revisited. IEEE Trans. Power Syst.
- Pandapower: pp.rundcpp() — DC power flow solver
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandapower as pp

from app.services.p2.network_model import (
    STRING_LAYOUT,
    TURBINE_RATED_MW,
    build_network,
)


@dataclass(frozen=True)
class DCLineResult:
    """DC power flow result for a single line/cable.

    Attributes
    ----------
    name : str
        Line/cable name.
    p_from_mw : float
        Active power flow from sending end [MW].
    loading_percent : float
        Line loading [%] (based on thermal limit).
    overloaded : bool
        True if loading > 100%.
    """

    name: str
    p_from_mw: float
    loading_percent: float
    overloaded: bool


@dataclass(frozen=True)
class DCPowerFlowResult:
    """Result of DC power flow analysis.

    Attributes
    ----------
    converged : bool
        Whether the DC power flow converged (always True for valid networks).
    total_generation_mw : float
        Total active power generation [MW].
    total_export_mw : float
        Power exported to grid [MW].
    max_line_loading_percent : float
        Maximum cable loading [%].
    num_overloaded_lines : int
        Number of overloaded cables.
    bus_angles_deg : list[tuple[str, float]]
        (bus_name, angle_deg) for each bus.
    line_results : list[DCLineResult]
        Per-line power flow results.
    """

    converged: bool
    total_generation_mw: float
    total_export_mw: float
    max_line_loading_percent: float
    num_overloaded_lines: int
    bus_angles_deg: list[tuple[str, float]] = field(default_factory=list)
    line_results: list[DCLineResult] = field(default_factory=list)


@dataclass(frozen=True)
class DCContingencyScreening:
    """Result of DC power flow contingency screening.

    Attributes
    ----------
    n_contingencies : int
        Number of contingencies screened.
    n_secure : int
        Number of contingencies with no overloads.
    n_violations : int
        Number of contingencies with overloads.
    worst_contingency : str
        Name of worst contingency.
    worst_loading_percent : float
        Maximum loading in worst contingency [%].
    per_contingency : list[tuple[str, DCPowerFlowResult]]
        (contingency_name, result) for each contingency.
    """

    n_contingencies: int
    n_secure: int
    n_violations: int
    worst_contingency: str
    worst_loading_percent: float
    per_contingency: list[tuple[str, DCPowerFlowResult]] = field(default_factory=list)


def run_dc_power_flow(
    generation_fraction: float = 1.0,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> DCPowerFlowResult:
    """Run DC (linearized) power flow analysis.

    Parameters
    ----------
    generation_fraction : float
        Generation fraction [0-1]. Default: 1.0.
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.

    Returns
    -------
    DCPowerFlowResult
        DC power flow results with line loadings and bus angles.
    """
    net = build_network(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
    )

    try:
        pp.rundcpp(net)
    except Exception:
        return DCPowerFlowResult(
            converged=False,
            total_generation_mw=0.0,
            total_export_mw=0.0,
            max_line_loading_percent=0.0,
            num_overloaded_lines=0,
        )

    return _extract_dc_results(net)


def _extract_dc_results(net: pp.pandapowerNet) -> DCPowerFlowResult:
    """Extract DC power flow results from converged network.

    Parameters
    ----------
    net : pp.pandapowerNet
        Converged DC power flow network.

    Returns
    -------
    DCPowerFlowResult
        Extracted results.
    """
    # Total generation (WTGs only)
    total_gen = 0.0
    for idx in range(len(net.sgen)):
        name = str(net.sgen.at[idx, "name"])
        if name != "STATCOM":
            total_gen += float(net.sgen.at[idx, "p_mw"])

    # Bus angles
    bus_angles = []
    for idx in range(len(net.bus)):
        name = str(net.bus.at[idx, "name"])
        angle = float(net.res_bus.at[idx, "va_degree"])
        bus_angles.append((name, round(angle, 2)))

    # Line results
    line_results = []
    max_loading = 0.0
    n_overloaded = 0
    for idx in range(len(net.line)):
        name = str(net.line.at[idx, "name"])
        p_from = float(net.res_line.at[idx, "p_from_mw"])
        loading = float(net.res_line.at[idx, "loading_percent"])
        overloaded = loading > 100.0
        if overloaded:
            n_overloaded += 1
        max_loading = max(max_loading, loading)
        line_results.append(DCLineResult(
            name=name,
            p_from_mw=round(p_from, 2),
            loading_percent=round(loading, 1),
            overloaded=overloaded,
        ))

    # Export power (from ext_grid perspective)
    total_export = abs(float(net.res_ext_grid["p_mw"].sum()))

    return DCPowerFlowResult(
        converged=True,
        total_generation_mw=round(total_gen, 2),
        total_export_mw=round(total_export, 2),
        max_line_loading_percent=round(max_loading, 1),
        num_overloaded_lines=n_overloaded,
        bus_angles_deg=bus_angles,
        line_results=line_results,
    )


def run_dc_contingency_screening(
    generation_fraction: float = 1.0,
    export_length_km: float = 45.0,
    grid_ssc_mva: float = 10_000.0,
) -> DCContingencyScreening:
    """Run DC power flow for all N-1 string contingencies.

    Much faster than AC contingency analysis — suitable for screening
    hundreds of contingencies in seconds.

    Parameters
    ----------
    generation_fraction : float
        Generation fraction [0-1]. Default: 1.0.
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.

    Returns
    -------
    DCContingencyScreening
        Screening results for all string outages.
    """
    results: list[tuple[str, DCPowerFlowResult]] = []
    worst_name = ""
    worst_loading = 0.0

    for string_idx in range(len(STRING_LAYOUT)):
        cont_name = f"String_{string_idx + 1}_outage"

        # Build network and disable string
        net = build_network(
            export_length_km=export_length_km,
            grid_ssc_mva=grid_ssc_mva,
            generation_fraction=generation_fraction,
        )

        # Disable WTGs in this string
        start_idx = sum(STRING_LAYOUT[:string_idx])
        end_idx = start_idx + STRING_LAYOUT[string_idx]
        for sgen_idx in range(len(net.sgen)):
            name = str(net.sgen.at[sgen_idx, "name"])
            if name == "STATCOM":
                continue
            wtg_num = int(name.split("_")[1])
            if start_idx + 1 <= wtg_num <= end_idx:
                net.sgen.at[sgen_idx, "in_service"] = False

        try:
            pp.rundcpp(net)
            result = _extract_dc_results(net)
        except Exception:
            result = DCPowerFlowResult(
                converged=False, total_generation_mw=0.0,
                total_export_mw=0.0, max_line_loading_percent=0.0,
                num_overloaded_lines=0,
            )

        results.append((cont_name, result))

        if result.max_line_loading_percent > worst_loading:
            worst_loading = result.max_line_loading_percent
            worst_name = cont_name

    n_violations = sum(1 for _, r in results if r.num_overloaded_lines > 0)

    return DCContingencyScreening(
        n_contingencies=len(results),
        n_secure=len(results) - n_violations,
        n_violations=n_violations,
        worst_contingency=worst_name,
        worst_loading_percent=round(worst_loading, 1),
        per_contingency=results,
    )
