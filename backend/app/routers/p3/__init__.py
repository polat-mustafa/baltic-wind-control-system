"""P3 SCADA & IEC 61850 router — assembled from sub-router modules.

All endpoints keep the same ``/api/v1/scada/`` prefix and ``P3`` tag.
No URL changes from the monolithic ``p3.py`` — fully backward-compatible.
"""

from fastapi import APIRouter

from .devices import router as devices_router
from .goose import router as goose_router
from .permits import router as permits_router
from .rbac import router as rbac_router
from .scl import router as scl_router

router = APIRouter(prefix="/api/v1/scada", tags=["P3 SCADA & IEC 61850"])
router.include_router(goose_router)
router.include_router(devices_router)
router.include_router(scl_router)
router.include_router(rbac_router)
router.include_router(permits_router)
