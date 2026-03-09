"""P5 HV Commissioning router — assembled from sub-router modules.

All endpoints keep the same ``/api/v1/commissioning/`` prefix and ``P5`` tag.
No URL changes from the monolithic ``p5.py`` — fully backward-compatible.
"""

from fastapi import APIRouter

from .emergency import router as emergency_router
from .loto import router as loto_router
from .protection import router as protection_router
from .switching import router as switching_router
from .testing import router as testing_router

router = APIRouter(prefix="/api/v1/commissioning", tags=["P5 HV Commissioning"])
router.include_router(switching_router)
router.include_router(loto_router)
router.include_router(testing_router)
router.include_router(protection_router)
router.include_router(emergency_router)
