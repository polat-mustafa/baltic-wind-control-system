"""In-memory + Redis dual-write task storage for async ensemble jobs.

Extracted from ``routers/p4.py`` to keep infrastructure logic out of routers.
The store keeps an in-memory dict for instant reads and best-effort mirrors
to Redis for resilience across restarts.
"""

from __future__ import annotations

import asyncio
import contextlib
import json as _json
import time
from typing import Any

from app.core.cache import get_redis

_TASK_TTL_SECONDS = 3600  # 1 hour
_TASK_KEY_PREFIX = "bw:task:"

# In-memory stores
_ensemble_tasks: dict[str, dict[str, Any]] = {}
_ensemble_bg_tasks: set[asyncio.Task[None]] = set()


def _task_key(task_id: str) -> str:
    return f"{_TASK_KEY_PREFIX}{task_id}"


def _cleanup_expired_tasks() -> None:
    """Remove tasks older than TTL to prevent unbounded memory growth."""
    now = time.monotonic()
    expired = [
        tid
        for tid, t in _ensemble_tasks.items()
        if now - t.get("created_at", now) > _TASK_TTL_SECONDS
    ]
    for tid in expired:
        del _ensemble_tasks[tid]


async def task_save(task_id: str, data: dict[str, Any]) -> None:
    """Dual-write: always store in-memory + best-effort Redis."""
    _ensemble_tasks[task_id] = data
    redis = get_redis()
    if redis is not None:
        with contextlib.suppress(Exception):
            await redis.setex(
                _task_key(task_id),
                _TASK_TTL_SECONDS,
                _json.dumps(data, default=str),
            )


async def task_get(task_id: str) -> dict[str, Any] | None:
    """Read task state. In-memory first (freshest), then Redis fallback."""
    if task_id in _ensemble_tasks:
        return _ensemble_tasks[task_id]
    redis = get_redis()
    if redis is not None:
        try:
            raw = await redis.get(_task_key(task_id))
            if raw:
                result: dict[str, Any] = _json.loads(raw)
                return result
        except Exception:
            pass
    return None


async def task_update(task_id: str, **kwargs: Any) -> None:
    """Dual-write update: always update in-memory + best-effort Redis."""
    if task_id in _ensemble_tasks:
        _ensemble_tasks[task_id].update(kwargs)
    else:
        _ensemble_tasks[task_id] = dict(kwargs)
    redis = get_redis()
    if redis is not None:
        try:
            raw = await redis.get(_task_key(task_id))
            data = _json.loads(raw) if raw else {}
            data.update(kwargs)
            await redis.setex(
                _task_key(task_id),
                _TASK_TTL_SECONDS,
                _json.dumps(data, default=str),
            )
        except Exception:
            pass


def register_bg_task(task: asyncio.Task[None]) -> None:
    """Register a background task to prevent GC."""
    _ensemble_bg_tasks.add(task)
    task.add_done_callback(_ensemble_bg_tasks.discard)
