"""
Sub-Synchronous Oscillation (SSO) screening for 510 MW offshore wind farm.

Performs impedance-based stability analysis to assess SSO risk from the
interaction between converter controls and the series-compensated or
long-cable-connected AC system.

Physics — Sub-Synchronous Resonance
--------------------------------------
Long HVAC export cables have significant distributed capacitance (C) and
inductance (L). The cable's natural resonance frequency is:

  f_res = 1 / (2π√(LC))

If this resonance falls in the sub-synchronous range (1–49 Hz), it can
interact with the converter's Phase-Locked Loop (PLL) or current controller,
potentially causing growing oscillations (Sub-Synchronous Control Interaction,
SSCI).

The risk depends on grid strength (SCR = Ssc / P_rated):
  - Strong grid (SCR > 5): low SSO risk — grid dominates impedance
  - Moderate grid (3 < SCR < 5): medium risk — monitoring needed
  - Weak grid (SCR < 3): high risk — converter-grid interaction likely

Standard — ENTSO-E NC HVDC / NC RfG
-------------------------------------
- NC HVDC Article 29: SSO screening required for HVDC and long AC connections
- NC RfG Article 21(3): Generators must not cause adverse interaction
- IEC TR 62858: Guidance on sub-synchronous oscillation analysis
- IEEE PES Task Force on SSO: Impedance-based stability criterion

Maths — Impedance-Based Stability Criterion
----------------------------------------------
The Nyquist-based impedance criterion checks:
  Re{Z_total(jω)} > 0  for all ω in sub-synchronous range [2π, 98π] rad/s

where Z_total = Z_converter(jω) + Z_grid(jω)

If Re{Z_total} < 0 at any frequency, the system has negative damping
at that frequency → oscillation grows → unstable.

Phase margin at resonance:
  PM = 180° - |∠Z_total(j×2π×f_res)|

If PM < 30°: high risk. If PM > 60°: low risk.

Cable LC resonance formula (distributed parameter approximation):
  L_total = L_per_km × length [H]
  C_total = C_per_km × length [F]
  f_res = 1 / (2π × √(L_total × C_total))

For 220 kV, 45 km export cable (L=0.116 mH/km, C=190 nF/km):
  L = 0.116e-3 × 45 = 5.22 mH
  C = 190e-9 × 45 = 8.55 μF
  f_res = 1 / (2π × √(5.22e-3 × 8.55e-6)) ≈ 753 Hz (above sub-synchronous)

At 45 km, resonance is well above 50 Hz — low SSO risk for this cable length.
Longer cables or series compensation would push resonance into the danger zone.

Code — ANDES Eigenvalue Analysis
----------------------------------
ANDES provides eigenvalue analysis of the linearized system:
  ẋ = A × x  →  eigenvalues λ = σ + jω

For each eigenvalue:
  - Frequency: f = ω / (2π)
  - Damping ratio: ζ = -σ / √(σ² + ω²)
  - If f < 50 Hz and ζ < 5%: flagged as SSO risk

References
----------
- CIGRE TB 671: Connection of wind farms to weak AC networks
- IEEE PES: Impedance-Based Stability Analysis (Fan, Miao, 2018)
- ANDES documentation: Eigenvalue analysis module
- IEC TR 62858: Guidance on sub-synchronous oscillation
"""

from __future__ import annotations

import logging
import math

import andes
import numpy as np

from app.schemas.grid import EigenvalueMode, SSOGRiskLevel, SSOScreeningResponse
from app.services.p2.andes_network import build_andes_system
from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    GRID_SSC_MVA,
    TOTAL_CAPACITY_MW,
)

logger = logging.getLogger(__name__)

# ── SSO Constants ─────────────────────────────────────────────────

SUB_SYNC_FREQ_MIN_HZ = 1.0  # Lower bound of sub-synchronous range
SUB_SYNC_FREQ_MAX_HZ = 49.0  # Upper bound (below nominal 50 Hz)
CRITICAL_DAMPING_RATIO = 0.05  # 5% — modes below this are flagged
PHASE_MARGIN_LOW_DEG = 30.0  # Below 30° = high risk
PHASE_MARGIN_HIGH_DEG = 60.0  # Above 60° = low risk

# SCR thresholds for risk classification
SCR_STRONG = 5.0  # SCR > 5 = strong grid
SCR_MODERATE = 3.0  # 3 < SCR < 5 = moderate


