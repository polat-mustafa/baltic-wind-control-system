"""P1 — Wind Resource & AEP services."""

from app.services.p1.aep_calculator import (
    AEPCascadeResult,
    LayoutComparisonResult,
    LossFactor,
    apply_loss_cascade,
    compare_layouts,
    compute_aep_cascade,
    compute_exceedance_values,
    compute_rss_uncertainty,
)
from app.services.p1.blockage import (
    BlockageResult,
    compute_array_density,
    estimate_blockage_loss_percent,
)
from app.services.p1.layout_optimizer import (
    LayoutResult,
    check_minimum_spacing,
    compute_pairwise_distances_m,
    generate_regular_grid,
    generate_staggered_grid,
    optimize_layout,
)

__all__ = [
    "AEPCascadeResult",
    "BlockageResult",
    "LayoutComparisonResult",
    "LayoutResult",
    "LossFactor",
    "apply_loss_cascade",
    "check_minimum_spacing",
    "compare_layouts",
    "compute_aep_cascade",
    "compute_array_density",
    "compute_exceedance_values",
    "compute_pairwise_distances_m",
    "compute_rss_uncertainty",
    "estimate_blockage_loss_percent",
    "generate_regular_grid",
    "generate_staggered_grid",
    "optimize_layout",
]
