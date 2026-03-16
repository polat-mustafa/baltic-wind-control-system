"""
Multiple wake deficit models for comparative analysis.

Physics
-------
Different wake models represent the velocity deficit downstream of a turbine
using different assumptions about the wake profile shape and expansion rate:

1. **Jensen (1983)** — "top-hat" uniform deficit, linear expansion:
     ΔU/U₀ = (1 - √(1 - Ct)) / (1 + 2kx/D)²
   Simple, fast, conservative. Standard in early wind farm design.

2. **BPA Gaussian (Bastankhah & Porté-Agel, 2014)** — Gaussian deficit profile:
     ΔU/U₀ = (1 - √(1 - Ct/(8(σ/D)²))) × exp(-r²/(2σ²))
   Most widely used. Captures lateral decay realistically.

3. **NOJ (Niels Otto Jensen / Frandsen)** — Modified Jensen with turbulence:
     Like Jensen but with wake-added turbulence scaling expansion rate.

4. **Zong & Porté-Agel (2020)** — Empirical Gaussian based on LES data:
     Similar to BPA but with empirically tuned parameters from large-eddy
     simulation databases. Better accuracy for large rotors.

Turbulence Models
-----------------
- **STF2017** (Frandsen-based): Standard wake-added turbulence model.
- **Crespo-Hernández (1996)**: TI_wake = 0.73 × a^0.8325 × I_0^0.0325 × (x/D)^-0.32
  where a = induction factor, I_0 = ambient TI. Better for closely spaced turbines.

Superposition Models
--------------------
- **LinearSum**: total deficit = Σ individual deficits (standard)
- **SquaredSum**: total deficit = √(Σ deficit²) (energy-conserving)
- **MaxSum**: total deficit = max(individual deficits) (conservative)

References
----------
- Jensen, N.O. (1983). A Note on Wind Generator Interaction. Risø-M-2411.
- Bastankhah, M. & Porté-Agel, F. (2014). J. Fluid Mech., 781, 706-730.
- Zong, H. & Porté-Agel, F. (2020). J. Fluid Mech., 889, A8.
- Crespo, A. & Hernández, J. (1996). J. Wind Eng. Ind. Aerodyn., 61, 71-85.
- Frandsen, S. (2007). Turbulence and turbulence-generated structural loading.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    WakeAnalysisResult,
    create_v236_wind_turbine,
    RATED_POWER_KW,
)


class WakeDeficitModel(str, Enum):
    """Available wake deficit models."""

    JENSEN = "jensen"
    BPA_GAUSSIAN = "bpa_gaussian"
    NOJ = "noj"
    ZONG_GAUSSIAN = "zong_gaussian"


class TurbulenceModel(str, Enum):
    """Available turbulence models."""

    STF2017 = "stf2017"
    CRESPO_HERNANDEZ = "crespo_hernandez"


class SuperpositionModel(str, Enum):
    """Available wake superposition models."""

    LINEAR_SUM = "linear_sum"
    SQUARED_SUM = "squared_sum"
    MAX_SUM = "max_sum"


@dataclass(frozen=True)
class WakeModelComparison:
    """Comparison of multiple wake model results.

    Attributes
    ----------
    results : list[tuple[str, WakeAnalysisResult]]
        (model_name, wake_result) for each model.
    model_names : list[str]
        Names of models compared.
    aep_range_gwh : float
        Range of net AEP across models [GWh].
    wake_loss_range_percent : float
        Range of wake loss across models [%].
    """

    results: list[tuple[str, WakeAnalysisResult]]
    model_names: list[str]
    aep_range_gwh: float
    wake_loss_range_percent: float


def _get_deficit_model(model: WakeDeficitModel) -> Any:
    """Instantiate a PyWake wake deficit model.

    Parameters
    ----------
    model : WakeDeficitModel
        Model identifier.

    Returns
    -------
    py_wake deficit model instance.
    """
    if model == WakeDeficitModel.JENSEN:
        from py_wake.deficit_models import NOJDeficit
        return NOJDeficit()  # NOJ = Niels Otto Jensen (original Jensen top-hat)
    elif model == WakeDeficitModel.BPA_GAUSSIAN:
        from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
        return BastankhahGaussianDeficit()
    elif model == WakeDeficitModel.NOJ:
        from py_wake.deficit_models import NOJDeficit
        return NOJDeficit()
    elif model == WakeDeficitModel.ZONG_GAUSSIAN:
        from py_wake.deficit_models.gaussian import ZongGaussianDeficit
        return ZongGaussianDeficit()
    else:
        msg = f"Unknown deficit model: {model}"
        raise ValueError(msg)


def _get_turbulence_model(model: TurbulenceModel) -> Any:
    """Instantiate a PyWake turbulence model.

    Parameters
    ----------
    model : TurbulenceModel
        Model identifier.

    Returns
    -------
    py_wake turbulence model instance.
    """
    if model == TurbulenceModel.STF2017:
        from py_wake.turbulence_models import STF2017TurbulenceModel
        return STF2017TurbulenceModel()
    elif model == TurbulenceModel.CRESPO_HERNANDEZ:
        from py_wake.turbulence_models import CrespoHernandez
        return CrespoHernandez()
    else:
        msg = f"Unknown turbulence model: {model}"
        raise ValueError(msg)


def _get_superposition_model(model: SuperpositionModel) -> Any:
    """Instantiate a PyWake superposition model.

    Parameters
    ----------
    model : SuperpositionModel
        Model identifier.

    Returns
    -------
    py_wake superposition model instance.
    """
    if model == SuperpositionModel.LINEAR_SUM:
        from py_wake.superposition_models import LinearSum
        return LinearSum()
    elif model == SuperpositionModel.SQUARED_SUM:
        from py_wake.superposition_models import SquaredSum
        return SquaredSum()
    elif model == SuperpositionModel.MAX_SUM:
        from py_wake.superposition_models import MaxSum
        return MaxSum()
    else:
        msg = f"Unknown superposition model: {model}"
        raise ValueError(msg)


def configure_wake_model_flexible(
    site: Any,
    turbine: Any | None = None,
    deficit_model: WakeDeficitModel = WakeDeficitModel.BPA_GAUSSIAN,
    turbulence_model: TurbulenceModel = TurbulenceModel.STF2017,
    superposition_model: SuperpositionModel = SuperpositionModel.LINEAR_SUM,
) -> Any:
    """Configure a PyWake wake model with selectable components.

    Parameters
    ----------
    site : py_wake.site.BaseSite
        PyWake site object.
    turbine : py_wake.wind_turbines.WindTurbine, optional
        PyWake turbine. If None, creates V236-15.0 MW.
    deficit_model : WakeDeficitModel
        Wake deficit model. Default: BPA Gaussian.
    turbulence_model : TurbulenceModel
        Turbulence model. Default: STF2017.
    superposition_model : SuperpositionModel
        Wake superposition. Default: LinearSum.

    Returns
    -------
    py_wake.wind_farm_models.WindFarmModel
        Configured wake model.
    """
    from py_wake.wind_farm_models import All2AllIterative

    if turbine is None:
        turbine = create_v236_wind_turbine()

    return All2AllIterative(
        site=site,
        windTurbines=turbine,
        wake_deficitModel=_get_deficit_model(deficit_model),
        superpositionModel=_get_superposition_model(superposition_model),
        turbulenceModel=_get_turbulence_model(turbulence_model),
    )


def run_wake_analysis_flexible(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: Any,
    deficit_model: WakeDeficitModel = WakeDeficitModel.BPA_GAUSSIAN,
    turbulence_model: TurbulenceModel = TurbulenceModel.STF2017,
    superposition_model: SuperpositionModel = SuperpositionModel.LINEAR_SUM,
) -> WakeAnalysisResult:
    """Run wake analysis with a user-selected model combination.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    site : py_wake.site.BaseSite
        PyWake site object.
    deficit_model : WakeDeficitModel
        Wake deficit model.
    turbulence_model : TurbulenceModel
        Turbulence model.
    superposition_model : SuperpositionModel
        Superposition model.

    Returns
    -------
    WakeAnalysisResult
        Wake analysis result.
    """
    turbine = create_v236_wind_turbine()
    wf_model = configure_wake_model_flexible(
        site, turbine, deficit_model, turbulence_model, superposition_model,
    )

    sim_res = wf_model(x=x_positions_m, y=y_positions_m)

    net_aep_per_turbine = sim_res.aep().values
    per_turbine_net_gwh = net_aep_per_turbine.sum(
        axis=tuple(range(1, net_aep_per_turbine.ndim))
    )

    gross_aep_per_turbine = sim_res.aep(with_wake_loss=False).values
    per_turbine_gross_gwh = gross_aep_per_turbine.sum(
        axis=tuple(range(1, gross_aep_per_turbine.ndim))
    )

    total_net_gwh = float(per_turbine_net_gwh.sum())
    total_gross_gwh = float(per_turbine_gross_gwh.sum())

    wake_loss_pct = (
        (1.0 - total_net_gwh / total_gross_gwh) * 100.0
        if total_gross_gwh > 0 else 0.0
    )

    per_turbine_wake_loss = np.where(
        per_turbine_gross_gwh > 0,
        (1.0 - per_turbine_net_gwh / per_turbine_gross_gwh) * 100.0,
        0.0,
    )

    n_turbines = len(x_positions_m)
    theoretical_gwh = RATED_POWER_KW * 1e-6 * 8760.0 * n_turbines
    capacity_factor = total_net_gwh / theoretical_gwh if theoretical_gwh > 0 else 0.0

    return WakeAnalysisResult(
        gross_aep_gwh=total_gross_gwh,
        net_aep_gwh=total_net_gwh,
        wake_loss_percent=wake_loss_pct,
        per_turbine_aep_gwh=per_turbine_net_gwh.astype(np.float64),
        per_turbine_wake_loss_percent=per_turbine_wake_loss.astype(np.float64),
        capacity_factor=capacity_factor,
    )


def compare_wake_models(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: Any,
    models: list[WakeDeficitModel] | None = None,
) -> WakeModelComparison:
    """Compare multiple wake models on the same layout and site.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    site : py_wake.site.BaseSite
        PyWake site object.
    models : list[WakeDeficitModel], optional
        Models to compare. Default: all four.

    Returns
    -------
    WakeModelComparison
        Comparison results.
    """
    if models is None:
        models = list(WakeDeficitModel)

    results: list[tuple[str, WakeAnalysisResult]] = []
    for model in models:
        result = run_wake_analysis_flexible(
            x_positions_m, y_positions_m, site, deficit_model=model,
        )
        results.append((model.value, result))

    aep_values = [r[1].net_aep_gwh for r in results]
    loss_values = [r[1].wake_loss_percent for r in results]

    return WakeModelComparison(
        results=results,
        model_names=[r[0] for r in results],
        aep_range_gwh=round(max(aep_values) - min(aep_values), 2) if aep_values else 0.0,
        wake_loss_range_percent=round(max(loss_values) - min(loss_values), 2) if loss_values else 0.0,
    )
