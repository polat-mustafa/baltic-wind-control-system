"""
Pydantic schemas for protection relay coordination API — M05.

Request/response models for:
  - Relay registry queries and setting updates
  - TCC coordination study (graded trip sequence)
  - Fault clearance simulation
  - TCC plot data for log-log chart rendering
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Relay registry ────────────────────────────────────────────────


class ProtectionRelaySchema(BaseModel):
    """A single protection relay with its current settings."""

    id: uuid.UUID
    setting_id: str = Field(description="Registry ID, e.g. 'PTOC-01'")
    relay_type: str = Field(description="IEC LN class: PTOC / PDIS / PTOV / PTUV / PTOF / PTUF")
    location: str
    manufacturer: str
    model: str
    pickup_value: float
    pickup_unit: str
    time_delay_s: float = Field(description="Operating time delay [s]")
    tms: float = Field(description="Time Multiplier Setting (IDMT curves)")
    curve_type: str = Field(description="SI / VI / EI / DT")
    enabled: bool
    standard_ref: str
    description: str


class RelaySettingsUpdate(BaseModel):
    """Partial update for relay settings.

    Only supplied fields are updated — unset fields keep their existing values.

    Warning: Changing relay settings in a live system must be authorised
    by a protection engineer and recorded in the maintenance log. IEC 60255
    requires testing after every setting change.
    """

    pickup_value: float | None = Field(default=None, description="New pickup value")
    time_delay_s: float | None = Field(default=None, description="New time delay [s]")
    tms: float | None = Field(default=None, description="New TMS (IDMT only)")
    curve_type: str | None = Field(default=None, description="SI / VI / EI / DT")
    enabled: bool | None = Field(default=None, description="Enable or disable relay")


# ── TCC plot data ─────────────────────────────────────────────────


class TCCCurvePoint(BaseModel):
    """A single (current, time) point on a TCC curve."""

    current_multiple: float = Field(description="Fault current / pickup current (I/Ip)")
    operating_time_s: float = Field(description="Relay operating time [s]")


class TCCCurveSeries(BaseModel):
    """Time-Current Characteristic curve for one relay."""

    relay_id: str = Field(description="Setting ID, e.g. 'PTOC-01'")
    relay_location: str
    curve_type: str = Field(description="SI / VI / EI / DT")
    pickup_value: float
    pickup_unit: str
    tms: float
    time_delay_s: float
    points: list[TCCCurvePoint] = Field(
        description="50 (current, time) points from 1.05x to 20x pickup for log-log plot"
    )
    color_hint: str = Field(description="Suggested trace color, e.g. '#e74c3c'")


class TCCPlotData(BaseModel):
    """Full TCC plot: multiple relay curves for overlay comparison."""

    study_id: str = Field(description="Study ID or 'default' for current settings")
    curves: list[TCCCurveSeries]
    fault_markers: list[dict[str, float]] = Field(
        default_factory=list,
        description="Optional fault current markers: [{current_ka, fault_label}]",
    )


# ── Coordination study ────────────────────────────────────────────


class CoordinationStudyRequest(BaseModel):
    """Request parameters for a TCC coordination study.

    The study simulates a three-phase fault at the specified location
    and determines which relays operate, in what order, and whether
    all grading margins are adequate.
    """

    fault_location: str = Field(
        description=(
            "Named fault location: 'string_feeder' / 'export_cable_near' / "
            "'export_cable_mid' / 'export_cable_far' / 'hv_busbar'"
        ),
        examples=["string_feeder"],
    )
    fault_current_ka: float = Field(
        ge=0.1,
        le=50.0,
        description="Symmetrical 3-phase fault current [kA]",
        examples=[8.5],
    )
    include_tcc_data: bool = Field(
        default=True,
        description="If True, include TCC plot data in the response",
    )


class GradingPairResult(BaseModel):
    """Selectivity check result for one downstream-upstream relay pair."""

    pair_id: str
    downstream_id: str
    upstream_id: str
    downstream_delay_s: float
    upstream_delay_s: float
    actual_margin_ms: float
    required_margin_ms: float
    selective: bool = Field(description="True if actual margin >= required margin")


class RelayTripEvent(BaseModel):
    """One relay operation in a fault clearance sequence."""

    relay_id: str
    relay_location: str
    trip_time_ms: float = Field(description="Time from fault inception to relay operation [ms]")
    fault_current_multiple: float = Field(description="Fault current / relay pickup")
    operated: bool = Field(description="True if relay actually trips for this fault")


class CoordinationStudyResponse(BaseModel):
    """TCC coordination study result."""

    study_id: str
    fault_location: str
    fault_current_ka: float
    fault_current_description: str = Field(
        description="Human-readable fault location and magnitude description"
    )
    relay_sequence: list[RelayTripEvent] = Field(
        description="All relays in trip time order (fastest first)"
    )
    first_relay: str = Field(description="Setting ID of the fastest operating relay")
    first_relay_time_ms: float
    fully_graded: bool = Field(description="True if all grading pairs are selective")
    grading_results: list[GradingPairResult]
    grading_violations: int = Field(description="Number of pairs with insufficient margin")
    tcc_data: TCCPlotData | None = Field(
        default=None, description="TCC curves if include_tcc_data=True"
    )
    assessment: str = Field(description="Protection engineer assessment: PASS / FAIL / WARNING")
    created_at: datetime


# ── Fault clearance simulation ────────────────────────────────────


class FaultClearanceRequest(BaseModel):
    """Request to simulate a fault and produce a clearance time report.

    Fault clearance time (FCT) is the interval from fault inception to
    the CB arc extinction. IEC 61936-1 requires FCT < 100 ms on 66–220 kV
    systems. PSE requires FCT < 80 ms at 220 kV for Type D generators.
    """

    fault_type: str = Field(
        description=(
            "Fault type: '3ph' (3-phase), 'ph_ph' (phase-phase), "
            "'ph_e' (single phase to earth), 'ph_ph_e' (double phase to earth)"
        ),
        examples=["3ph"],
    )
    fault_location: str = Field(
        description="Named location: 'string_feeder' / 'export_cable' / 'hv_busbar'",
        examples=["export_cable"],
    )
    fault_impedance_ohm: float = Field(
        default=0.0,
        ge=0.0,
        description="Fault impedance [ohm] (0 = bolted fault)",
    )


class FaultClearanceResponse(BaseModel):
    """Simulated fault clearance sequence and timing."""

    fault_type: str
    fault_location: str
    fault_impedance_ohm: float
    fault_current_ka: float = Field(description="Peak fault current at fault point [kA]")
    first_relay_time_ms: float = Field(description="Time from fault to relay operate signal [ms]")
    cb_open_time_ms: float = Field(
        description="Circuit breaker opening time [ms] (IEC 62271-100: ~60 ms)"
    )
    arc_extinction_time_ms: float = Field(
        description="Arc extinction time [ms] (CB opening + 1-2 cycles)"
    )
    total_clearance_time_ms: float = Field(
        description=(
            "Total fault clearance time: relay + CB + arc [ms]. "
            "Requirement: < 80 ms (PSE 220 kV) or < 100 ms (66 kV)"
        )
    )
    compliant: bool = Field(
        description="True if total clearance time meets the grid code requirement"
    )
    requirement_ms: float = Field(description="Applicable grid code limit [ms]")
    relay_sequence: list[RelayTripEvent]
    assessment: str
