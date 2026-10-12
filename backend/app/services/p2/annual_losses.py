"""
Annual electrical loss of a farm from its own load flow (engineering audit F3).

P1's loss cascade used a fixed "typical" electrical loss (2.0 %). The P2 network already
gives the losses at any operating point, so the annual figure follows from it:

    loss fraction = Σ_bins h(v) · L(P_farm(v)) / Σ_bins h(v) · P_farm(v)

- L(P): total loss of the network at farm output P — cables (export as the exact long-line
  π with dielectric loss), the OSS / onshore / WTG transformers, shunt reactors, STATCOM and
  the OSS auxiliary load (``network_model.loss_breakdown_mw``), each point solved with the
  operator's STATCOM and reactor dispatch (``load_flow.dispatch_with_reactor_switching``).
  Solved at ``LOSS_CURVE_POINTS`` outputs and interpolated linearly; cached per design.
- P_farm(v) = N · P_turbine(v) · (1 − wake loss): the reference power curve of the farm's
  turbine at the free-stream hub wind, reduced uniformly by the farm's wake loss
  (approximation: wakes in fact shift output from high to medium power more than evenly).
- h(v): hours per year in each 0.05 m/s bin of the site's Weibull distribution.

The no-load part (reactors, dielectric loss, transformer iron, STATCOM standby, auxiliary)
runs all year, also below cut-in, so it is a larger share at low capacity factor.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandapower as pp

from app.services.p2.network_model import SB510, FarmSpec, build_network, loss_breakdown_mw

logger = logging.getLogger(__name__)

LOSS_CURVE_POINTS = 6  # 0, 20, 40, 60, 80, 100 % of rated output
SOURCE = (
    "P2 load flow of this design (cables, transformers incl. WTG units, reactors, STATCOM, "
    "OSS auxiliary) at 6 output levels, weighted with the site Weibull through the power "
    "curve and the wake loss"
)


@dataclass(frozen=True)
class AnnualElectricalLoss:
    fraction: float  # of the energy produced by the turbines [-]
    loss_gwh: float  # [GWh/yr]
    produced_gwh: float  # turbine output before electrical losses [GWh/yr]
    no_load_mw: float  # losses + auxiliary at zero output [MW]
    full_load_mw: float  # at rated output [MW]
    breakdown_gwh: dict[str, float]  # by component [GWh/yr]


@lru_cache(maxsize=32)
def operating_curve(spec: FarmSpec = SB510) -> tuple[np.ndarray, np.ndarray, dict[str, np.ndarray]]:
    """Output fractions; total loss [MW]; loss by component [MW] plus "export_current_a",
    the current of one export circuit at its more loaded end [A] — each point a load flow
    with the operator's dispatch."""
    from app.services.p2.load_flow import dispatch_with_reactor_switching

    fractions = np.linspace(0.0, 1.0, LOSS_CURVE_POINTS)
    totals: list[float] = []
    parts: dict[str, list[float]] = {}
    for f in fractions:
        net = build_network(generation_fraction=float(f), spec=spec)
        dispatch_with_reactor_switching(net, spec.statcom_mvar)
        pp.runpp(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-8)
        breakdown = loss_breakdown_mw(net) if net.converged else {}
        for k, v in breakdown.items():
            parts.setdefault(k, []).append(v)
        totals.append(sum(breakdown.values()) if breakdown else math.nan)
        ex = net.res_line.loc[net.line.name == "Export_220kV"]
        par = float(net.line.loc[ex.index, "parallel"].iloc[0]) if len(ex) else 1.0
        i_end = float(ex[["i_from_ka", "i_to_ka"]].max(axis=1).iloc[0]) / par if len(ex) else 0.0
        parts.setdefault("export_current_a", []).append(i_end * 1e3 if net.converged else math.nan)
    total = np.asarray(totals, dtype=np.float64)
    if np.isnan(total).any():  # a non-converged point: fill from its neighbours
        ok = ~np.isnan(total)
        total = np.interp(fractions, fractions[ok], total[ok])
        logger.warning("loss curve of %s: %d load flows did not converge", spec.name, (~ok).sum())
    return fractions, total, {k: np.asarray(v, dtype=np.float64) for k, v in parts.items()}


def loss_curve(spec: FarmSpec = SB510) -> tuple[np.ndarray, np.ndarray, dict[str, np.ndarray]]:
    """Output fractions, total loss [MW] and the loss by component at each [MW]."""
    fractions, total, parts = operating_curve(spec)
    return fractions, total, {k: v for k, v in parts.items() if k != "export_current_a"}


def annual_electrical_loss(
    weibull_a: float,
    weibull_k: float,
    wake_loss_fraction: float = 0.0,
    spec: FarmSpec = SB510,
    turbine_model: str | None = None,
) -> AnnualElectricalLoss:
    """Annual electrical loss of ``spec`` at a site Weibull (see the module docstring)."""
    from app.services.p1.turbine_models import get_turbine

    turbine = get_turbine(turbine_model)
    v = np.arange(0.0, 40.0, 0.05)
    pdf = (
        (weibull_k / weibull_a)
        * (v / weibull_a) ** (weibull_k - 1)
        * np.exp(-((v / weibull_a) ** weibull_k))
    )
    hours = pdf * 0.05 * 8760.0
    frac = turbine.power_curve_kw(v) / turbine.rated_kw * (1.0 - wake_loss_fraction)
    fractions, total, parts = loss_curve(spec)
    produced_mwh = float(np.sum(hours * frac * spec.capacity_mw))
    loss_mwh = float(np.sum(hours * np.interp(frac, fractions, total)))
    breakdown = {
        k: float(np.sum(hours * np.interp(frac, fractions, p))) / 1e3 for k, p in parts.items()
    }
    return AnnualElectricalLoss(
        fraction=loss_mwh / produced_mwh if produced_mwh > 0 else 0.0,
        loss_gwh=loss_mwh / 1e3,
        produced_gwh=produced_mwh / 1e3,
        no_load_mw=float(total[0]),
        full_load_mw=float(total[-1]),
        breakdown_gwh=breakdown,
    )
