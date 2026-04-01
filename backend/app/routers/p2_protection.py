"""
Protection relay coordination API endpoints — M05.

Endpoints
---------
GET  /api/v1/grid/protection/relays                     — List all relays + settings
PUT  /api/v1/grid/protection/relays/{setting_id}/settings — Update relay settings
POST /api/v1/grid/protection/coordination-study         — Run TCC coordination study
POST /api/v1/grid/protection/fault-clearance            — Simulate fault clearance
GET  /api/v1/grid/protection/tcc                        — Get TCC plot data

Physics — Protection Coordination
-----------------------------------
Protection coordination (also called 'grading' or 'selectivity') ensures
that for any fault, the nearest upstream relay clears the fault before
backup relays operate. This is achieved through deliberate time delays:

  Downstream relay: 0.5 s → Upstream relay: 0.8 s → margin: 300 ms

The margin accounts for:
  - CB operating time (~60 ms, IEC 62271-100)
  - Relay timing tolerances (~5% of operating time)
  - CT saturation effects on relay reset time

IEC 60255-151:2009 defines five standard IDMT curve shapes. We implement
SI (Standard Inverse), VI (Very Inverse), EI (Extremely Inverse), and DT
(Definite Time). The TCC endpoints provide data for log-log Plotly charts.

Standards: IEC 60255-151/-121/-127/-181, IEC 61936-1, PSE IRiESP.
"""

from __future__ import annotations

import uuid as _uuid
from datetime import UTC, datetime

from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException, Path, Query

from app.schemas.protection import (
    CoordinationStudyRequest,
    CoordinationStudyResponse,
    FaultClearanceRequest,
    FaultClearanceResponse,
    GradingPairResult,
    ProtectionRelaySchema,
    RelaySettingsUpdate,
    RelayTripEvent,
    TCCCurvePoint,
    TCCCurveSeries,
    TCCPlotData,
)
from app.services.p5 import protection_relay as svc

router = APIRouter(tags=["M05 Protection Relay Coordination"])

# In-memory relay setting overrides (supplements the immutable registry).
# In production these would be persisted to the protection_relay DB table.
_relay_overrides: dict[str, dict[str, Any]] = {}


def _build_relay_schema(setting_id: str) -> ProtectionRelaySchema:
    """Build a ProtectionRelaySchema from the registry + any overrides."""
    settings_map = {s.setting_id: s for s in svc.OSS_RELAY_SETTINGS}
    if setting_id not in settings_map:
        raise HTTPException(status_code=404, detail=f"Relay '{setting_id}' not found")

    s = settings_map[setting_id]
    overrides = _relay_overrides.get(setting_id, {})

    return ProtectionRelaySchema(
        id=_uuid.uuid5(_uuid.NAMESPACE_DNS, f"protection-relay-{setting_id}"),
        setting_id=s.setting_id,
        relay_type=s.function.value,
        location=s.location,
        manufacturer="ABB",
        model="REL670",
        pickup_value=float(overrides.get("pickup_value", s.pickup_value)),
        pickup_unit=s.pickup_unit,
        time_delay_s=float(overrides.get("time_delay_s", s.time_delay)),
        tms=float(overrides.get("tms", 0.1)),
        curve_type=str(overrides.get("curve_type", "SI" if s.pickup_unit == "xIn" else "DT")),
        enabled=bool(overrides.get("enabled", True)),
        standard_ref=s.standard,
        description=s.description,
    )


@router.get(
    "/protection/relays",
    response_model=list[ProtectionRelaySchema],
    summary="List all protection relays",
)
async def list_relays(
    relay_type: str | None = Query(
        default=None,
        description="Filter by IEC LN class: PTOC / PDIS / PTOV / PTUV / PTOF / PTUF",
    ),
) -> list[ProtectionRelaySchema]:
    """Return all protection relay settings from the OSS registry.

    The Baltic Wind Alpha OSS has 8 protection relay settings:
    - 2 PTOC (time overcurrent) — string feeder + incomer backup
    - 2 PDIS (distance) — export cable Zone 1 + Zone 2
    - 1 PTOV (overvoltage) — 220 kV bus
    - 1 PTUV (undervoltage) — 220 kV bus
    - 1 PTOF (overfrequency) — 220 kV bus
    - 1 PTUF (underfrequency) — 220 kV bus

    Settings are cross-checked against PSE IRiESP and ENTSO-E NC RfG
    Type D requirements during every commissioning SAT.
    """
    results = [_build_relay_schema(s.setting_id) for s in svc.OSS_RELAY_SETTINGS]
    if relay_type:
        results = [r for r in results if r.relay_type == relay_type.upper()]
    return results


