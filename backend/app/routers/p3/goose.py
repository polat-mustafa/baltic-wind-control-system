"""P3 sub-router: GOOSE fault simulation and retransmission endpoints."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.scada import (
    ComplianceCheckSchema,
    FaultScenarioRequest,
    FaultScenarioSummary,
    FaultSimulationResponse,
    GOOSEMessageSchema,
    ProtectionEventSchema,
    RetransmissionRequest,
    RetransmissionResponse,
)
from app.services.p3 import soe_recorder
from app.services.p3.goose_simulation import (
    FAULT_CLEARANCE_MAX_MS,
    GOOSE_MAX_LATENCY_MS,
    FaultType,
    calculate_retransmission_schedule,
    create_scenario,
    get_available_scenarios,
    simulate_fault,
)

router = APIRouter()


@router.get("/goose/scenarios", response_model=list[FaultScenarioSummary])
async def list_fault_scenarios() -> list[FaultScenarioSummary]:
    """List all available fault scenarios for GOOSE simulation.

    Returns the fault type and description for each available scenario.
    Use the fault_type value in the simulation request.
    """
    scenarios = get_available_scenarios()
    return [
        FaultScenarioSummary(
            fault_type=s["fault_type"],
            description=s["description"],
        )
        for s in scenarios
    ]


@router.post("/goose/simulate", response_model=FaultSimulationResponse)
async def run_fault_simulation(
    request: FaultScenarioRequest, db: AsyncSession = Depends(get_session)
) -> FaultSimulationResponse:
    """Run a GOOSE protection fault simulation.

    Simulates a complete protection sequence from fault inception through
    SCADA alarm, including GOOSE message publication and IEC compliance
    verification.

    The timeline is deterministic — identical inputs always produce
    identical outputs. This enables reproducible testing and education.
    The protection operation and the breaker opening are written to the SOE
    log with their millisecond offsets from fault inception.
    """
    try:
        fault_type = FaultType(request.fault_type)
    except ValueError as err:
        valid_types = [ft.value for ft in FaultType]
        raise HTTPException(
            status_code=422,
            detail=f"Invalid fault_type: '{request.fault_type}'. Valid types: {valid_types}",
        ) from err

    scenario = create_scenario(fault_type)
    result = simulate_fault(scenario)

    t0 = datetime.now(UTC)
    soe_types = {
        "protection_detects": ("PROTECTION_TRIP", "CRITICAL"),
        "breaker_open": ("CB_OPERATION", "HIGH"),
    }
    for e in result.events:
        if e.event_type.value in soe_types:
            event_type, severity = soe_types[e.event_type.value]
            await soe_recorder.record_event(
                db,
                event_type=event_type,
                source_device=e.ied_name or scenario.location.value,
                description=f"{scenario.protection_function.value} · {e.description}",
                severity=severity,
                timestamp_utc=t0 + timedelta(milliseconds=e.timestamp_ms),
            )

    events = [
        ProtectionEventSchema(
            event_type=e.event_type.value,
            timestamp_ms=e.timestamp_ms,
            description=e.description,
            ied_name=e.ied_name,
        )
        for e in result.events
    ]

    goose_messages = [
        GOOSEMessageSchema(
            gocb_ref=m.gocb_ref,
            dat_set=m.dat_set,
            go_id=m.go_id,
            st_num=m.st_num,
            sq_num=m.sq_num,
            all_data=m.all_data,
            timestamp=m.timestamp,
            app_id=m.app_id,
            mac_address=m.mac_address,
            vlan_id=m.vlan_id,
        )
        for m in result.goose_messages
    ]

    compliance = ComplianceCheckSchema(
        goose_latency_ms=result.goose_latency_ms,
        goose_max_allowed_ms=GOOSE_MAX_LATENCY_MS,
        goose_compliant=result.goose_compliant,
        total_clearance_ms=result.total_clearance_ms,
        clearance_max_allowed_ms=FAULT_CLEARANCE_MAX_MS,
        clearance_compliant=result.clearance_compliant,
    )

    return FaultSimulationResponse(
        fault_type=scenario.fault_type.value,
        location=scenario.location.value,
        fault_current_ka=round(scenario.fault_current_ka, 2),
        load_current_ka=round(scenario.load_current_ka, 3),
        protection_function=scenario.protection_function.value,
        description=scenario.description,
        events=events,
        goose_messages=goose_messages,
        compliance=compliance,
        retransmission_schedule_ms=list(result.retransmission_schedule_ms),
    )


@router.post("/goose/retransmission", response_model=RetransmissionResponse)
async def calculate_goose_retransmission(
    request: RetransmissionRequest,
) -> RetransmissionResponse:
    """Calculate a GOOSE retransmission schedule per IEC 61850-8-1 §15.2.2.

    Returns both cumulative timestamps and individual interval durations
    for the exponential backoff retransmission scheme.
    """
    schedule = calculate_retransmission_schedule(
        min_time_ms=request.min_time_ms,
        max_time_ms=request.max_time_ms,
        num_retransmissions=request.num_retransmissions,
    )

    # Calculate individual intervals from cumulative schedule
    intervals = [schedule[0]]
    for i in range(1, len(schedule)):
        intervals.append(schedule[i] - schedule[i - 1])

    return RetransmissionResponse(
        min_time_ms=request.min_time_ms,
        max_time_ms=request.max_time_ms,
        num_retransmissions=request.num_retransmissions,
        schedule_ms=list(schedule),
        intervals_ms=intervals,
    )