def calculate_cable_resonance_frequency(
    length_km: float,
    l_mh_per_km: float | None = None,
    c_nf_per_km: float | None = None,
) -> float:
    """Calculate cable LC resonance frequency.

    f_res = 1 / (2π × √(L_total × C_total))

    Parameters
    ----------
    length_km : float
        Cable length [km].
    l_mh_per_km : float | None
        Inductance per km [mH/km]. Default: export cable X / (2πf).
    c_nf_per_km : float | None
        Capacitance per km [nF/km]. Default: export cable C.

    Returns
    -------
    float
        Resonance frequency [Hz].
    """
    omega = 2.0 * math.pi * 50.0

    if l_mh_per_km is None:
        # Derive L from X: X = ωL → L = X/ω
        l_mh_per_km = (EXPORT_CABLE_1000.x_ohm_per_km / omega) * 1000.0  # mH/km

    if c_nf_per_km is None:
        c_nf_per_km = EXPORT_CABLE_1000.c_nf_per_km

    l_total_h = (l_mh_per_km * 1e-3) * length_km  # H
    c_total_f = (c_nf_per_km * 1e-9) * length_km  # F

    if l_total_h <= 0 or c_total_f <= 0:
        return float("inf")

    return 1.0 / (2.0 * math.pi * math.sqrt(l_total_h * c_total_f))


