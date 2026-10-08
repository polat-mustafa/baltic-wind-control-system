"""
Saved projects — the learner's "own project", shared by an anonymous link.

The project id (uuid4, 122 random bits) is the only key: there is no listing
endpoint and no account. Projects idle for 12 months are deleted. The SB-510
reference row (seed.py) can be read but not changed.

Endpoints (prefix /api/v1/projects)
-----------------------------------
POST   /                   create → 201 {id, revision 1}
GET    /{id}               open (refreshes the 12-month clock)
PUT    /{id}               save {revision, data}; stale revision → 409
DELETE /{id}               delete → 204
POST   /{id}/aep           PyWake AEP of the stored layout, kept as history
GET    /{id}/aep           the last runs, newest first
GET    /{id}/windio.yaml   windIO 2.x plant file (site, wind, layout, turbine)
"""

from __future__ import annotations

import math
import re
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainError, NotFoundError, PermissionDeniedError, ValidationError
from app.db import get_session
from app.models.wind_farm import AEPResult, PerTurbineAEP, TurbinePosition, WindFarm
from app.routers.p1 import CustomWakeRequest, wake_analysis_custom
from app.schemas.project import (
    MAX_BODY_BYTES,
    AEPRunOut,
    AEPRunRequest,
    ProjectData,
    ProjectOut,
    ProjectUpdate,
)
from app.schemas.site_assessment import DEFAULT_REGION
from app.services.p1 import windio
from app.services.p1.aep_calculator import compute_aep_cascade
from app.services.p1.turbine_models import get_turbine
from app.services.site_assessment.layers import load_region
from app.services.site_assessment.wind_climate import site_wind

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])

RETENTION = timedelta(days=365)
HISTORY = 20  # PyWake runs kept per project
M_PER_DEG = 111_320.0  # equirectangular, as frontend/src/lib/layout/geometry.ts

# ── Abuse limits ─────────────────────────────────────────────────
# Per client IP: (requests, window s). nginx limit_req (frontend/nginx.conf) is
# the outer guard; X-Real-IP is set by nginx, so behind it the IP is the caller's.
# ponytail: in-process counters, valid for the single uvicorn worker (entrypoint.sh); Redis if >1
LIMITS = {"create": (20, 3600.0), "write": (240, 60.0), "aep": (20, 60.0)}
_hits: dict[tuple[str, str], list[float]] = {}


def _rate_limit(kind: str) -> Any:
    async def check(request: Request) -> None:
        n, window = LIMITS[kind]
        now = time.monotonic()
        ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "-")
        key = (kind, ip)
        hits = [t for t in _hits.get(key, []) if now - t < window]
        if len(hits) >= n:
            raise DomainError("Too many requests — try again later", status_code=429)
        hits.append(now)
        _hits[key] = hits
        if len(_hits) > 10_000:  # forget idle clients
            for k in [k for k, v in _hits.items() if now - v[-1] > 3600.0]:
                del _hits[k]

    return Depends(check)


async def _body_limit(request: Request) -> None:
    if len(await request.body()) > MAX_BODY_BYTES:
        raise DomainError(f"Project larger than {MAX_BODY_BYTES // 1024} KB", status_code=413)


# ── Helpers ──────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(UTC)


async def purge_idle_projects(session: AsyncSession) -> int:
    """Delete own projects not opened for 12 months (rows cascade). Returns the count."""
    result = await session.execute(
        delete(WindFarm).where(
            WindFarm.is_reference.is_(False), WindFarm.last_opened_at < _now() - RETENTION
        )
    )
    await session.commit()
    return int(getattr(result, "rowcount", 0) or 0)


async def _get(session: AsyncSession, project_id: uuid.UUID) -> WindFarm:
    farm = await session.get(WindFarm, project_id)
    if farm is None:
        raise NotFoundError("Project not found — wrong link, or deleted after 12 months idle")
    return farm