@router.put(
    "/protection/relays/{setting_id}/settings",
    response_model=ProtectionRelaySchema,
    summary="Update relay settings",
)
async def update_relay_settings(
    setting_id: Annotated[str, Path(description="Relay setting ID, e.g. 'PTOC-01'")],
    body: Annotated[RelaySettingsUpdate, Body()],
) -> ProtectionRelaySchema:
    """Update protection relay settings (in-memory override).

    Only the supplied fields are updated — unset fields keep their existing
    values. Changes are stored as in-memory overrides on top of the
    immutable registry; they are lost on server restart.

    Warning: In a real substation, relay setting changes require:
    1. Protection engineer sign-off
    2. Coordination study re-run to verify selectivity
    3. Secondary injection test to verify new setting
    4. Recording in the protection setting file database

    After updating settings, run POST /protection/coordination-study to
    verify that grading margins remain adequate.
    """
    settings_map = {s.setting_id: s for s in svc.OSS_RELAY_SETTINGS}
    if setting_id not in settings_map:
        raise HTTPException(status_code=404, detail=f"Relay '{setting_id}' not found")

    overrides = _relay_overrides.setdefault(setting_id, {})
    if body.pickup_value is not None:
        overrides["pickup_value"] = body.pickup_value
    if body.time_delay_s is not None:
        overrides["time_delay_s"] = body.time_delay_s
    if body.tms is not None:
        overrides["tms"] = body.tms
    if body.curve_type is not None:
        overrides["curve_type"] = body.curve_type
    if body.enabled is not None:
        overrides["enabled"] = body.enabled

    return _build_relay_schema(setting_id)


@router.post(
    "/protection/coordination-study",
    response_model=CoordinationStudyResponse,
    summary="Run TCC coordination study",
)
async def run_coordination_study(
    body: CoordinationStudyRequest,
) -> CoordinationStudyResponse:
    """Run a Time-Current Characteristic coordination study.

    Simulates a 3-phase fault at the specified location and verifies
    that the nearest relay operates first with adequate grading margins
    to the upstream backup relay.

    Fault locations:
    - string_feeder     : 66 kV string cable, near-end fault (8.5 kA)
    - export_cable_near : 220 kV export cable, 5 km from OSS (7.2 kA)
    - export_cable_mid  : 220 kV export cable, 22 km midpoint (5.1 kA)
    - export_cable_far  : 220 kV export cable, 40 km from OSS (2.8 kA)
    - hv_busbar         : 220 kV busbar fault (12.4 kA)

    Grading requirements:
    - PTOC (overcurrent): minimum 300 ms margin between stages
    - PDIS (distance): minimum 400 ms margin between zones
    """
    result = svc.run_coordination_study(
        fault_location=body.fault_location,
        fault_current_ka=body.fault_current_ka,
    )

    relay_sequence = [
        RelayTripEvent(
            relay_id=ev["relay_id"],
            relay_location=ev["relay_location"],
            trip_time_ms=ev["trip_time_ms"],
            fault_current_multiple=ev["fault_current_multiple"],
            operated=ev["operated"],
        )
        for ev in result["relay_sequence"]
    ]

    grading_results = [
        GradingPairResult(
            pair_id=g["pair_id"],
            downstream_id=g["downstream_id"],
            upstream_id=g["upstream_id"],
            downstream_delay_s=g["downstream_delay_s"],
            upstream_delay_s=g["upstream_delay_s"],
            actual_margin_ms=g["actual_margin_ms"],
            required_margin_ms=g["required_margin_ms"],
            selective=g["selective"],
        )
        for g in result["grading_results"]
    ]

    tcc_data: TCCPlotData | None = None
    if body.include_tcc_data:
        curves_raw = svc.get_tcc_plot_data()
        tcc_curves = [
            TCCCurveSeries(
                relay_id=c["relay_id"],
                relay_location=c["location"],
                curve_type=c["curve_type"],
                pickup_value=c["pickup_value"],
                pickup_unit=c["pickup_unit"],
                tms=c["tms"],
                time_delay_s=c["time_delay_s"],
                points=[
                    TCCCurvePoint(
                        current_multiple=p["current_multiple"],
                        operating_time_s=p["time_s"],
                    )
                    for p in c["points"]
                ],
                color_hint=c["color_hint"],
            )
            for c in curves_raw
        ]
        tcc_data = TCCPlotData(
            study_id=result["study_id"],
            curves=tcc_curves,
        )

    return CoordinationStudyResponse(
        study_id=result["study_id"],
        fault_location=result["fault_location"],
        fault_current_ka=result["fault_current_ka"],
        fault_current_description=(
            f"{result['fault_location'].replace('_', ' ').title()} — "
            f"{result['fault_current_ka']:.1f} kA 3-phase fault"
        ),
        relay_sequence=relay_sequence,
        first_relay=result["first_relay"],
        first_relay_time_ms=result["first_relay_time_ms"],
        fully_graded=result["fully_graded"],
        grading_results=grading_results,
        grading_violations=result["grading_violations"],
        tcc_data=tcc_data,
        assessment=result["assessment"],
        created_at=datetime.now(UTC),
    )


