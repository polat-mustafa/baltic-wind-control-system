"""
Capacity expansion planning for offshore wind farm portfolio.

Physics — Capacity Expansion
------------------------------
Capacity expansion planning determines the optimal investment schedule for
new generation, storage, and transmission assets over a multi-year horizon.
The optimization balances:

1. **Investment costs (CAPEX)**: Turbines, cables, substations, BESS
2. **Operating costs (OPEX)**: Maintenance, losses, curtailment
3. **Revenue**: Energy sales at projected market prices
4. **Constraints**: Grid capacity, build rate limits, technology maturity

For the Baltic Wind portfolio (P1-P5 = 510 MW each, 2,550 MW total), the
expansion planner determines:
- Phasing: When to build each project (P1 first, then P2-P5)
- Technology: Turbine selection per phase (evolving technology)
- Storage: When and how much BESS to add
- Grid reinforcement: Export cable and substation upgrades

Net Present Value (NPV)
-------------------------
All costs and revenues are discounted to present value:
    NPV = Σ_t (Revenue_t - Cost_t) / (1 + r)^t

where r = discount rate (typically 6-8% for offshore wind).

Levelized Cost of Energy (LCOE)
---------------------------------
    LCOE = (Σ CAPEX + Σ OPEX_discounted) / (Σ AEP_discounted)

References
----------
- IRENA (2023): Renewable Power Generation Costs
- DNV Energy Transition Outlook 2024
- PSE development plan (Polish transmission grid expansion)
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Expansion Planning Constants ─────────────────────────────────

DISCOUNT_RATE: float = 0.07
"""Discount rate for NPV calculation [-]."""

PROJECT_LIFETIME_YEARS: int = 30
"""Project operational lifetime [years]."""

CAPEX_TURBINE_EUR_PER_KW: float = 1800.0
"""Turbine + foundation CAPEX [EUR/kW] (2024 estimate)."""

CAPEX_CABLE_EUR_PER_KM_PER_MW: float = 350.0
"""Export cable CAPEX [EUR/km/MW]."""

CAPEX_SUBSTATION_EUR_PER_MW: float = 200.0
"""Offshore substation CAPEX [EUR/MW]."""

CAPEX_BESS_EUR_PER_KWH: float = 250.0
"""BESS CAPEX [EUR/kWh] (Li-ion, 2024 estimate)."""

OPEX_FIXED_EUR_PER_KW_YEAR: float = 55.0
"""Fixed OPEX [EUR/kW/year] (maintenance, insurance, lease)."""

CAPEX_LEARNING_RATE: float = 0.05
"""CAPEX reduction per year due to technology learning [-]."""


@dataclass(frozen=True)
class ProjectPhase:
    """A single project phase in the expansion plan.

    Attributes
    ----------
    name : str
        Project name (e.g., "P1 Baltic Wind Alpha").
    capacity_mw : float
        Installed capacity [MW].
    build_year : int
        Year construction starts.
    cod_year : int
        Commercial operation date (year).
    capex_meur : float
        Total CAPEX [M EUR].
    annual_aep_gwh : float
        Expected annual energy production [GWh/year].
    lcoe_eur_mwh : float
        Levelized cost of energy [EUR/MWh].
    npv_meur : float
        Net present value [M EUR].
    irr_percent : float
        Internal rate of return [%].
    bess_mwh : float
        Co-located BESS capacity [MWh]. 0 if none.
    """

    name: str
    capacity_mw: float
    build_year: int
    cod_year: int
    capex_meur: float
    annual_aep_gwh: float
    lcoe_eur_mwh: float
    npv_meur: float
    irr_percent: float
    bess_mwh: float = 0.0


@dataclass(frozen=True)
class ExpansionPlanResult:
    """Result of capacity expansion planning.

    Attributes
    ----------
    phases : list[ProjectPhase]
        Ordered list of project phases.
    total_capacity_mw : float
        Total installed capacity [MW].
    total_capex_meur : float
        Total investment [M EUR].
    total_annual_aep_gwh : float
        Total annual energy at full buildout [GWh/year].
    portfolio_lcoe_eur_mwh : float
        Portfolio-weighted LCOE [EUR/MWh].
    portfolio_npv_meur : float
        Total portfolio NPV [M EUR].
    buildout_years : int
        Years from first to last COD.
    total_bess_mwh : float
        Total BESS capacity [MWh].
    cumulative_capacity_by_year : list[tuple[int, float]]
        (year, cumulative_mw) pairs for buildout curve.
    """

    phases: list[ProjectPhase] = field(default_factory=list)
    total_capacity_mw: float = 0.0
    total_capex_meur: float = 0.0
    total_annual_aep_gwh: float = 0.0
    portfolio_lcoe_eur_mwh: float = 0.0
    portfolio_npv_meur: float = 0.0
    buildout_years: int = 0
    total_bess_mwh: float = 0.0
    cumulative_capacity_by_year: list[tuple[int, float]] = field(default_factory=list)


def _compute_capex(
    capacity_mw: float,
    cable_length_km: float,
    bess_mwh: float,
    year_offset: int,
) -> float:
    """Compute total CAPEX with technology learning curve.

    Parameters
    ----------
    capacity_mw : float
        Project capacity [MW].
    cable_length_km : float
        Export cable length [km].
    bess_mwh : float
        BESS capacity [MWh].
    year_offset : int
        Years from base year (for learning rate).

    Returns
    -------
    float
        Total CAPEX [M EUR].
    """
    learning_factor = (1.0 - CAPEX_LEARNING_RATE) ** year_offset

    turbine = capacity_mw * 1000.0 * CAPEX_TURBINE_EUR_PER_KW * learning_factor / 1e6
    cable = cable_length_km * capacity_mw * CAPEX_CABLE_EUR_PER_KM_PER_MW / 1e6
    substation = capacity_mw * CAPEX_SUBSTATION_EUR_PER_MW * 1000.0 / 1e6
    bess = bess_mwh * CAPEX_BESS_EUR_PER_KWH * 1000.0 / 1e6 * learning_factor

    return turbine + cable + substation + bess


def _compute_lcoe(
    capex_meur: float,
    annual_aep_gwh: float,
    capacity_mw: float,
    lifetime: int = PROJECT_LIFETIME_YEARS,
    discount_rate: float = DISCOUNT_RATE,
) -> float:
    """Compute levelized cost of energy.

    Parameters
    ----------
    capex_meur : float
        Total CAPEX [M EUR].
    annual_aep_gwh : float
        Annual energy production [GWh/year].
    capacity_mw : float
        Installed capacity [MW].
    lifetime : int
        Project lifetime [years].
    discount_rate : float
        Discount rate [-].

    Returns
    -------
    float
        LCOE [EUR/MWh].
    """
    # Discounted OPEX
    annual_opex = capacity_mw * 1000.0 * OPEX_FIXED_EUR_PER_KW_YEAR / 1e6  # M EUR
    total_opex = sum(annual_opex / (1.0 + discount_rate) ** t for t in range(1, lifetime + 1))

    # Discounted AEP
    total_aep = sum(annual_aep_gwh / (1.0 + discount_rate) ** t for t in range(1, lifetime + 1))

    total_cost = capex_meur + total_opex
    lcoe = total_cost / total_aep * 1000.0 if total_aep > 0 else 0.0  # M EUR / GWh → EUR/MWh

    return lcoe


def _compute_npv(
    capex_meur: float,
    annual_revenue_meur: float,
    annual_opex_meur: float,
    lifetime: int = PROJECT_LIFETIME_YEARS,
    discount_rate: float = DISCOUNT_RATE,
) -> float:
    """Compute Net Present Value.

    Parameters
    ----------
    capex_meur : float
        CAPEX (at year 0) [M EUR].
    annual_revenue_meur : float
        Annual revenue [M EUR].
    annual_opex_meur : float
        Annual OPEX [M EUR].
    lifetime : int
        Project lifetime [years].
    discount_rate : float
        Discount rate [-].

    Returns
    -------
    float
        NPV [M EUR].
    """
    npv = -capex_meur
    for t in range(1, lifetime + 1):
        net_cash = annual_revenue_meur - annual_opex_meur
        npv += net_cash / (1.0 + discount_rate) ** t
    return npv


def _compute_irr(
    capex_meur: float,
    annual_net_cash_meur: float,
    lifetime: int = PROJECT_LIFETIME_YEARS,
) -> float:
    """Compute Internal Rate of Return using bisection.

    Parameters
    ----------
    capex_meur : float
        CAPEX [M EUR].
    annual_net_cash_meur : float
        Annual net cash flow [M EUR].
    lifetime : int
        Project lifetime [years].

    Returns
    -------
    float
        IRR [%].
    """

    def npv_at_rate(r: float) -> float:
        return -capex_meur + sum(
            annual_net_cash_meur / (1.0 + r) ** t for t in range(1, lifetime + 1)
        )

    low, high = -0.05, 0.50
    for _ in range(100):
        mid = (low + high) / 2.0
        if npv_at_rate(mid) > 0:
            low = mid
        else:
            high = mid
    return mid * 100.0


def plan_capacity_expansion(
    projects: list[dict] | None = None,
    electricity_price_eur_mwh: float = 72.0,
    base_year: int = 2026,
    include_bess: bool = True,
) -> ExpansionPlanResult:
    """Plan optimal capacity expansion for wind farm portfolio.

    Parameters
    ----------
    projects : list[dict], optional
        Project definitions. Default: P1-P5 Baltic Wind portfolio.
        Each dict has: name, capacity_mw, cable_length_km, cf, build_delay_years.
    electricity_price_eur_mwh : float
        Assumed electricity price [EUR/MWh]. Default: 72.0.
    base_year : int
        First project build year. Default: 2026.
    include_bess : bool
        Whether to include BESS in later phases. Default: True.

    Returns
    -------
    ExpansionPlanResult
        Optimized expansion plan with phased buildout.
    """
    if projects is None:
        projects = [
            {
                "name": "P1 Baltic Wind Alpha",
                "capacity_mw": 510.0,
                "cable_length_km": 45.0,
                "cf": 0.45,
                "build_delay_years": 0,
            },
            {
                "name": "P2 Baltic Wind Beta",
                "capacity_mw": 510.0,
                "cable_length_km": 50.0,
                "cf": 0.46,
                "build_delay_years": 2,
            },
            {
                "name": "P3 Baltic Wind Gamma",
                "capacity_mw": 510.0,
                "cable_length_km": 55.0,
                "cf": 0.47,
                "build_delay_years": 4,
            },
            {
                "name": "P4 Baltic Wind Delta",
                "capacity_mw": 510.0,
                "cable_length_km": 60.0,
                "cf": 0.47,
                "build_delay_years": 6,
            },
            {
                "name": "P5 Baltic Wind Epsilon",
                "capacity_mw": 510.0,
                "cable_length_km": 65.0,
                "cf": 0.48,
                "build_delay_years": 8,
            },
        ]

    phases: list[ProjectPhase] = []
    total_capex = 0.0
    total_aep = 0.0
    cumulative: list[tuple[int, float]] = []
    cum_capacity = 0.0

    for proj in projects:
        name = proj["name"]
        capacity = proj["capacity_mw"]
        cable_km = proj["cable_length_km"]
        cf = proj["cf"]
        delay = proj["build_delay_years"]

        build_year = base_year + delay
        cod_year = build_year + 2  # 2-year construction

        # BESS for phases 3+ (technology matures, costs drop)
        bess_mwh = 0.0
        if include_bess and delay >= 4:
            bess_mwh = capacity * 0.2 * 4.0  # 20% of capacity × 4h duration

        capex = _compute_capex(capacity, cable_km, bess_mwh, delay)
        aep = capacity * cf * 8760.0 / 1000.0  # GWh/year
        lcoe = _compute_lcoe(capex, aep, capacity)

        annual_revenue = aep * electricity_price_eur_mwh / 1000.0  # M EUR
        annual_opex = capacity * 1000.0 * OPEX_FIXED_EUR_PER_KW_YEAR / 1e6
        npv = _compute_npv(capex, annual_revenue, annual_opex)
        irr = _compute_irr(capex, annual_revenue - annual_opex)

        phases.append(
            ProjectPhase(
                name=name,
                capacity_mw=capacity,
                build_year=build_year,
                cod_year=cod_year,
                capex_meur=round(capex, 1),
                annual_aep_gwh=round(aep, 1),
                lcoe_eur_mwh=round(lcoe, 1),
                npv_meur=round(npv, 1),
                irr_percent=round(irr, 1),
                bess_mwh=bess_mwh,
            )
        )

        total_capex += capex
        total_aep += aep
        cum_capacity += capacity
        cumulative.append((cod_year, round(cum_capacity, 0)))

    # Portfolio LCOE
    total_lcoe = 0.0
    if phases:
        weighted_cost = sum(p.lcoe_eur_mwh * p.annual_aep_gwh for p in phases)
        total_lcoe = weighted_cost / total_aep if total_aep > 0 else 0.0

    total_npv = sum(p.npv_meur for p in phases)
    buildout = (phases[-1].cod_year - phases[0].cod_year) if len(phases) > 1 else 0
    total_bess = sum(p.bess_mwh for p in phases)

    return ExpansionPlanResult(
        phases=phases,
        total_capacity_mw=cum_capacity,
        total_capex_meur=round(total_capex, 1),
        total_annual_aep_gwh=round(total_aep, 1),
        portfolio_lcoe_eur_mwh=round(total_lcoe, 1),
        portfolio_npv_meur=round(total_npv, 1),
        buildout_years=buildout,
        total_bess_mwh=total_bess,
        cumulative_capacity_by_year=cumulative,
    )