def _writable(farm: WindFarm) -> None:
    if farm.is_reference:
        raise PermissionDeniedError(
            "The SB-510 reference project is read-only — copy it into your own project"
        )


def _local_xy(lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Metres east / north of the turbines' centroid (equirectangular)."""
    lon0, lat0 = float(lon.mean()), float(lat.mean())
    return (
        (lon - lon0) * M_PER_DEG * math.cos(math.radians(lat0)),
        (lat - lat0) * M_PER_DEG,
    )


async def _store(session: AsyncSession, farm: WindFarm, data: ProjectData) -> None:
    """Write the document, its summary columns and the turbine positions."""
    model = get_turbine(data.turbine_model)
    farm.data = data.model_dump(mode="json", by_alias=True)
    farm.schema_version = data.schema_version
    farm.name = data.name
    farm.turbine_model = data.turbine_model
    farm.num_turbines = len(data.turbines)
    farm.capacity_mw = len(data.turbines) * model.rated_kw / 1000.0
    pts = [(t.lon, t.lat) for t in data.turbines] or list(data.site.polygon or [(0.0, 0.0)])
    farm.longitude = float(np.mean([p[0] for p in pts]))
    farm.latitude = float(np.mean([p[1] for p in pts]))
    farm.updated_at = farm.last_opened_at = _now()

    # Positions are upserted by turbine id, so stored per-turbine AEP rows survive a move.
    rows = {
        p.turbine_id: p
        for p in await session.scalars(
            select(TurbinePosition).where(TurbinePosition.wind_farm_id == farm.id)
        )
    }
    ids = {t.id for t in data.turbines}
    gone = [p.id for tid, p in rows.items() if tid not in ids]
    if gone:
        await session.execute(delete(TurbinePosition).where(TurbinePosition.id.in_(gone)))
    if data.turbines:
        x, y = _local_xy(
            np.array([t.lon for t in data.turbines]), np.array([t.lat for t in data.turbines])
        )
        for t, xi, yi in zip(data.turbines, x, y, strict=True):
            row = rows.get(t.id)
            if row is None:
                session.add(
                    TurbinePosition(
                        wind_farm_id=farm.id,
                        turbine_id=t.id,
                        x_m=round(float(xi), 1),
                        y_m=round(float(yi), 1),
                        hub_height_m=model.hub_height_m,
                    )
                )
            else:
                row.x_m, row.y_m = round(float(xi), 1), round(float(yi), 1)
                row.hub_height_m = model.hub_height_m


def _out(farm: WindFarm) -> ProjectOut:
    return ProjectOut(
        id=str(farm.id),
        revision=farm.revision,
        is_reference=farm.is_reference,
        updated_at=farm.updated_at,
        data=None if farm.data is None else ProjectData.model_validate(farm.data),
    )


# ── Projects ─────────────────────────────────────────────────────


@router.post(
    "",
    response_model=ProjectOut,
    status_code=201,
    dependencies=[_rate_limit("create"), Depends(_body_limit)],
)
async def create_project(
    data: ProjectData, session: AsyncSession = Depends(get_session)
) -> ProjectOut:
    """Create a project. Keep the returned id: it is the only way back in."""
    await purge_idle_projects(session)
    farm = WindFarm(id=uuid.uuid4(), revision=1, is_reference=False)
    session.add(farm)
    await _store(session, farm, data)
    await session.commit()
    return _out(farm)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> ProjectOut:
    farm = await _get(session, project_id)
    farm.last_opened_at = _now()
    await session.commit()
    return _out(farm)


@router.put(
    "/{project_id}",
    response_model=ProjectOut,
    dependencies=[_rate_limit("write"), Depends(_body_limit)],
)
async def update_project(
    project_id: uuid.UUID, body: ProjectUpdate, session: AsyncSession = Depends(get_session)
) -> ProjectOut:
    """Save; ``revision`` must be the one last read (optimistic lock)."""
    farm = await _get(session, project_id)
    _writable(farm)
    if body.revision != farm.revision:
        raise DomainError(
            f"Project changed elsewhere (revision {farm.revision}, yours {body.revision})",
            status_code=409,
        )
    await _store(session, farm, body.data)
    farm.revision += 1
    await session.commit()
    return _out(farm)


@router.delete("/{project_id}", status_code=204, dependencies=[_rate_limit("write")])
async def delete_project(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Response:
    farm = await _get(session, project_id)
    _writable(farm)
    await session.execute(delete(WindFarm).where(WindFarm.id == farm.id))
    await session.commit()
    return Response(status_code=204)


# ── AEP history ──────────────────────────────────────────────────


async def _runs(session: AsyncSession, farm: WindFarm, limit: int) -> list[AEPRunOut]:
    """Newest runs first; per-turbine values in the project's current turbine order."""
    results = list(
        await session.scalars(
            select(AEPResult)
            .where(AEPResult.wind_farm_id == farm.id)
            .order_by(AEPResult.calculated_at.desc())
            .limit(limit)
        )
    )
    per: dict[uuid.UUID, list[tuple[str, float, float]]] = {r.id: [] for r in results}
    if results:
        rows = await session.execute(
            select(
                PerTurbineAEP.aep_result_id,
                TurbinePosition.turbine_id,
                PerTurbineAEP.aep_gwh,
                PerTurbineAEP.wake_deficit_percent,
            )
            .join(TurbinePosition, PerTurbineAEP.turbine_position_id == TurbinePosition.id)
            .where(PerTurbineAEP.aep_result_id.in_(per))
        )
        for rid, tid, aep, loss in rows:
            per[rid].append((tid, aep, loss))
    order = {t["id"]: i for i, t in enumerate((farm.data or {}).get("turbines", []))}
    out = []
    for r in results:
        t = sorted(per[r.id], key=lambda x: order.get(x[0], len(order)))
        out.append(
            AEPRunOut(
                id=str(r.id),
                revision=r.revision,
                calculated_at=r.calculated_at,
                gross_aep_gwh=r.gross_aep_gwh or 0.0,
                net_aep_gwh=r.net_aep_gwh or 0.0,
                wake_loss_percent=r.wake_loss_percent,
                capacity_factor=r.capacity_factor or 0.0,
                p50_gwh=r.aep_p50_gwh,
                p75_gwh=r.aep_p75_gwh,
                p90_gwh=r.aep_p90_gwh,
                uncertainty_percent=r.uncertainty_percent,
                turbine_ids=[x[0] for x in t],
                per_turbine_aep_gwh=[x[1] for x in t],
                per_turbine_wake_loss_percent=[x[2] for x in t],
            )
        )
    return out


@router.post("/{project_id}/aep", response_model=AEPRunOut, dependencies=[_rate_limit("aep")])
async def run_project_aep(
    project_id: uuid.UUID, req: AEPRunRequest, session: AsyncSession = Depends(get_session)
) -> AEPRunOut:
    """PyWake AEP of the saved layout (same model as /wind/wake-analysis-custom).

    The run is stored with the project revision; the last 20 are kept.
    P50/P75/P90 apply the P1 loss cascade (electrical 2 %, availability 5 %,
    environmental 1 %; blockage not modelled here) and its RSS uncertainty.
    """
    farm = await _get(session, project_id)
    _writable(farm)
    data = ProjectData.model_validate(farm.data)
    if not data.turbines:
        raise ValidationError("The project has no turbines")
    lon = np.array([t.lon for t in data.turbines])
    lat = np.array([t.lat for t in data.turbines])
    if req.weibull_a is None or req.weibull_k is None:
        w = await run_in_threadpool(site_wind, load_region(DEFAULT_REGION), lon, lat)
        a, k = w.a_ms, w.k
        freqs = list(w.frequencies) if w.frequencies else None
    else:
        a, k, freqs = req.weibull_a, req.weibull_k, req.sector_frequencies
    x, y = _local_xy(lon, lat)
    wake = await wake_analysis_custom(
        CustomWakeRequest(
            x_m=[float(v) for v in x],
            y_m=[float(v) for v in y],
            weibull_a=a,
            weibull_k=k,
            turbine_model=data.turbine_model,
            sector_frequencies=freqs,
        )
    )
    model = get_turbine(data.turbine_model)
    cascade = compute_aep_cascade(
        wake.gross_aep_gwh,
        wake.wake_loss_percent / 100.0,
        0.0,
        num_turbines=len(data.turbines),
        rated_power_kw=model.rated_kw,
    )
    result = AEPResult(
        id=uuid.uuid4(),
        wind_farm_id=farm.id,
        revision=farm.revision,
        calculated_at=_now(),
        gross_aep_gwh=wake.gross_aep_gwh,
        net_aep_gwh=wake.net_aep_gwh,
        capacity_factor=wake.capacity_factor,
        aep_p50_gwh=round(cascade.p50_gwh, 2),
        aep_p75_gwh=round(cascade.p75_gwh, 2),
        aep_p90_gwh=round(cascade.p90_gwh, 2),
        uncertainty_percent=round(cascade.combined_uncertainty_percent, 2),
        wake_loss_percent=wake.wake_loss_percent,
        blockage_loss_percent=0.0,
    )
    session.add(result)
    positions = {
        p.turbine_id: p.id
        for p in await session.scalars(
            select(TurbinePosition).where(TurbinePosition.wind_farm_id == farm.id)
        )
    }
    for t, aep, loss in zip(
        data.turbines, wake.per_turbine_aep_gwh, wake.per_turbine_wake_loss_percent, strict=True
    ):
        session.add(
            PerTurbineAEP(
                aep_result_id=result.id,
                turbine_position_id=positions[t.id],
                aep_gwh=aep,
                wake_deficit_percent=loss,
            )
        )
    await session.flush()
    old = (
        await session.scalars(
            select(AEPResult.id)
            .where(AEPResult.wind_farm_id == farm.id)
            .order_by(AEPResult.calculated_at.desc())
            .offset(HISTORY)
        )
    ).all()
    if old:
        await session.execute(delete(AEPResult).where(AEPResult.id.in_(old)))
    await session.commit()
    return (await _runs(session, farm, 1))[0]


@router.get("/{project_id}/aep", response_model=list[AEPRunOut])
async def project_aep_history(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> list[AEPRunOut]:
    farm = await _get(session, project_id)
    return await _runs(session, farm, HISTORY)


# ── windIO export ────────────────────────────────────────────────


@router.get("/{project_id}/windio.yaml", response_class=Response)
async def project_windio(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_session)
) -> Response:
    """The project as a windIO 2.x ``wind_energy_system`` YAML file.

    Wind = the region-pack climate at the turbines (as the stored PyWake runs).
    Cost, permit and lifecycle inputs are not windIO: they stay in the
    project document, downloaded next to it as ``.offshoreforge.json``.
    """
    farm = await _get(session, project_id)
    if farm.data is None:
        raise ValidationError("The SB-510 reference has no project document to export")
    data = ProjectData.model_validate(farm.data)
    if not data.turbines:
        raise ValidationError("The project has no turbines")
    lon = np.array([t.lon for t in data.turbines])
    lat = np.array([t.lat for t in data.turbines])
    wind = await run_in_threadpool(site_wind, load_region(DEFAULT_REGION), lon, lat)
    slug = re.sub(r"[^A-Za-z0-9]+", "-", data.name).strip("-").lower() or "project"
    return Response(
        windio.dump(data, wind),
        media_type="application/yaml",
        headers={"Content-Disposition": f'attachment; filename="{slug}.windio.yaml"'},
    )
