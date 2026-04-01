"""
Pydantic schemas for power quality and harmonics API — M06 (IEC 61000).
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Harmonic analysis ─────────────────────────────────────────────


class HarmonicComponent(BaseModel):
    """A single harmonic order with its magnitude."""

    order: int = Field(description="Harmonic order (1=fundamental, 2=2nd, ..., 50=50th)")
    magnitude_pct: float = Field(description="Magnitude as % of fundamental")
    frequency_hz: float = Field(description="Frequency [Hz] = order x 50 Hz")
    exceeds_limit: bool = Field(
        description="True if magnitude exceeds IEC 61000-3-6 planning level"
    )
    limit_pct: float = Field(description="IEC 61000-3-6 planning level for this order [%]")


class HarmonicSpectrumRequest(BaseModel):
    """Request body for harmonic analysis."""

    harmonic_magnitudes: dict[int, float] = Field(
        description=(
            "Harmonic spectrum as {order: magnitude_pct}. "
            "Orders 2-50, magnitudes as % of fundamental. "
            "Example: {5: 3.5, 7: 2.8, 11: 1.9, 13: 1.4}"
        ),
        examples=[{5: 3.5, 7: 2.8, 11: 1.9, 13: 1.4, 17: 0.8, 19: 0.6}],
    )
    voltage_kv: float = Field(
        default=66.0,
        ge=0.4,
        le=400.0,
        description="System voltage [kV] — used to select IEC 61000-3-6 voltage level",
    )
    rated_mw: float = Field(
        default=510.0,
        ge=1.0,
        le=5000.0,
        description="Rated active power of the installation [MW]",
    )


class HarmonicAnalysisResponse(BaseModel):
    """Harmonic distortion analysis results."""

    thd_voltage_pct: float = Field(
        description=(
            "Total Harmonic Distortion (voltage): "
            "THD_V = sqrt(sum(V_h^2)) / V_1 x 100 [%]. "
            "IEC 61000-3-6 limit: 8% at MV, 3% at HV"
        )
    )
    thd_current_pct: float = Field(description="THD of current spectrum [%]")
    dominant_harmonic_order: int = Field(description="Harmonic order with highest magnitude")
    dominant_harmonic_pct: float
    harmonics: list[HarmonicComponent]
    compliant: bool = Field(description="True if all harmonics within IEC 61000-3-6 limits")
    voltage_level: str = Field(description="LV / MV / HV — determines applicable limits")
    violations: list[str] = Field(
        default_factory=list,
        description="List of harmonic orders exceeding planning levels",
    )
    assessment: str = Field(description="PASS / FAIL / BORDERLINE")


# ── Resonance scan ────────────────────────────────────────────────


class ResonancePoint(BaseModel):
    """A parallel resonance peak in the network impedance scan."""

    frequency_hz: float
    impedance_ohm: float
    harmonic_order: float = Field(description="Equivalent harmonic order (freq/50 Hz)")
    risk_level: str = Field(description="LOW / MEDIUM / HIGH — risk of harmonic amplification")


class ResonanceScanRequest(BaseModel):
    """Parameters for a network frequency scan."""

    cable_length_km: float = Field(
        default=45.0,
        ge=1.0,
        le=300.0,
        description="Export cable length [km]",
    )
    voltage_kv: float = Field(
        default=220.0,
        ge=33.0,
        le=400.0,
        description="Cable voltage [kV]",
    )
    grid_fault_level_mva: float = Field(
        default=2500.0,
        ge=100.0,
        le=50000.0,
        description="Grid short-circuit level at POC [MVA]",
    )
    scan_max_hz: float = Field(
        default=2500.0,
        ge=100.0,
        le=5000.0,
        description="Maximum frequency for scan [Hz]",
    )


class ResonanceScanResponse(BaseModel):
    """Frequency scan result showing impedance vs frequency."""

    frequencies_hz: list[float] = Field(description="Scan frequency points [Hz]")
    impedances_ohm: list[float] = Field(description="Network impedance magnitude [ohm]")
    resonance_points: list[ResonancePoint]
    cable_resonant_freq_hz: float = Field(
        description=(
            "Primary cable resonance frequency: f_r = 1 / (2*pi*sqrt(L*C)) "
            "where L, C are cable distributed parameters"
        )
    )
    critical_harmonics: list[int] = Field(
        description="Harmonic orders close to resonance peaks (amplification risk)"
    )
    assessment: str


# ── Flicker ───────────────────────────────────────────────────────


class FlickerRequest(BaseModel):
    """Parameters for flicker calculation (IEC 61000-3-7 / IEC 61400-21)."""

    rated_mw: float = Field(default=510.0, ge=1.0, description="Wind farm rated power [MW]")
    grid_fault_level_mva: float = Field(
        default=2500.0, ge=100.0, description="Grid short-circuit level [MVA]"
    )
    grid_impedance_angle_deg: float = Field(
        default=75.0,
        ge=30.0,
        le=90.0,
        description="Grid impedance angle [degrees] (typically 75-85 for transmission)",
    )
    annual_switching_operations: int = Field(
        default=200,
        ge=1,
        le=10000,
        description="Estimated annual turbine switching operations",
    )


class FlickerResponse(BaseModel):
    """Flicker emission assessment (IEC 61000-3-7)."""

    pst: float = Field(
        description=(
            "Short-term flicker severity Pst (10-minute measurement). "
            "IEC 61000-3-7 limit: Pst <= 1.0 (planning level)"
        )
    )
    plt: float = Field(
        description=(
            "Long-term flicker severity Plt (2-hour measurement). "
            "IEC 61000-3-7 limit: Plt <= 0.65 (planning level)"
        )
    )
    pst_limit: float = Field(default=1.0)
    plt_limit: float = Field(default=0.65)
    pst_compliant: bool
    plt_compliant: bool
    dominant_source: str = Field(
        description="Main flicker source: TOWER_SHADOW / WIND_TURBULENCE / SWITCHING"
    )
    assessment: str = Field(description="PASS / FAIL / BORDERLINE")


# ── Filter design ─────────────────────────────────────────────────


class FilterDesignRequest(BaseModel):
    """Parameters for passive harmonic filter sizing."""

    dominant_harmonic_order: int = Field(
        ge=2,
        le=50,
        description="Harmonic order to filter (typically 5th or 7th for VSC converters)",
    )
    harmonic_current_a: float = Field(
        ge=1.0,
        description="Peak harmonic current at the dominant order [A rms]",
    )
    system_voltage_kv: float = Field(
        default=66.0,
        ge=0.4,
        le=400.0,
        description="System voltage [kV]",
    )
    rated_mvar: float = Field(
        default=10.0,
        ge=1.0,
        le=500.0,
        description="Desired filter reactive power contribution [MVAR]",
    )


class FilterDesignResponse(BaseModel):
    """Passive single-tuned LC harmonic filter design."""

    harmonic_order: int
    tuned_frequency_hz: float = Field(
        description="Filter tuned frequency (slightly below harmonic to avoid detuning)"
    )
    capacitor_mvar: float = Field(description="Capacitor bank rating [MVAR]")
    capacitor_uf: float = Field(description="Capacitance per phase [uF]")
    reactor_mh: float = Field(description="Reactor inductance per phase [mH]")
    reactor_resistance_ohm: float = Field(
        description="Reactor resistance (quality factor Q = wL/R)"
    )
    quality_factor: float = Field(description="Filter quality factor Q (target: 30-80)")
    insertion_loss_db: float = Field(
        description="Insertion loss at tuned frequency [dB] (target: > 20 dB)"
    )
    reactive_contribution_mvar: float = Field(
        description="Fundamental frequency reactive power contribution [MVAR]"
    )
    estimated_loss_kw: float = Field(description="Continuous filter losses [kW]")
    assessment: str


# ── Limits reference ──────────────────────────────────────────────


class HarmonicLimitEntry(BaseModel):
    """Planning level for one harmonic order from IEC 61000-3-6."""

    order: int
    limit_lv_pct: float = Field(description="LV planning level [%]")
    limit_mv_pct: float = Field(description="MV planning level [%]")
    limit_hv_pct: float = Field(description="HV planning level (>= 35 kV) [%]")
    characteristic: str = Field(description="ODD_NON_TRIPLE / ODD_TRIPLE / EVEN — harmonic family")


class HarmonicLimitsResponse(BaseModel):
    """IEC 61000-3-6 harmonic planning levels for voltage distortion."""

    standard: str = Field(default="IEC 61000-3-6:2008 + Amendment 1:2018")
    thd_limit_lv_pct: float = Field(default=8.0, description="THD limit at LV [%]")
    thd_limit_mv_pct: float = Field(default=8.0, description="THD limit at MV [%]")
    thd_limit_hv_pct: float = Field(default=3.0, description="THD limit at HV >= 35 kV [%]")
    entries: list[HarmonicLimitEntry]
    pse_additional_note: str = Field(
        default=(
            "PSE (Polish TSO) applies IEC 61000-3-6 HV limits at the 220 kV POC. "
            "THD_V <= 3%, individual harmonics as per HV column."
        )
    )
