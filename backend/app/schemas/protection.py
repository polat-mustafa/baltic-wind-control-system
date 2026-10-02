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
    relay_type: str = Field(
        description="IEC LN class: PTOC / PDIS / PDIF / PTOV / PTUV / PTOF / PTUF"
    )
    location: str
    manufacturer: str
    model: str
    pickup_value: float
    pickup_unit: str
    time_delay_s: float = Field(description="Definite time [s] (0 for IDMT stages)")
    ct_primary_a: float = Field(0.0, description="CT primary current [A] for × In pickups")
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

    current_ka: float = Field(0.0, description="Primary current at 66 kV [kA]")
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
    pickup_ka: float = Field(0.0, description="Pickup in primary kA")
    points: list[TCCCurvePoint] = Field(
        description="Log-spaced (current, time) points from 1.05 × pickup to 40 kA"
    )
    color_hint: str = Field("", description="Unused — the client picks colours")


class FaultMarker(BaseModel):
    """A fault current to mark on the TCC chart."""

    current_ka: float
    label: str


class TCCPlotData(BaseModel):
    """Full TCC plot: multiple relay curves for overlay comparison."""

    study_id: str = Field(description="Study ID or 'default' for current settings")
    curves: list[TCCCurveSeries]
    fault_markers: list[FaultMarker] = Field(
        default_factory=list, description="IEC 60909 max / min fault currents at 66 kV"
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
            "'string_feeder' / 'oss_busbar_66kv' / 'export_cable' / 'oss_busbar_220kv' "
            "(legacy: export_cable_near / _mid / _far, hv_busbar)"
        ),
        examples=["string_feeder"],
    )
    fault_current_ka: float | None = Field(
        default=None,
        ge=0.1,
        le=60.0,
        description="Override of the fault current [kA]; None = IEC 60909 / impedance chain",
    )
    position_pct: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Export cable: % from the onshore end"
    )
    fault_type: str = Field(default="3ph", description="'3ph' or 'ph_ph'")
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
    role: str = Field("", description="main / main 2 / backup for this fault")
    trip_time_ms: float = Field(description="Time from fault inception to relay operation [ms]")
    clearance_time_ms: float = Field(0.0, description="Trip + 60 ms CB break time [ms]")
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
    main_relay: str = Field("", description="Protection of the faulted zone")
    main_clearance_ms: float = Field(0.0, description="Main protection trip + CB break [ms]")
    backup_margin_ms: float | None = Field(None, description="Backup trip − main trip [ms]")
    position_pct: float | None = None
    fault_type: str = "3ph"
    voltage_kv: float = 0.0
    selective: bool = Field(False, description="Main protection first, backup ≥ 300 ms later")
    fast_enough: bool = Field(False, description="Time criterion of this zone met")
    time_limit_s: float = Field(0.0, description="Time limit of the zone's criterion [s]")
    time_criterion: str = ""
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

    Fault clearance time = relay operating time + CB rated break time (60 ms,
    arcing included). Judged against 150 ms — the fault duration PSE's FRT
    profile assumes (a design target, not a PSE clearance rule).
    """

    fault_type: str = Field(
        description="Fault type: '3ph' or 'ph_ph' (earth faults need zero-sequence data)",
        examples=["3ph"],
    )
    fault_location: str = Field(
        description="'string_feeder' / 'oss_busbar_66kv' / 'export_cable' / 'oss_busbar_220kv'",
        examples=["export_cable"],
    )
    fault_impedance_ohm: float = Field(
        default=0.0,
        ge=0.0,
        description="Fault impedance [ohm] (0 = bolted fault)",
    )
    position_pct: float | None = Field(
        default=None, ge=0.0, le=100.0, description="Export cable: % from the onshore end"
    )


class FaultClearanceResponse(BaseModel):
    """Simulated fault clearance sequence and timing."""

    fault_type: str
    fault_location: str
    fault_impedance_ohm: float
    fault_current_ka: float = Field(description="Peak fault current at fault point [kA]")
    first_relay_time_ms: float = Field(description="Time from fault to relay operate signal [ms]")
    cb_open_time_ms: float = Field(description="CB rated break time [ms] (3 cycles, arcing incl.)")
    arc_extinction_time_ms: float = Field(description="0 — included in the break time")
    total_clearance_time_ms: float = Field(description="Main protection trip + CB break [ms]")
    compliant: bool = Field(
        description="True if total clearance time meets the grid code requirement"
    )
    requirement_ms: float = Field(description="Applicable grid code limit [ms]")
    relay_sequence: list[RelayTripEvent]
    assessment: str
