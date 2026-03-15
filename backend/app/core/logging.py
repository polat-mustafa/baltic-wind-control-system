"""Structured logging configuration using structlog.

Provides JSON output in production and colored console in development.
stdlib logging is automatically formatted through structlog processors,
so existing ``logging.getLogger(__name__)`` calls get structured output
without any code changes.

Usage
-----
Call ``configure_logging()`` once at startup (in ``main.py``).
Individual modules can migrate to ``structlog.get_logger()`` over time.
"""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(*, debug: bool = False) -> None:
    """Set up structlog + stdlib integration.

    Parameters
    ----------
    debug : bool
        If True, use colored console renderer (human-friendly).
        If False, use JSON renderer (machine-parseable for log aggregation).
    """
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if debug:
        # Development: colored console output
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        # Production: JSON lines for log aggregation
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if debug else logging.INFO)

    # Quiet noisy third-party loggers
    for noisy in ("uvicorn.access", "asyncio", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
