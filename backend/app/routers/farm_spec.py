"""
Which farm the P2 grid endpoints model.

No header → the SB-510 reference design. The learner's own project sends its
layout in the ``X-Farm`` header (URL-encoded JSON, so names may hold any
character): strings (turbines per string, from the frontend cable tree), mean
array section length and export cable length. The backend sizes the rest with
``network_model.design`` and checks the reactors with a load flow
(``statcom_sizing.check_reactors``) — nothing is stored, so a project that only
lives in the browser works too.
"""

from __future__ import annotations

from typing import Annotated
from urllib.parse import unquote

from fastapi import Depends, Header
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from app.core.exceptions import ValidationError as DomainValidationError
from app.services.p2.network_model import (
    MAX_TURBINES_PER_STRING,
    SB510,
    FarmSpec,
    design,
)
from app.services.p2.statcom_sizing import check_reactors

MAX_TURBINES = 150  # same limit as a saved project (schemas/project.py)


class FarmInput(BaseModel):
    """The ``X-Farm`` header."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field("Own project", min_length=1, max_length=100)
    strings: list[Annotated[int, Field(ge=1, le=MAX_TURBINES_PER_STRING)]] = Field(
        min_length=1, max_length=MAX_TURBINES
    )
    export_km: float = Field(ge=1.0, le=300.0)
    array_km: float = Field(ge=0.1, le=20.0, description="Mean array section length [km]")

    @model_validator(mode="after")
    def _size(self) -> FarmInput:
        if sum(self.strings) > MAX_TURBINES:
            raise ValueError(f"at most {MAX_TURBINES} turbines")
        return self


def farm_spec(x_farm: Annotated[str | None, Header()] = None) -> FarmSpec:
    """FarmSpec of the request: SB-510, or the design of the farm in ``X-Farm``."""
    if not x_farm:
        return SB510
    try:
        farm = FarmInput.model_validate_json(unquote(x_farm))
    except ValidationError as e:
        err = e.errors()[0]
        where = ".".join(str(p) for p in err["loc"])
        raise DomainValidationError(f"X-Farm header: {where} {err['msg']}".strip()) from e
    spec = design(tuple(farm.strings), round(farm.export_km, 1), round(farm.array_km, 3), farm.name)
    return check_reactors(spec)


FarmSpecDep = Annotated[FarmSpec, Depends(farm_spec)]
