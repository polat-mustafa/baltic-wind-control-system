"""P4 sub-router: Ensemble prediction (async background task + polling)."""

from __future__ import annotations

import asyncio
import time
import uuid

from fastapi import APIRouter, HTTPException

from app.schemas.forecast import (
    EnsemblePredictRequest,
    EnsemblePredictResponse,
    TaskStartResponse,
    TaskStatusResponse,
)
from app.services.p4.task_store import register_bg_task, task_get, task_save, task_update

from ._pipeline import _cached_ensemble_predict

router = APIRouter()


# ── Background Worker ────────────────────────────────────────────


async def _run_ensemble_task(task_id: str, req: EnsemblePredictRequest) -> None:
    """Background worker that trains the 3-model ensemble and stores the result.

    Runs as an asyncio task so the POST returns 202 instantly, eliminating
    proxy timeout issues on slow hardware (training can take 5-15 min).
    """
    try:
        await task_update(task_id, progress=10)
        result = await _cached_ensemble_predict(
            num_turbines=req.num_turbines,
            num_timesteps=req.num_timesteps,
            turbine_index=req.turbine_index,
            horizon_steps=req.horizon_steps,
            seed=req.seed,
        )
        await task_update(task_id, status="completed", progress=100, result=result)
    except Exception as e:
        await task_update(task_id, status="failed", progress=0, error=str(e))


# ── Endpoints ────────────────────────────────────────────────────


@router.post(
    "/predict-ensemble",
    response_model=TaskStartResponse,
    status_code=202,
)
async def predict_ensemble_endpoint(
    request: EnsemblePredictRequest,
) -> TaskStartResponse:
    """Start ensemble forecast training as a background task.

    Returns **202 Accepted** with a ``task_id`` immediately.
    Poll ``GET /predict-ensemble/status/{task_id}`` for progress and results.

    Pipeline: train XGBoost + LSTM + TFT → horizon-dependent weights →
    physical constraints → ensemble P10/P50/P90.  Uses Redis cache
    (TTL 120 s) to skip recomputation on repeated requests.

    Weight schedule per Roadmap §5.6:
        < 6 h:   XGB 0.50 + LSTM 0.30 + TFT 0.20
        6–24 h:  XGB 0.20 + LSTM 0.40 + TFT 0.40
        24–48 h: XGB 0.10 + LSTM 0.30 + TFT 0.60
    """
    task_id = str(uuid.uuid4())
    await task_save(
        task_id,
        {
            "status": "running",
            "progress": 0,
            "result": None,
            "error": None,
            "created_at": time.monotonic(),
        },
    )
    task = asyncio.create_task(_run_ensemble_task(task_id, request))
    register_bg_task(task)
    return TaskStartResponse(task_id=task_id, status="running")


@router.get(
    "/predict-ensemble/status/{task_id}",
    response_model=TaskStatusResponse,
)
async def ensemble_status(task_id: str) -> TaskStatusResponse:
    """Poll the status of a background ensemble training task.

    Returns progress (0-100 %), and the full ``EnsemblePredictResponse``
    once training completes (status = 'completed').
    """
    task = await task_get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskStatusResponse(
        status=task["status"],
        progress=task["progress"],
        result=EnsemblePredictResponse(**task["result"]) if task["result"] else None,
        error=task["error"],
    )
