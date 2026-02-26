"""P4 Machine Learning for Energy — SCADA data pipeline and forecasting services.

Public re-exports for the P4 service layer. Consumers should import
from this package rather than individual modules.
"""

from app.services.p4.feature_engineering import (
    EngineeredFeatures,
    FeatureConfig,
    engineer_features,
)
from app.services.p4.nwp_pipeline import (
    NWPConfig,
    NWPDataset,
    NWP_FEATURE_NAMES,
    generate_nwp_dataset,
    merge_nwp_features,
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
from app.services.p4.xgboost_model import (
    CVResult,
    FoldMetrics,
    ForecastResult,
    SHAPResult,
    XGBoostConfig,
    compute_shap_values,
    predict_xgboost,
    train_xgboost,
)

__all__ = [
    "CVResult",
    "ConstraintResult",
    "ConstraintType",
    "ConstraintViolation",
    "EngineeredFeatures",
    "FeatureConfig",
    "FilterResult",
    "FilterType",
    "FoldMetrics",
    "ForecastResult",
    "NWPConfig",
    "NWPDataset",
    "NWP_FEATURE_NAMES",
    "PowerCurveResult",
    "QualityFlag",
    "SCADAConfig",
    "SCADADataset",
    "SHAPResult",
    "TurbineSpec",
    "XGBoostConfig",
    "apply_all_quality_filters",
    "build_power_curve",
    "compute_air_density_kg_m3",
    "compute_shap_values",
    "compute_swept_area_m2",
    "enforce_farm_constraints",
    "enforce_physical_constraints",
    "engineer_features",
    "generate_nwp_dataset",
    "generate_scada_dataset",
    "get_v236_spec",
    "interpolate_power_mw",
    "merge_nwp_features",
    "predict_xgboost",
    "train_xgboost",
]
