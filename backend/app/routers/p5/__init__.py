"""P5 HV Commissioning router — assembled from sub-router modules.

All endpoints share the ``/api/v1/commissioning/`` prefix. Protection settings
and coordination live in P2 (``/api/v1/grid/protection``).
"""

from fastapi import APIRouter

from .emergency import router as emergency_router
from .loto import router as loto_router
from .real_data import router as real_data_router
from .switching import router as switching_router
from .testing import router as testing_router

router = APIRouter(prefix="/api/v1/commissioning", tags=["P5 HV Commissioning"])
router.include_router(switching_router)
router.include_router(loto_router)
router.include_router(testing_router)
router.include_router(emergency_router)
router.include_router(real_data_router)
