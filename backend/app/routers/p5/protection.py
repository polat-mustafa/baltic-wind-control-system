"""P5 sub-router: Protection relay settings and selectivity verification."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.commissioning import (
    GradingPairSchema,
    GradingResultSchema,
    ProtectionCoordinationSchema,
    RelaySettingSchema,
)
from app.services.p5.programme_store import protection_results
from app.services.p5.protection_relay import (
    GRADING_PAIRS,
    SelectivityVerdict,
    get_relay_settings,
    verify_selectivity,
)

router = APIRouter()


@router.get("/protection/settings", response_model=list[RelaySettingSchema])
async def get_protection_settings() -> list[RelaySettingSchema]:
    """List all OSS protection relay settings."""
    return [
        RelaySettingSchema(
            setting_id=s.setting_id,
            function=s.function.value,
            description=s.description,
            pickup_value=s.pickup_value,
            pickup_unit=s.pickup_unit,
            time_delay=s.time_delay,
            location=s.location,
            standard=s.standard,
        )
        for s in get_relay_settings()
    ]


@router.post(
    "/protection/verify-selectivity",
    response_model=ProtectionCoordinationSchema,
)
async def verify_selectivity_endpoint() -> ProtectionCoordinationSchema:
    """Run protection coordination check across all grading pairs."""
    settings = get_relay_settings()
    results = verify_selectivity()

    protection_results.clear()
    protection_results.extend(results)

    all_selective = all(r.verdict == SelectivityVerdict.SELECTIVE for r in results)

    return ProtectionCoordinationSchema(
        settings=[
            RelaySettingSchema(
                setting_id=s.setting_id,
                function=s.function.value,
                description=s.description,
                pickup_value=s.pickup_value,
                pickup_unit=s.pickup_unit,
                time_delay=s.time_delay,
                location=s.location,
                standard=s.standard,
            )
            for s in settings
        ],
        grading_pairs=[
            GradingPairSchema(
                pair_id=gp.pair_id,
                downstream_id=gp.downstream_id,
                upstream_id=gp.upstream_id,
                required_margin_ms=gp.required_margin_ms,
                description=gp.description,
            )
            for gp in GRADING_PAIRS
        ],
        results=[
            GradingResultSchema(
                pair_id=r.pair_id,
                downstream_id=r.downstream_id,
                upstream_id=r.upstream_id,
                downstream_delay_s=r.downstream_delay_s,
                upstream_delay_s=r.upstream_delay_s,
                actual_margin_ms=r.actual_margin_ms,
                required_margin_ms=r.required_margin_ms,
                verdict=r.verdict.value,
            )
            for r in results
        ],
        all_selective=all_selective,
    )
