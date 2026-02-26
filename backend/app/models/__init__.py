"""
Wind Resource & AEP (P1), HV Grid Integration (P2), and SCADA (P3) database models.

All ORM models are imported here for Alembic auto-detection.
"""

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
    "TurbinePosition",
    "WindFarm",
    "WindResource",
]
