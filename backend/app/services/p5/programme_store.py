"""In-memory stores for P5 commissioning domain objects.

Extracted from ``routers/p5.py`` to keep router files thin.
Each programme owns its equipment state and LOTO set (no shared mutable state).
Persistence (SQLAlchemy) will be added after domain logic is proven.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.services.p5.fat import FATCampaign
from app.services.p5.protection_relay import GradingResult
from app.services.p5.switching_programme import SwitchingProgramme

# In-memory stores
programmes: dict[str, SwitchingProgramme] = {}
fat_campaigns: dict[str, FATCampaign] = {}
protection_results: list[GradingResult] = []


def get_programme(programme_id: str) -> SwitchingProgramme:
    """Retrieve a programme by ID or raise 404."""
    if programme_id not in programmes:
        raise HTTPException(
            status_code=404,
            detail=f"Programme '{programme_id}' not found.",
        )
    return programmes[programme_id]
