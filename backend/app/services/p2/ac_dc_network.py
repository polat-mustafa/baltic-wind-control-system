"""
Meshed AC-DC hybrid network modeling for HVDC export options.

Physics — HVDC Transmission
-----------------------------
HVDC (High Voltage Direct Current) transmission is increasingly used for
long offshore cable routes because:

1. **No capacitive charging**: DC cables have zero reactive power consumption,
   eliminating the Ferranti voltage rise and reactive compensation needs.
   For AC cables > 80-100 km, reactive charging current consumes most of
   the cable ampacity, making AC impractical.

2. **Lower losses**: DC cable losses are purely resistive (I²R), with no
   skin effect, proximity effect, or dielectric losses.

3. **Asynchronous connection**: HVDC decouples the offshore and onshore AC
   systems, allowing different frequencies or connecting non-synchronous grids.

VSC-HVDC (Voltage Source Converter HVDC)
-----------------------------------------
Modern offshore HVDC uses VSC topology (e.g., MMC — Modular Multilevel
Converter) which provides:
- Independent P and Q control at both terminals
- Black-start capability
- Compact offshore platform

Converter losses: ~1% per converter station (2% total roundtrip)
Cable losses: ~0.003 Ω/km for ±320 kV XLPE submarine cable

Comparison Model
-----------------
This module compares three export options for the 510 MW Baltic Wind project:
1. **HVAC** (current design): 220 kV, 45 km submarine cable
2. **HVDC-VSC**: ±320 kV, 45 km submarine cable
3. **Hybrid**: HVAC for short array + HVDC for long export

References
----------
- CIGRE TB 492 (2012): VSC Transmission
- ABB HVDC Light documentation
- Shire, M. et al. (2019): VSC-HVDC for offshore wind connection
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# ── HVDC Constants ──────────────────────────────────────────────

HVDC_VOLTAGE_KV: float = 320.0
"""HVDC voltage per pole [kV] (±320 kV system)."""

HVDC_CABLE_R_OHM_PER_KM: float = 0.010
"""HVDC cable resistance [Ω/km] (1200 mm² Cu)."""

VSC_CONVERTER_LOSS_PERCENT: float = 1.0
"""VSC converter losses per station [%]."""

HVAC_CABLE_R_OHM_PER_KM: float = 0.0176
"""HVAC 220 kV cable resistance [Ω/km]."""

HVAC_CABLE_C_NF_PER_KM: float = 190.0
"""HVAC 220 kV cable capacitance [nF/km]."""

HVAC_VOLTAGE_KV: float = 220.0
"""HVAC export voltage [kV]."""


@dataclass(frozen=True)
class ExportOptionResult:
    """Result for a single export technology option.

    Attributes
    ----------
    technology : str
        Technology name ("HVAC", "HVDC-VSC", "Hybrid").
    cable_length_km : float
        Export cable length [km].
    total_loss_mw : float
        Total losses (cable + converter) [MW].
    loss_percent : float
        Total losses as percentage of rated power [%].
    cable_loss_mw : float
        Cable resistive losses [MW].
    converter_loss_mw : float
        Converter station losses [MW]. 0 for pure HVAC.
    reactive_compensation_mvar : float
        Required reactive power compensation [MVAR]. 0 for HVDC.
    annual_loss_gwh : float
        Annual energy loss at typical capacity factor [GWh/year].
    capex_index : float
        Relative CAPEX index (HVAC = 1.0).
    breakeven_distance_km : float
        Distance at which this technology becomes cheaper than HVAC [km].
    """

    technology: str
    cable_length_km: float
    total_loss_mw: float
    loss_percent: float
    cable_loss_mw: float
    converter_loss_mw: float
    reactive_compensation_mvar: float
    annual_loss_gwh: float
    capex_index: float
    breakeven_distance_km: float


@dataclass(frozen=True)
class ACDCComparisonResult:
    """Comparison of HVAC, HVDC, and hybrid export options.

    Attributes
    ----------
    options : list[ExportOptionResult]
        Results for each technology.
    recommended : str
        Recommended technology for this cable length.
    recommendation_reason : str
        Explanation for the recommendation.
    loss_saving_mw : float
        Loss saving of best option vs worst [MW].
    loss_saving_gwh_year : float
        Annual loss saving [GWh/year].
    """

    options: list[ExportOptionResult] = field(default_factory=list)
    recommended: str = ""
    recommendation_reason: str = ""
    loss_saving_mw: float = 0.0
    loss_saving_gwh_year: float = 0.0


def _compute_hvac_losses(
    power_mw: float,
    voltage_kv: float,
    cable_length_km: float,
    r_ohm_per_km: float,
    c_nf_per_km: float,
) -> tuple[float, float, float]:
    """Compute HVAC cable losses and reactive compensation needs.

    Parameters
    ----------
    power_mw : float
        Transmitted power [MW].
    voltage_kv : float
        Cable voltage [kV].
    cable_length_km : float
        Cable length [km].
    r_ohm_per_km : float
        Cable resistance [Ω/km].
    c_nf_per_km : float
        Cable capacitance [nF/km].

    Returns
    -------
    tuple[float, float, float]
        (cable_loss_mw, reactive_compensation_mvar, converter_loss_mw=0).
    """
    # Current (3-phase): I = P / (√3 × V)
    current_ka = power_mw / (np.sqrt(3) * voltage_kv)  # kA
    current_a = current_ka * 1000.0

    # Resistive losses: P_loss = 3 × I² × R × L (3-phase)
    r_total = r_ohm_per_km * cable_length_km
    cable_loss_mw = 3.0 * (current_a**2) * r_total / 1e6

    # Reactive power generation: Q = ω × C × V² × L (per phase, 3-phase)
    omega = 2.0 * np.pi * 50.0
    c_total = c_nf_per_km * 1e-9 * cable_length_km
    q_mvar = omega * c_total * (voltage_kv * 1000.0) ** 2 / 1e6 * 3.0

    return cable_loss_mw, q_mvar, 0.0


def _compute_hvdc_losses(
    power_mw: float,
    voltage_kv: float,
    cable_length_km: float,
    r_ohm_per_km: float,
    converter_loss_pct: float,
) -> tuple[float, float, float]:
    """Compute HVDC cable and converter losses.

    Parameters
    ----------
    power_mw : float
        Transmitted power [MW].
    voltage_kv : float
        DC voltage per pole [kV].
    cable_length_km : float
        Cable length [km].
    r_ohm_per_km : float
        Cable resistance per pole [Ω/km].
    converter_loss_pct : float
        Converter loss per station [%].

    Returns
    -------
    tuple[float, float, float]
        (cable_loss_mw, reactive_compensation_mvar=0, converter_loss_mw).
    """
    # Bipole current: I = P / (2 × V_dc)
    current_a = power_mw * 1e6 / (2.0 * voltage_kv * 1e3)

    # Cable losses: 2 × I² × R × L (two poles)
    r_total = r_ohm_per_km * cable_length_km
    cable_loss_mw = 2.0 * (current_a**2) * r_total / 1e6

    # Converter losses: 2 stations × loss_pct
    converter_loss_mw = power_mw * converter_loss_pct / 100.0 * 2.0

    return cable_loss_mw, 0.0, converter_loss_mw


def compare_export_options(
    rated_power_mw: float = 510.0,
    cable_length_km: float = 45.0,
    capacity_factor: float = 0.45,
    hours_per_year: float = 8760.0,
) -> ACDCComparisonResult:
    """Compare HVAC, HVDC-VSC, and hybrid export options.

    Parameters
    ----------
    rated_power_mw : float
        Wind farm rated power [MW]. Default: 510.
    cable_length_km : float
        Export cable length [km]. Default: 45.
    capacity_factor : float
        Annual capacity factor [-]. Default: 0.45.
    hours_per_year : float
        Hours per year. Default: 8760.

    Returns
    -------
    ACDCComparisonResult
        Comparative analysis of export technologies.
    """
    avg_power = rated_power_mw * capacity_factor
    options: list[ExportOptionResult] = []

    # Option 1: HVAC (current design)
    hvac_cable, hvac_q, _ = _compute_hvac_losses(
        avg_power,
        HVAC_VOLTAGE_KV,
        cable_length_km,
        HVAC_CABLE_R_OHM_PER_KM,
        HVAC_CABLE_C_NF_PER_KM,
    )
    hvac_total = hvac_cable
    hvac_annual = hvac_total * hours_per_year / 1000.0  # MWh → GWh
    options.append(
        ExportOptionResult(
            technology="HVAC",
            cable_length_km=cable_length_km,
            total_loss_mw=round(hvac_total, 2),
            loss_percent=round(hvac_total / avg_power * 100.0, 2) if avg_power > 0 else 0.0,
            cable_loss_mw=round(hvac_cable, 2),
            converter_loss_mw=0.0,
            reactive_compensation_mvar=round(hvac_q, 1),
            annual_loss_gwh=round(hvac_annual, 2),
            capex_index=1.0,
            breakeven_distance_km=0.0,
        )
    )

    # Option 2: HVDC-VSC (±320 kV)
    hvdc_cable, _, hvdc_conv = _compute_hvdc_losses(
        avg_power,
        HVDC_VOLTAGE_KV,
        cable_length_km,
        HVDC_CABLE_R_OHM_PER_KM,
        VSC_CONVERTER_LOSS_PERCENT,
    )
    hvdc_total = hvdc_cable + hvdc_conv
    hvdc_annual = hvdc_total * hours_per_year / 1000.0
    # HVDC CAPEX: ~1.5-2.0× HVAC due to converter stations
    hvdc_capex = 1.8 if cable_length_km < 100 else 1.5
    # Breakeven: where HVDC total cost < HVAC total cost
    # Typically 80-120 km for HVDC-VSC
    breakeven = 80.0 + (rated_power_mw - 500.0) * 0.05
    options.append(
        ExportOptionResult(
            technology="HVDC-VSC",
            cable_length_km=cable_length_km,
            total_loss_mw=round(hvdc_total, 2),
            loss_percent=round(hvdc_total / avg_power * 100.0, 2) if avg_power > 0 else 0.0,
            cable_loss_mw=round(hvdc_cable, 2),
            converter_loss_mw=round(hvdc_conv, 2),
            reactive_compensation_mvar=0.0,
            annual_loss_gwh=round(hvdc_annual, 2),
            capex_index=round(hvdc_capex, 2),
            breakeven_distance_km=round(breakeven, 0),
        )
    )

    # Option 3: Hybrid (HVAC array + HVDC export for last 2/3 of distance)
    hvac_short_km = cable_length_km * 0.33
    hvdc_long_km = cable_length_km * 0.67
    hybrid_hvac_loss, hybrid_q, _ = _compute_hvac_losses(
        avg_power,
        HVAC_VOLTAGE_KV,
        hvac_short_km,
        HVAC_CABLE_R_OHM_PER_KM,
        HVAC_CABLE_C_NF_PER_KM,
    )
    hybrid_hvdc_cable, _, hybrid_conv = _compute_hvdc_losses(
        avg_power,
        HVDC_VOLTAGE_KV,
        hvdc_long_km,
        HVDC_CABLE_R_OHM_PER_KM,
        VSC_CONVERTER_LOSS_PERCENT,
    )
    hybrid_total = hybrid_hvac_loss + hybrid_hvdc_cable + hybrid_conv
    hybrid_annual = hybrid_total * hours_per_year / 1000.0
    options.append(
        ExportOptionResult(
            technology="Hybrid",
            cable_length_km=cable_length_km,
            total_loss_mw=round(hybrid_total, 2),
            loss_percent=round(hybrid_total / avg_power * 100.0, 2) if avg_power > 0 else 0.0,
            cable_loss_mw=round(hybrid_hvac_loss + hybrid_hvdc_cable, 2),
            converter_loss_mw=round(hybrid_conv, 2),
            reactive_compensation_mvar=round(hybrid_q, 1),
            annual_loss_gwh=round(hybrid_annual, 2),
            capex_index=round(1.4, 2),
            breakeven_distance_km=round(breakeven * 0.7, 0),
        )
    )

    # Recommendation
    best = min(options, key=lambda o: o.total_loss_mw)
    worst = max(options, key=lambda o: o.total_loss_mw)

    if cable_length_km < 60:
        recommended = "HVAC"
        reason = (
            f"Cable length ({cable_length_km} km) is below HVDC"
            " breakeven distance. HVAC is most cost-effective."
        )
    elif cable_length_km < 100:
        recommended = "HVAC"
        reason = (
            f"Cable length ({cable_length_km} km) is near HVDC"
            " breakeven. HVAC preferred for lower CAPEX, but HVDC"
            " should be evaluated for future extensions."
        )
    else:
        recommended = "HVDC-VSC"
        reason = (
            f"Cable length ({cable_length_km} km) exceeds HVDC"
            " breakeven. HVDC has lower losses and eliminates"
            " reactive compensation."
        )

    return ACDCComparisonResult(
        options=options,
        recommended=recommended,
        recommendation_reason=reason,
        loss_saving_mw=round(worst.total_loss_mw - best.total_loss_mw, 2),
        loss_saving_gwh_year=round(worst.annual_loss_gwh - best.annual_loss_gwh, 2),
    )
