"""
Async Redis caching module for the Baltic Wind platform.

Provides:
- Module-level singleton Redis client (not per-request)
- Graceful degradation — endpoints work even if Redis is down
- ``@cached(ttl=300)`` decorator for expensive computations
- Cache keys: ``bw:{prefix}:{md5(args)[:12]}``

Usage::

    from app.core.cache import cached, get_redis_client, init_redis

    # In lifespan:
    await init_redis()

    # In helper functions (not route handlers):
    @cached(prefix="wake", ttl=300)
    def compute_wake(layout: str, a: float, k: float) -> dict[str, Any]: ...

    # FastAPI dependency for direct access:
    async def my_route(redis=Depends(get_redis_client)): ...
"""

from __future__ import annotations

import asyncio
import functools
import hashlib
import json
import logging
from collections.abc import Callable
from typing import Any

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — initialised once at startup
_redis_client: aioredis.Redis | None = None


async def init_redis() -> None:
    """Create the module-level Redis connection.

    Called once during application startup (lifespan).
    Fails silently with a warning if Redis is unreachable.
    """
    global _redis_client
    try:
        client = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        await client.ping()  # type: ignore[misc]
        _redis_client = client
        logger.info("Redis connected: %s", settings.redis_url)
    except Exception:
        logger.warning("Redis unavailable -- caching disabled")
        _redis_client = None


async def close_redis() -> None:
    """Close the Redis connection during shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis connection closed")


async def get_redis_client() -> aioredis.Redis | None:
    """FastAPI dependency -- returns the Redis client (or None)."""
    return _redis_client


async def redis_ping() -> bool:
    """Check Redis connectivity. Returns True if responsive."""
    if _redis_client is None:
        return False
    try:
        result = await _redis_client.ping()  # type: ignore[misc]
        return bool(result)
    except Exception:
        return False


def _make_cache_key(prefix: str, args: tuple[Any, ...], kwargs: dict[str, Any]) -> str:
    """Build a deterministic cache key from function arguments.

    Key format: ``bw:{prefix}:{md5(serialised_args)[:12]}``
    """
    raw = json.dumps({"a": args, "k": kwargs}, sort_keys=True, default=str)
    digest = hashlib.md5(raw.encode()).hexdigest()[:12]
    return f"bw:{prefix}:{digest}"


def cached(
    prefix: str = "default",
    ttl: int = 300,
) -> Callable[..., Callable[..., Any]]:
    """Decorator for caching function results in Redis.

    Works on **sync helper functions** that return JSON-serialisable
    dicts or Pydantic-compatible structures. Not for route handlers.

    Parameters
    ----------
    prefix : str
        Namespace prefix for the cache key.
    ttl : int
        Time-to-live in seconds (default 5 minutes).

    Graceful degradation:
    - If Redis is down, the function runs uncached.
    - If serialisation fails, the function runs uncached.
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            if _redis_client is None:
                return await asyncio.to_thread(func, *args, **kwargs)

            key = _make_cache_key(prefix, args, kwargs)

            # Try cache hit
            try:
                hit = await _redis_client.get(key)
                if hit is not None:
                    return json.loads(hit)
            except Exception:
                pass

            # Cache miss -- run in thread pool to avoid blocking the event loop
            result = await asyncio.to_thread(func, *args, **kwargs)

            # Store in cache
            try:
                serialised = json.dumps(result, default=str)
                await _redis_client.setex(key, ttl, serialised)
            except Exception:
                pass

            return result

        return async_wrapper

    return decorator
