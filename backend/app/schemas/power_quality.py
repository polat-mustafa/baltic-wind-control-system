"""
Pydantic schemas for the power quality API — harmonics, resonance, flicker, filters.

Planning levels: IEC TR 61000-3-6:2008 Table 2 (harmonics), IEC 61000-3-7 (flicker).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Harmonic analysis ─────────────────────────────────────────────


class HarmonicComponent(BaseModel):
    """One harmonic order: what the WTGs emit and what voltage it causes."""

    order: int = Field(description="Harmonic order h")
    frequency_hz: float = Field(description="h × 50 Hz")
    current_pct: float = Field(0.0, description="WTG current emission [% of rated current]")
    magnitude_pct: float = Field(description="Harmonic voltage at the assessed bus [% of U1]")
    voltage_66kv_pct: float = Field(0.0, description="Harmonic voltage at OSS 66 kV [% of U1]")
    impedance_ohm: float = Field(0.0, description="|Z(h)| seen from OSS 66 kV [Ω]")
    limit_pct: float = Field(description="IEC TR 61000-3-6 planning level at the assessed bus [%]")
    utilisation_pct: float = Field(0.0, description="Voltage / planning level [%]")
    exceeds_limit: bool = Field(description="Voltage above the planning level")


class HarmonicSpectrumRequest(BaseModel):
    """WTG harmonic emission and the bus to assess."""

    harmonic_magnitudes: dict[int, float] = Field(
        description=(
            "WTG current emission {order: % of rated current}, as in an IEC 61400-21 "
            "test report. Orders 2–50."
        ),
        examples=[{5: 1.0, 7: 0.8, 11: 0.5, 13: 0.4, 17: 0.25, 19: 0.2}],
    )
    voltage_kv: float = Field(
        default=400.0,
        ge=0.4,
        le=400.0,
        description="Bus to assess: 400 = PSE POC, 220 = OSS 220 kV, 66 = OSS 66 kV",
    )
    rated_mw: float = Field(default=510.0, ge=15.0, le=5000.0, description="Farm rating [MW]")
    grid_fault_level_mva: float = Field(
        default=10_000.0, ge=100.0, le=50_000.0, description="Grid short-circuit power [MVA]"
    )


class HarmonicAnalysisResponse(BaseModel):
    """Harmonic voltages caused by the farm's emission at one bus."""

    thd_voltage_pct: float = Field(description="THD of the harmonic voltages at the bus [%]")
    thd_current_pct: float = Field(description="THD of one WTG's current emission [%]")
    dominant_harmonic_order: int = Field(description="Order closest to (or over) its limit")
    dominant_harmonic_pct: float
    harmonics: list[HarmonicComponent]
    compliant: bool = Field(description="All orders and THD within the planning levels")
    voltage_level: str = Field(description="LV / MV / HV — selects the planning levels")
    bus: str = Field("", description="Assessed bus")
    thd_limit_pct: float = Field(3.0, description="THD planning level [%]")
    worst_utilisation_pct: float = Field(0.0, description="Highest voltage / limit [%]")
    violations: list[str] = Field(default_factory=list)
    assessment: str = Field(description="PASS / BORDERLINE (> 50 % of a limit) / FAIL")


# ── Resonance scan ────────────────────────────────────────────────


class ResonancePoint(BaseModel):
    """A parallel resonance peak of the network impedance."""

    frequency_hz: float
    impedance_ohm: float
    harmonic_order: float = Field(description="f / 50 Hz")
    amplification: float = Field(1.0, description="|Z(f)| / (h · |Z(50 Hz)|)")
    risk_level: str = Field(description="LOW / MEDIUM (> 3) / HIGH (> 10) amplification")


class ResonanceScanRequest(BaseModel):
    """Network frequency scan."""

    cable_length_km: float = Field(default=108.0, ge=1.0, le=300.0, description="Export cable [km]")
    voltage_kv: float = Field(
        default=66.0, ge=33.0, le=400.0, description="Viewpoint bus: 66, 220 (OSS) or 400 (POC)"
    )
    grid_fault_level_mva: float = Field(
        default=10_000.0, ge=100.0, le=50_000.0, description="Grid short-circuit power [MVA]"
    )
    scan_max_hz: float = Field(default=2500.0, ge=100.0, le=5000.0, description="Upper frequency")


