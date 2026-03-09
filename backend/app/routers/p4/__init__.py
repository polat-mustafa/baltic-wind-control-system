"""P4 ML Forecasting router — assembled from sub-router modules.

All endpoints keep the same ``/api/v1/forecast/`` prefix and ``P4`` tag.
No URL changes from the monolithic ``p4.py`` — fully backward-compatible.
"""

from fastapi import APIRouter

from .analysis import router as analysis_router
from .ensemble import router as ensemble_router
from .models import router as models_router
from .scada_pipeline import router as scada_pipeline_router
from .turbine_spec import router as turbine_spec_router

router = APIRouter(prefix="/api/v1/forecast", tags=["P4 — ML Forecasting"])
router.include_router(turbine_spec_router)
router.include_router(scada_pipeline_router)
router.include_router(models_router)
router.include_router(ensemble_router)
router.include_router(analysis_router)
