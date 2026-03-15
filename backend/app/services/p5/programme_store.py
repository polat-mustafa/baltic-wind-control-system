"""DEPRECATED — In-memory stores replaced by programme_repository.py.

All P5 routers now use ``ProgrammeRepository`` with SQLAlchemy/PostgreSQL.
This module is retained only for backward compatibility with any tests
that reference the in-memory stores directly. It will be removed once
all tests migrate to the DB-backed repository.

Migration path:
    programme_store.programmes       → ProgrammeRepository.save_programme / get_programme
    programme_store.fat_campaigns    → ProgrammeRepository.save_fat_campaign / get_fat_campaign
    programme_store.protection_results → ProgrammeRepository.save_protection_results
    programme_store.get_programme()  → ProgrammeRepository.get_programme()
"""

from __future__ import annotations

import warnings

from app.core.exceptions import NotFoundError
from app.services.p5.fat import FATCampaign
from app.services.p5.protection_relay import GradingResult
from app.services.p5.switching_programme import SwitchingProgramme

# In-memory stores — DEPRECATED, use ProgrammeRepository instead
programmes: dict[str, SwitchingProgramme] = {}
fat_campaigns: dict[str, FATCampaign] = {}
protection_results: list[GradingResult] = []


def get_programme(programme_id: str) -> SwitchingProgramme:
    """Retrieve a programme by ID or raise 404.

    .. deprecated::
        Use ``ProgrammeRepository.get_programme()`` instead.
    """
    warnings.warn(
        "programme_store.get_programme() is deprecated. "
        "Use ProgrammeRepository.get_programme() instead.",
        DeprecationWarning,
        stacklevel=2,
    )
    if programme_id not in programmes:
        raise NotFoundError(f"Programme '{programme_id}' not found.")
    return programmes[programme_id]