class ResonanceScanResponse(BaseModel):
    """|Z(f)| seen from a bus and its resonances."""

    frequencies_hz: list[float]
    impedances_ohm: list[float] = Field(description="|Z| at the viewpoint bus [Ω]")
    resonance_points: list[ResonancePoint]
    cable_resonant_freq_hz: float = Field(description="Lowest amplified parallel resonance [Hz]")
    critical_harmonics: list[int] = Field(
        description="Characteristic orders within ±1 of a medium/high-risk resonance"
    )
    viewpoint: str = ""
    assessment: str


# ── Flicker ───────────────────────────────────────────────────────


class FlickerRequest(BaseModel):
    """Flicker assessment inputs (IEC 61400-21)."""

    rated_mw: float = Field(default=510.0, ge=1.0, description="Wind farm rated power [MW]")
    grid_fault_level_mva: float = Field(
        default=10_000.0, ge=100.0, description="Grid short-circuit power at the POC [MVA]"
    )
    grid_impedance_angle_deg: float = Field(
        default=84.3, ge=30.0, le=90.0, description="Grid impedance angle ψ_k (R/X 0.1 → 84.3°)"
    )
    annual_switching_operations: int = Field(
        default=1000, ge=1, le=100_000, description="Turbine start/stop operations per year (farm)"
    )


class FlickerResponse(BaseModel):
    """P_st / P_lt at the POC against IEC 61000-3-7 HV-EHV planning levels."""

    pst: float = Field(description="Short-term flicker severity P_st")
    plt: float = Field(description="Long-term flicker severity P_lt")
    pst_limit: float = Field(default=0.8)
    plt_limit: float = Field(default=0.6)
    pst_compliant: bool
    plt_compliant: bool
    pst_continuous: float = 0.0
    pst_switching: float = 0.0
    flicker_coefficient: float = Field(0.0, description="c(ψ_k), illustrative")
    switching_coefficient: float = Field(0.0, description="k_f(ψ_k), illustrative")
    dominant_source: str = Field(description="CONTINUOUS_OPERATION / SWITCHING")
    assessment: str = Field(description="PASS / BORDERLINE / FAIL")


# ── Filter design ─────────────────────────────────────────────────


class FilterDesignRequest(BaseModel):
    """Single-tuned filter at OSS 66 kV."""

    dominant_harmonic_order: int = Field(ge=2, le=50, description="Order to filter")
    harmonic_current_a: float = Field(ge=1.0, description="Harmonic current to absorb [A rms]")
    system_voltage_kv: float = Field(default=66.0, ge=0.4, le=400.0, description="Bus voltage")
    rated_mvar: float = Field(default=10.0, ge=1.0, le=500.0, description="Capacitor bank [MVAR]")


class FilterDesignResponse(BaseModel):
    """Single-tuned LC filter design."""

    harmonic_order: int
    tuned_frequency_hz: float = Field(description="Tuned 3 % below the target order")
    capacitor_mvar: float
    capacitor_uf: float
    reactor_mh: float
    reactor_resistance_ohm: float
    quality_factor: float
    insertion_loss_db: float = Field(description="Attenuation vs the network impedance at h [dB]")
    reactive_contribution_mvar: float = Field(description="Capacitive MVAR at 50 Hz")
    estimated_loss_kw: float
    network_impedance_ohm: float = Field(0.0, description="|Z(h)| of the network at OSS 66 kV")
    assessment: str


# ── Limits reference ──────────────────────────────────────────────


class HarmonicLimitEntry(BaseModel):
    """Planning levels for one harmonic order."""

    order: int
    limit_lv_pct: float = Field(description="LV — IEC 61000-2-2 compatibility level [%]")
    limit_mv_pct: float = Field(description="MV planning level [%]")
    limit_hv_pct: float = Field(description="HV-EHV planning level (≥ 35 kV) [%]")
    characteristic: str = Field(description="ODD_NON_TRIPLE / ODD_TRIPLE / EVEN")


class HarmonicLimitsResponse(BaseModel):
    """IEC TR 61000-3-6 planning levels."""

    standard: str
    thd_limit_lv_pct: float = 8.0
    thd_limit_mv_pct: float = 6.5
    thd_limit_hv_pct: float = 3.0
    entries: list[HarmonicLimitEntry]
    pse_additional_note: str = ""
