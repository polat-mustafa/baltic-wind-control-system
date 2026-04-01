"""P3 SCADA & IEC 61850 router — assembled from sub-router modules.

All endpoints keep the same ``/api/v1/scada/`` prefix and ``P3`` tag.
No URL changes from the monolithic ``p3.py`` — fully backward-compatible.

Phase A additions (Improvement Roadmap):
  bays_router     — M01 Bay controller + 7-rule interlock engine
  soe_router      — M02 Sequence of Events recorder (TimescaleDB hypertable)

Phase B additions (Improvement Roadmap):
  opcua_router    — M03 OPC-UA server management (port 4840 binary protocol)
  alarms_router   — M09 Alarm rationalization (EEMUA 191 KPIs + shelving)

Phase C additions (Improvement Roadmap):
  cms_router      — M12 Condition Monitoring System (fleet health, FFT, RUL)

Phase E additions (Improvement Roadmap):
  security_router — M07 Cybersecurity IEC 62443 (Purdue zones, attack sim, compliance)

Phase F additions (Improvement Roadmap):
  network_router  — M15 Communication Network Architecture (OT topology, OPC-UA, latency)
"""

from fastapi import APIRouter

from .alarms import router as alarms_router
from .bays import router as bays_router
from .cms import router as cms_router
from .devices import router as devices_router
from .goose import router as goose_router
from .historian import router as historian_router
from .network import router as network_router
from .opcua import router as opcua_router
from .permits import router as permits_router
from .rbac import router as rbac_router
from .scl import router as scl_router
from .security import router as security_router
from .soe import router as soe_router

router = APIRouter(prefix="/api/v1/scada", tags=["P3 SCADA & IEC 61850"])
router.include_router(goose_router)
router.include_router(devices_router)
router.include_router(scl_router)
router.include_router(rbac_router)
router.include_router(permits_router)
router.include_router(historian_router)
# M01 — Bay controller & interlock engine
router.include_router(bays_router)
# M02 — Sequence of Events recorder
router.include_router(soe_router)
# M03 — OPC-UA server management
router.include_router(opcua_router)
# M09 — Alarm rationalization (EEMUA 191)
router.include_router(alarms_router)
# M12 — Condition Monitoring System
router.include_router(cms_router)
# M07 — Cybersecurity IEC 62443
router.include_router(security_router)
# M15 — Communication Network Architecture
router.include_router(network_router)
