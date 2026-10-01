"""
Multi-farm comparison API endpoints — M04.

Endpoints
---------
POST   /api/v1/wind/farms                    — Create farm configuration
GET    /api/v1/wind/farms                    — List configurations
GET    /api/v1/wind/farms/{id}               — Get configuration
DELETE /api/v1/wind/farms/{id}               — Delete configuration
POST   /api/v1/wind/farms/compare            — Run comparison (2-4 farms, by id or inline)
GET    /api/v1/wind/farms/compare/{id}       — Get comparison results

Enables side-by-side comparison of up to 4 wind farm designs, covering:
- AEP (Weibull × power curve integration, P50/P90 exceedance)
- LCOE (FCR-based, IEC 61400-15 methodology)
- Grid integration (cable losses, reactive range, NC RfG compliance)

Decision: forms-based configuration (not drag-drop canvas) to maintain
educational focus. Each parameter is documented with its physical meaning.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.schemas.farm_config import (
    FarmComparisonRequest,
    FarmComparisonResponse,
    FarmConfigCreate,
    FarmConfigResponse,
)
from app.services.p1 import farm_comparison as svc

router = APIRouter(tags=["M04 Multi-Farm Comparison"])


@router.post(
    "/farms",
    response_model=FarmConfigResponse,
    status_code=201,
    summary="Create farm configuration",
)
async def create_farm(body: FarmConfigCreate) -> FarmConfigResponse:
    """Create a new farm configuration for comparison.

    Define a farm design by specifying key parameters:

    **Turbine parameters:**
    - turbine_model     : turbine designation (affects power curve shape)
    - turbine_count     : number of turbines in the array
    - turbine_rated_mw  : single turbine rated capacity

    **Electrical system:**
    - array_voltage_kv  : 33/66/132 kV (higher = lower I²R losses)
    - export_voltage_kv : 220 kV HVAC or 400 kV for large distances
    - export_length_km  : distance from OSS to onshore grid connection

    **Layout:**
    - turbine_spacing_d : grid spacing in rotor diameters (drives wake loss)

    **Wind resource:**
    - mean_wind_speed_ms: hub-height mean wind speed
    - weibull_k         : distribution shape (k=2.0 = Rayleigh)

    **Economics:**
    - capex_m_eur_per_mw: installed CAPEX in M€/MW
    - opex_k_eur_per_mw_year: annual O&M in k€/MW/year
    - discount_rate_pct : WACC used in LCOE calculation
    """
    return svc.create_farm(body)


@router.get(
    "/farms",
    response_model=list[FarmConfigResponse],
    summary="List farm configurations",
)
async def list_farms() -> list[FarmConfigResponse]:
    """Return all stored farm configurations, most recent first."""
    return svc.list_farms()


@router.get(
    "/farms/compare/{comparison_id}",
    response_model=FarmComparisonResponse,
    summary="Get comparison results",
)
async def get_comparison(comparison_id: uuid.UUID) -> FarmComparisonResponse:
    """Retrieve a previously computed comparison by ID.

    Comparison results are cached in memory (server restart clears the cache).
    Use this to fetch results without re-running the full calculation.
    """
    result = svc.get_comparison(comparison_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Comparison {comparison_id} not found")
    return result


@router.get(
    "/farms/{farm_id}",
    response_model=FarmConfigResponse,
    summary="Get farm configuration",
)
async def get_farm(farm_id: uuid.UUID) -> FarmConfigResponse:
    """Return a single farm configuration by ID."""
    farm = svc.get_farm(farm_id)
    if farm is None:
        raise HTTPException(status_code=404, detail=f"Farm configuration {farm_id} not found")
    return farm


@router.delete(
    "/farms/{farm_id}",
    status_code=204,
    summary="Delete farm configuration",
)
async def delete_farm(farm_id: uuid.UUID) -> None:
    """Delete a farm configuration.

    Deletion is permanent. Any comparison results referencing this farm
    remain in the cache but the farm config is no longer retrievable.
    """
    if not svc.delete_farm(farm_id):
        raise HTTPException(status_code=404, detail=f"Farm configuration {farm_id} not found")


@router.post(
    "/farms/compare",
    response_model=FarmComparisonResponse,
    summary="Run multi-farm comparison",
)
async def run_comparison(body: FarmComparisonRequest) -> FarmComparisonResponse:
    """Run a side-by-side comparison of 2–4 farm configurations.

    Pass either ``farm_ids`` (stored configurations) or ``farms`` (inline,
    not stored). Returns three result tables:

    **AEP comparison:**
    - Gross AEP, Net AEP (multiplicative loss cascade), P50/P90 exceedance
    - Wake loss % (PyWake BPA Gaussian on a grid at the given spacing),
      blockage (Nygaard 2020), energy-weighted electrical loss, availability
    - Net capacity factor
    - Uncertainty model: IEC 61400-15 RSS method, 6.89% total sigma

    **LCOE comparison:**
    - Levelised Cost of Energy [€/MWh] — Fixed Charge Rate method
    - Total CAPEX and annual OPEX
    - Lifetime revenue at the specified electricity price
    - Simple payback period and approximate IRR

    **Grid integration comparison:**
    - Export circuits needed (1000 mm² Cu thermal rating), I²R losses at rated
      and energy-weighted over the year (loss load factor)
    - Export cable charging Q = ωCU²L (sizes the shunt reactors — see P2)
    - Export circuit utilisation at rated farm output

    Reactive capability and NC RfG compliance need a load flow — use P2.
    """
    try:
        farms = svc.resolve_farms(body.farm_ids, body.farms)
        return svc.run_comparison(farms, body.electricity_price_eur_mwh)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
