"""P4 forecasting router: real-data day-ahead forecast.

All endpoints keep the ``/api/v1/forecast/`` prefix and ``P4`` tag.
"""

from fastapi import APIRouter

from .real_data import router as real_data_router

router = APIRouter(prefix="/api/v1/forecast", tags=["P4 — ML Forecasting"])
router.include_router(real_data_router)