@router.post(
    "/protection/fault-clearance",
    response_model=FaultClearanceResponse,
    summary="Simulate fault clearance",
)
async def simulate_fault_clearance(
    body: FaultClearanceRequest,
) -> FaultClearanceResponse:
    """Simulate complete fault clearance including CB operation.

    Fault clearance time (FCT) = relay operate time + CB opening time + arc extinction.

    IEC 61936-1 requires FCT < 100 ms for 66 kV systems.
    PSE IRiESP requires FCT < 80 ms at 220 kV for Type D generators
    (the 510 MW Baltic Wind Alpha wind farm exceeds 75 MW — Type D).

    CB opening time: 60 ms per IEC 62271-100 for medium/high-voltage switchgear.
    Arc extinction: ~20 ms (1 power cycle) after CB contacts part.
    """
    result = svc.simulate_fault_clearance(
        fault_type=body.fault_type,
        fault_location=body.fault_location,
        fault_impedance_ohm=body.fault_impedance_ohm,
    )

    relay_sequence = [
        RelayTripEvent(
            relay_id=ev["relay_id"],
            relay_location=ev["relay_location"],
            trip_time_ms=ev["trip_time_ms"],
            fault_current_multiple=ev["fault_current_multiple"],
            operated=ev["operated"],
        )
        for ev in result["relay_sequence"]
    ]

    return FaultClearanceResponse(
        fault_type=result["fault_type"],
        fault_location=result["fault_location"],
        fault_impedance_ohm=result["fault_impedance_ohm"],
        fault_current_ka=result["fault_current_ka"],
        first_relay_time_ms=result["first_relay_time_ms"],
        cb_open_time_ms=result["cb_open_time_ms"],
        arc_extinction_time_ms=result["arc_extinction_time_ms"],
        total_clearance_time_ms=result["total_clearance_time_ms"],
        compliant=result["compliant"],
        requirement_ms=result["requirement_ms"],
        relay_sequence=relay_sequence,
        assessment=result["assessment"],
    )


@router.get(
    "/protection/tcc",
    response_model=TCCPlotData,
    summary="Get TCC plot data",
)
async def get_tcc_data(
    relay_ids: list[str] | None = Query(
        default=None,
        description="Filter to specific relay IDs, e.g. PTOC-01,PTOC-02",
    ),
) -> TCCPlotData:
    """Return Time-Current Characteristic curve data for Plotly rendering.

    Each relay returns 50 (current, time) points on a log-log scale
    from 1.05× to 20× pickup current. The curves are rendered on
    log-log axes with current (A or xIn) on the x-axis and time (s)
    on the y-axis.

    Selectivity is visible on the TCC chart as vertical separation between
    curves — downstream curves must be entirely below upstream curves for
    all fault currents that both relays can 'see'.

    Physics: On a log-log plot, IEC Standard Inverse curves appear as
    straight lines. A steeper line (Very Inverse, Extremely Inverse) provides
    more discrimination at high fault currents — useful when fault current
    varies widely (e.g. at different distances along a long cable).
    """
    curves_raw = svc.get_tcc_plot_data(relay_ids)
    tcc_curves = [
        TCCCurveSeries(
            relay_id=c["relay_id"],
            relay_location=c["location"],
            curve_type=c["curve_type"],
            pickup_value=c["pickup_value"],
            pickup_unit=c["pickup_unit"],
            tms=c["tms"],
            time_delay_s=c["time_delay_s"],
            points=[
                TCCCurvePoint(
                    current_multiple=p["current_multiple"],
                    operating_time_s=p["time_s"],
                )
                for p in c["points"]
            ],
            color_hint=c["color_hint"],
        )
        for c in curves_raw
    ]
    return TCCPlotData(
        study_id="default",
        curves=tcc_curves,
    )
