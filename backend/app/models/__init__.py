"""
Database models for all five project phases (P1–P5).

All ORM models are imported here for Alembic auto-detection.
"""

from app.models.alarm import Alarm, AlarmEvent, AlarmFloodEvent
from app.models.commissioning import CommissioningEvent, SwitchingProgrammeRecord
from app.models.forecast import ForecastResult
from app.models.grid import GridNetwork, LoadFlowResult, ShortCircuitResult
from app.models.programme import (
    FATCampaignModel,
    SwitchingProgrammeModel,
)
from app.models.ptw import PermitToWork, PTWTransitionLog
from app.models.scada import (
    GOOSEControlBlockRecord,
    IEC61850Device,
    IEC61850LogicalNode,
    SCLFile,
    SOEEvent,
)
from app.models.wind_farm import AEPResult, PerTurbineAEP, TurbinePosition, WindFarm
from app.models.wind_resource import WindResource

__all__ = [
    "AEPResult",
    "Alarm",
    "AlarmEvent",
    "AlarmFloodEvent",
    "CommissioningEvent",
    "FATCampaignModel",
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
    "SOEEvent",
    "ShortCircuitResult",
    "SwitchingProgrammeModel",
    "SwitchingProgrammeRecord",
    "TurbinePosition",
    "WindFarm",
    "WindResource",
]
