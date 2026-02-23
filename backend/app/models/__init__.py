"""
P1 Wind Resource & AEP database models.

All ORM models are imported here for Alembic auto-detection.
"""

from app.models.wind_farm import AEPResult, PerTurbineAEP, TurbinePosition, WindFarm
from app.models.wind_resource import WindResource

__all__ = [
    "AEPResult",
    "PerTurbineAEP",
    "TurbinePosition",
    "WindFarm",
    "WindResource",
]
