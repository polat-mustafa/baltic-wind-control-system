"""
Database models for all five project phases (P1–P5).

All ORM models are imported here for Alembic auto-detection.
"""

from app.models.commissioning import CommissioningEvent, SwitchingProgrammeRecord
from app.models.forecast import ForecastResult
from app.models.grid import GridNetwork, LoadFlowResult, ShortCircuitResult
from app.models.ptw import PermitToWork, PTWTransitionLog
from app.models.scada import (
    GOOSEControlBlockRecord,
    IEC61850Device,
    IEC61850LogicalNode,
    SCLFile,
)
from app.models.wind_farm import AEPResult, PerTurbineAEP, TurbinePosition, WindFarm
from app.models.wind_resource import WindResource

__all__ = [
    "AEPResult",
    "CommissioningEvent",
    "ForecastResult",
    "GOOSEControlBlockRecord",
    "GridNetwork",
    "IEC61850Device",
    "IEC61850LogicalNode",
    "LoadFlowResult",
    "PTWTransitionLog",
    "PerTurbineAEP",
    "PermitToWork",
    "SCLFile",
    "ShortCircuitResult",
    "SwitchingProgrammeRecord",
    "TurbinePosition",
    "WindFarm",
    "WindResource",
]
