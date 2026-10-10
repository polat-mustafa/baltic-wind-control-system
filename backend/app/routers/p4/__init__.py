"""P4 forecasting router: real-data day-ahead forecast and the turbine power curve.

All endpoints keep the ``/api/v1/forecast/`` prefix and ``P4`` tag.
"""

from fastapi import APIRouter

from .real_data import router as real_data_router
from .turbine_spec import router as turbine_spec_router

router = APIRouter(prefix="/api/v1/forecast", tags=["P4 — ML Forecasting"])
router.include_router(turbine_spec_router)
router.include_router(real_data_router)