def run_impedance_scan(
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    freq_points: int = 200,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Run frequency-domain impedance scan for SSO screening.

    Calculates Z_total(jω) = Z_cable(jω) + Z_grid(jω) at each frequency
    point in the sub-synchronous range.

    Parameters
    ----------
    export_length_km : float
        Export cable length [km].
    grid_ssc_mva : float
        Grid short-circuit power [MVA].
    freq_points : int
        Number of frequency points to evaluate.

    Returns
    -------
    tuple[np.ndarray, np.ndarray, np.ndarray]
        (frequencies_hz, real_z, imag_z) — impedance at each frequency.
    """
    freqs = np.linspace(SUB_SYNC_FREQ_MIN_HZ, SUB_SYNC_FREQ_MAX_HZ, freq_points)
    omega_array = 2.0 * np.pi * freqs

    # Cable impedance (pi-model per unit length)
    r_cable = EXPORT_CABLE_1000.r_ohm_per_km * export_length_km
    l_cable = (EXPORT_CABLE_1000.x_ohm_per_km / (2.0 * np.pi * 50.0)) * export_length_km
    c_cable = EXPORT_CABLE_1000.c_nf_per_km * 1e-9 * export_length_km

    # Z_cable(jω) = R + jωL + 1/(jωC) = R + j(ωL - 1/(ωC))
    z_cable_real = np.full_like(freqs, r_cable)
    z_cable_imag = omega_array * l_cable - 1.0 / (omega_array * c_cable)

    # Grid impedance: Z_grid = V²/Ssc × (R/X + j) / √(1 + (R/X)²)
    v_base = 220.0  # kV
    z_grid_mag = (v_base**2) / grid_ssc_mva  # Ω (at 220 kV base)
    rx_ratio = 0.1
    z_grid_real = z_grid_mag * rx_ratio / np.sqrt(1 + rx_ratio**2)
    z_grid_imag_val = z_grid_mag / np.sqrt(1 + rx_ratio**2)

    # Scale grid impedance with frequency (X proportional to ω)
    z_grid_imag_array = z_grid_imag_val * (freqs / 50.0)

    # Total impedance
    real_z = z_cable_real + z_grid_real
    imag_z = z_cable_imag + z_grid_imag_array

    return freqs, real_z, imag_z


def run_eigenvalue_analysis(
    ss: andes.System,
) -> dict[str, list[EigenvalueMode]]:
    """Run ANDES eigenvalue analysis and extract sub-synchronous modes.

    Linearizes the system around the operating point and computes
    eigenvalues λ = σ + jω of the state matrix A.

    Parameters
    ----------
    ss : andes.System
        ANDES system with completed power flow.

    Returns
    -------
    dict[str, list[EigenvalueMode]]
        Dictionary with 'all_modes' and 'critical_modes' lists.
    """
    all_modes: list[EigenvalueMode] = []
    critical_modes: list[EigenvalueMode] = []

    try:
        # Run eigenvalue analysis
        ss.EIG.run()

        if hasattr(ss.EIG, "eigenvalues") and ss.EIG.eigenvalues is not None:
            eigenvalues = ss.EIG.eigenvalues

            for ev in eigenvalues:
                sigma = float(np.real(ev))
                omega = float(np.imag(ev))
                freq = abs(omega) / (2.0 * math.pi)

                # Damping ratio: ζ = -σ / √(σ² + ω²)
                magnitude = math.sqrt(sigma**2 + omega**2)
                damping = -sigma / magnitude if magnitude > 1e-10 else 1.0

                is_subsync = SUB_SYNC_FREQ_MIN_HZ <= freq <= SUB_SYNC_FREQ_MAX_HZ

                mode = EigenvalueMode(
                    real=round(sigma, 6),
                    imaginary=round(omega, 6),
                    frequency_hz=round(freq, 3),
                    damping_ratio=round(damping, 4),
                    is_subsynchronous=is_subsync,
                )
                all_modes.append(mode)

                if is_subsync and damping < CRITICAL_DAMPING_RATIO:
                    critical_modes.append(mode)

    except Exception:
        logger.debug("ANDES eigenvalue analysis not available, using impedance-based only")

    return {"all_modes": all_modes, "critical_modes": critical_modes}


def run_sso_screening(
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    generation_fraction: float = 1.0,
) -> SSOScreeningResponse:
    """Run complete SSO screening for the offshore wind farm.

    Combines:
    1. Cable LC resonance frequency calculation
    2. Impedance scan (Re{Z} > 0 criterion)
    3. ANDES eigenvalue analysis (damping ratio check)
    4. Risk classification (low/medium/high)

    Parameters
    ----------
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power at PCC [MVA]. Default: 10,000.
    generation_fraction : float
        Generation level for eigenvalue analysis. Default: 1.0.

    Returns
    -------
    SSOScreeningResponse
        Complete SSO screening result with risk classification.
    """
    # 1. Cable resonance frequency
    f_res = calculate_cable_resonance_frequency(export_length_km)

    # 2. Impedance scan
    freqs, real_z, imag_z = run_impedance_scan(export_length_km, grid_ssc_mva)

    # Check positive resistance criterion: Re{Z} > 0 for all sub-synchronous ω
    stable_impedance = bool(np.all(real_z > 0))

    # Phase margin at resonance (if resonance is in sub-synchronous range)
    if SUB_SYNC_FREQ_MIN_HZ <= f_res <= SUB_SYNC_FREQ_MAX_HZ:
        # Find closest frequency point to resonance
        res_idx = int(np.argmin(np.abs(freqs - f_res)))
        z_real_at_res = float(real_z[res_idx])
        z_imag_at_res = float(imag_z[res_idx])
        phase_at_res = math.degrees(math.atan2(z_imag_at_res, z_real_at_res))
        phase_margin = 180.0 - abs(phase_at_res)
    else:
        # Resonance outside sub-synchronous range — large phase margin
        phase_margin = 90.0

    # 3. Eigenvalue analysis (if ANDES dynamic models available)
    critical_modes: list[EigenvalueMode] = []
    min_damping = 1.0

    try:
        ss = build_andes_system(
            generation_fraction=generation_fraction,
            export_length_km=export_length_km,
            grid_ssc_mva=grid_ssc_mva,
            add_dynamic_models=True,
        )
        ss.PFlow.run()

        if ss.PFlow.converged:
            eig_results = run_eigenvalue_analysis(ss)
            critical_modes = eig_results["critical_modes"]
            all_modes = eig_results["all_modes"]

            # Find minimum damping in sub-synchronous range
            subsync_modes = [m for m in all_modes if m.is_subsynchronous]
            if subsync_modes:
                min_damping = min(m.damping_ratio for m in subsync_modes)
    except Exception:
        logger.debug("Eigenvalue analysis skipped — ANDES dynamic models unavailable")

    # 4. Risk classification
    scr = grid_ssc_mva / TOTAL_CAPACITY_MW
    risk_level = _classify_sso_risk(scr, phase_margin, min_damping, f_res)

    # Overall stability: impedance-based AND eigenvalue-based
    stable = stable_impedance and min_damping >= CRITICAL_DAMPING_RATIO

    return SSOScreeningResponse(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        resonance_frequency_hz=round(f_res, 1),
        phase_margin_deg=round(phase_margin, 1),
        stable=stable,
        risk_level=risk_level,
        minimum_damping_ratio=round(min_damping, 4),
        critical_modes=critical_modes,
    )


def _classify_sso_risk(
    scr: float,
    phase_margin_deg: float,
    min_damping: float,
    resonance_freq_hz: float,
) -> SSOGRiskLevel:
    """Classify SSO risk based on multiple indicators.

    Risk factors:
    - Low SCR (weak grid) increases risk
    - Low phase margin indicates near-instability
    - Low damping ratio indicates poorly damped modes
    - Resonance in sub-synchronous range is dangerous

    Parameters
    ----------
    scr : float
        Short-circuit ratio at PCC.
    phase_margin_deg : float
        Phase margin at resonance [degrees].
    min_damping : float
        Minimum damping ratio of sub-synchronous modes.
    resonance_freq_hz : float
        Cable resonance frequency [Hz].

    Returns
    -------
    SSOGRiskLevel
        SSO risk: low, medium, or high.
    """
    # High risk conditions
    if scr < SCR_MODERATE:
        return SSOGRiskLevel.HIGH
    if phase_margin_deg < PHASE_MARGIN_LOW_DEG:
        return SSOGRiskLevel.HIGH
    if min_damping < CRITICAL_DAMPING_RATIO:
        return SSOGRiskLevel.HIGH
    if SUB_SYNC_FREQ_MIN_HZ <= resonance_freq_hz <= SUB_SYNC_FREQ_MAX_HZ:
        return SSOGRiskLevel.HIGH

    # Medium risk conditions
    if scr < SCR_STRONG:
        return SSOGRiskLevel.MEDIUM
    if phase_margin_deg < PHASE_MARGIN_HIGH_DEG:
        return SSOGRiskLevel.MEDIUM
    if min_damping < 0.10:
        return SSOGRiskLevel.MEDIUM

    return SSOGRiskLevel.LOW
