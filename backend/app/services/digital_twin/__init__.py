"""Digital Twin module — virtual replica of each turbine for condition monitoring.

Compares physics simulator predictions (what SHOULD happen) against SCADA data
(what ACTUALLY happens) to detect anomalies and assess turbine health per
ISO 13374-1 (Condition Monitoring and Diagnostics of Machines).

Architecture
────────────
SCADA Data (Actual)          Physics Simulator (Twin)
    │                              │
    ▼                              ▼
  [wind, power, rpm, pitch]   [run_simulation(wind)]
    │                              │
    └───▶ Residual Analysis ◀──────┘
                │
         Health Scoring (ISO 13374)
                │
         Anomaly Classification
                │
         Degradation & RUL
"""

from app.services.digital_twin.anomaly_classification import (
    AnomalyRecord,
    classify_anomalies,
)
from app.services.digital_twin.health_scoring import (
    HealthStatus,
    TurbineHealthScore,
    compute_farm_health,
    compute_health_score,
)
from app.services.digital_twin.residual_analysis import (
    ResidualResult,
    compute_residuals,
)
from app.services.digital_twin.scenario_generator import (
    SCENARIO_DESCRIPTIONS,
    run_digital_twin_analysis,
)
from app.services.digital_twin.twin_engine import (
    TwinPrediction,
    build_twin_lookup_table,
    lookup_twin_prediction,
)

__all__ = [
    "SCENARIO_DESCRIPTIONS",
    "AnomalyRecord",
    "HealthStatus",
    "ResidualResult",
    "TurbineHealthScore",
    "TwinPrediction",
    "build_twin_lookup_table",
    "classify_anomalies",
    "compute_farm_health",
    "compute_health_score",
    "compute_residuals",
    "lookup_twin_prediction",
    "run_digital_twin_analysis",
]
