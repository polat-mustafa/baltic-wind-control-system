"""
Reference turbine models: power and thrust curves from the official IEA Wind
Task 37 tables.

The data live in ``app/data/turbines/`` (``turbines.json`` for the parameters
and provenance, ``<id>.csv`` for the ws / power / Ct table) and are written by
``scripts/fetch_turbine_curves.py``. SB-510 is modelled with the IEA 15 MW
turbine as a "V236-class" machine: Vestas publishes no power or thrust curve
for the V236-15.0 MW.

Physics
-------
- Power between table points is interpolated linearly; Rule 1 is enforced on
  every call: 0 ≤ P ≤ P_rated, P = 0 below cut-in and above cut-out.
- Ct is clipped to [0, 1] and is 0 outside the operating range (parked rotor).

References
----------
- Gaertner, E. et al. (2020). Definition of the IEA 15-Megawatt Offshore
  Reference Wind Turbine. NREL/TP-5000-75698.
- Zahle, F. et al. (2024). Definition of the IEA Wind 22-Megawatt Offshore
  Reference Wind Turbine. DTU Wind Report E-0243.
"""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.core.exceptions import ValidationError

DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "turbines"

#: SB-510 reference model ("V236 class").
DEFAULT_TURBINE_ID = "IEA-15-240-RWT"


@dataclass(frozen=True)
class TurbineModel:
    """A wind turbine with its tabulated power and thrust curves.

    Units: wind speed m/s, power kW, lengths m.
    """

    id: str
    name: str
    rated_kw: float
    rotor_diameter_m: float
    hub_height_m: float
    cut_in_ms: float
    rated_ms: float
    cut_out_ms: float
    source: str
    license: str
    reference: str
    retrieved: str
    ws_ms: NDArray[np.float64]
    power_kw: NDArray[np.float64]
    ct: NDArray[np.float64]

    @property
    def rated_mw(self) -> float:
        return self.rated_kw / 1e3

    def power_curve_kw(self, wind_speeds_ms: NDArray[np.floating] | float) -> NDArray[np.float64]:
        """Electrical power [kW] at the given hub-height wind speeds (Rule 1 enforced)."""
        v = np.asarray(wind_speeds_ms, dtype=np.float64)
        p = np.interp(v, self.ws_ms, self.power_kw)
        p = np.clip(p, 0.0, self.rated_kw)
        p = np.where((v < self.cut_in_ms) | (v > self.cut_out_ms), 0.0, p)
        return np.asarray(p, dtype=np.float64)

    def ct_curve(self, wind_speeds_ms: NDArray[np.floating] | float) -> NDArray[np.float64]:
        """Thrust coefficient [-] at the given wind speeds; 0 outside the operating range."""
        v = np.asarray(wind_speeds_ms, dtype=np.float64)
        c = np.clip(np.interp(v, self.ws_ms, self.ct), 0.0, 1.0)
        c = np.where((v < self.cut_in_ms) | (v > self.cut_out_ms), 0.0, c)
        return np.asarray(c, dtype=np.float64)

    def pywake(self) -> Any:
        """PyWake ``WindTurbine`` with this power / Ct table (power in W)."""
        from py_wake.wind_turbines import WindTurbine
        from py_wake.wind_turbines.power_ct_functions import PowerCtTabular

        return WindTurbine(
            name=self.id,
            diameter=self.rotor_diameter_m,
            hub_height=self.hub_height_m,
            powerCtFunction=PowerCtTabular(
                ws=self.ws_ms,
                power=self.power_kw * 1e3,
                power_unit="W",
                ct=self.ct,
            ),
        )


def _load(meta: dict[str, Any]) -> TurbineModel:
    with (DATA_DIR / f"{meta['id']}.csv").open(encoding="utf-8") as fh:
        rows = [
            (float(r["ws_ms"]), float(r["power_kw"]), float(r["ct"])) for r in csv.DictReader(fh)
        ]
    table = np.array(rows, dtype=np.float64)
    return TurbineModel(
        id=meta["id"],
        name=meta["name"],
        rated_kw=float(meta["rated_kw"]),
        rotor_diameter_m=float(meta["rotor_diameter_m"]),
        hub_height_m=float(meta["hub_height_m"]),
        cut_in_ms=float(meta["cut_in_ms"]),
        rated_ms=float(meta["rated_ms"]),
        cut_out_ms=float(meta["cut_out_ms"]),
        source=meta["source"],
        license=meta["license"],
        reference=meta["reference"],
        retrieved=meta["retrieved"],
        ws_ms=table[:, 0],
        power_kw=table[:, 1],
        ct=table[:, 2],
    )


@cache
def turbine_models() -> dict[str, TurbineModel]:
    """Every packaged turbine model, keyed by id (loaded once)."""
    meta = json.loads((DATA_DIR / "turbines.json").read_text(encoding="utf-8"))
    return {m["id"]: _load(m) for m in meta}


def get_turbine(model_id: str | None = None) -> TurbineModel:
    """The turbine model with this id (default: SB-510's IEA 15 MW)."""
    models = turbine_models()
    key = model_id or DEFAULT_TURBINE_ID
    if key not in models:
        raise ValidationError(f"Unknown turbine model '{key}'. Available: {sorted(models)}")
    return models[key]
