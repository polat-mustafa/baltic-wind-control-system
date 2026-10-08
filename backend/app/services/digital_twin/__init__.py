"""Digital twin of the 34 × 15 MW fleet ("V236 class", IEA 15 MW) — ISO 13374-1 CMS.

The twin is a physics reference model of the turbine (``reference_model``),
evaluated at the measured wind and air density of every 10-min SCADA record.
What it predicts is compared with what the turbine reports; the differences
are charted, explained and projected:

  DA  plant_simulator   synthetic SCADA of the physical fleet (+ ground truth)
  DM  detection         twin expectation, five residual channels
  SD  detection         Phase I calibration, EWMA control charts, events
  HA  detection         health index;  diagnosis — fault isolation and sizing
  PA  prognosis         remaining useful life (ISO 13381-1)
  AG  fault_library     advisories;  pipeline — orchestration and caching
"""

from app.services.digital_twin.pipeline import DigitalTwinRun, run_digital_twin
from app.services.digital_twin.reference_model import FaultParams, evaluate, reference_curve

__all__ = [
    "DigitalTwinRun",
    "FaultParams",
    "evaluate",
    "reference_curve",
    "run_digital_twin",
]
