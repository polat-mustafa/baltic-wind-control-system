"""Domain exception hierarchy and global FastAPI exception handler.

All domain services raise these exceptions instead of HTTPException.
The global handler registered in ``main.py`` converts them to JSON responses.

Hierarchy
---------
DomainError (400)
  NotFoundError (404)
  ValidationError (422)
  StateTransitionError (409)
  PermissionDeniedError (403)

This eliminates ~40+ try/except → HTTPException blocks from routers.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """Base for all domain errors. Maps to HTTP 400 by default."""

    status_code: int = 400

    def __init__(self, detail: str, *, status_code: int | None = None) -> None:
        super().__init__(detail)
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(DomainError):
    """Resource not found. Maps to HTTP 404."""

    status_code = 404


class ValidationError(DomainError):
    """Request validation failure. Maps to HTTP 422."""

    status_code = 422


class StateTransitionError(DomainError):
    """Invalid state transition (e.g. PtW, programme lifecycle). Maps to HTTP 409."""

    status_code = 409


class PermissionDeniedError(DomainError):
    """Insufficient privileges. Maps to HTTP 403."""

    status_code = 403


def register_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers on the FastAPI app.

    Call once from ``main.py`` after app creation.
    """

    @app.exception_handler(DomainError)
    async def _domain_error_handler(_request: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": str(exc)},
        )
