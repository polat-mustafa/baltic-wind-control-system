"""P4 Machine Learning for Energy — SCADA data pipeline and forecasting services.

Public re-exports for the P4 service layer. Consumers should import
from this package rather than individual modules.
"""

from app.services.p4.feature_engineering import (
    EngineeredFeatures,
    FeatureConfig,
    engineer_features,
)
from app.services.p4.physical_constraints import (
    ConstraintResult,
    ConstraintType,
    ConstraintViolation,
    enforce_farm_constraints,
    enforce_physical_constraints,
)
from app.services.p4.scada_generator import (
    SCADAConfig,
    SCADADataset,
    generate_scada_dataset,
)
from app.services.p4.scada_quality_filters import (
    FilterResult,
    FilterType,
    QualityFlag,
    apply_all_quality_filters,
)
from app.services.p4.turbine_power_curve import (
    PowerCurveResult,
    TurbineSpec,
    build_power_curve,
    compute_air_density_kg_m3,
    compute_swept_area_m2,
    get_v236_spec,
    interpolate_power_mw,
)

__all__ = [
    "ConstraintResult",
    "ConstraintType",
    "ConstraintViolation",
    "EngineeredFeatures",
    "FeatureConfig",
    "FilterResult",
    "FilterType",
    "PowerCurveResult",
    "QualityFlag",
    "SCADAConfig",
    "SCADADataset",
    "TurbineSpec",
    "apply_all_quality_filters",
    "build_power_curve",
    "compute_air_density_kg_m3",
    "compute_swept_area_m2",
    "enforce_farm_constraints",
    "enforce_physical_constraints",
    "engineer_features",
    "generate_scada_dataset",
    "get_v236_spec",
    "interpolate_power_mw",
]
