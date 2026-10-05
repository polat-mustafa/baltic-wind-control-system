"""Screening criteria for offshore wind site selection (GIS multi-criteria).

Two kinds of criteria, as in marine spatial planning practice:

* hard exclusions — a cell that meets one is unavailable, whatever its score;
* soft criteria — scored 0…1 and combined by a weighted linear combination
  (weights renormalised over the criteria that have data).

Every threshold carries its provenance. Values marked ``illustrative`` are
teaching defaults, not regulatory limits: national rules, project
economics and technology move them, and the API lets the user change them.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any

NAUTICAL_MILE_KM = 1.852
TERRITORIAL_SEA_NM = 12.0

ILLUSTRATIVE = "illustrative"


@dataclass(frozen=True)
class Criteria:
    # ── Hard exclusions ──────────────────────────────────────────
    exclude_territorial_sea: bool = True
    territorial_sea_km: float = TERRITORIAL_SEA_NM * NAUTICAL_MILE_KM
    cable_buffer_km: float = 0.5
    owf_buffer_km: float = 0.0
    exclude_protected: bool = True
    min_depth_m: float = 10.0
    max_depth_m: float = 1000.0

    # ── Soft criteria (score 1 at "ideal", 0 at "max") ───────────
    shore_ideal_km: float = TERRITORIAL_SEA_NM * NAUTICAL_MILE_KM
    shore_max_km: float = 100.0
    grid_ideal_km: float = 30.0
    grid_max_km: float = 150.0
    weight_depth: float = 0.4
    weight_shore: float = 0.3
    weight_grid: float = 0.3

    # ── Classes and reporting ────────────────────────────────────
    suitable_score: float = 0.6
    marginal_score: float = 0.3
    protected_screening_km: float = 10.0
    power_density_mw_km2: float = 4.5

    def with_overrides(self, overrides: dict[str, Any] | None) -> Criteria:
        """Copy with the given fields replaced (unknown keys are ignored by the caller's schema)."""
        return replace(self, **(overrides or {}))

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class CriterionInfo:
    key: str
    label: str
    unit: str
    kind: str  # "exclusion" | "score" | "class" | "report"
    provenance: str
    note: str = ""


CRITERIA_INFO: tuple[CriterionInfo, ...] = (
    CriterionInfo(
        "exclude_territorial_sea",
        "Exclude the territorial sea",
        "",
        "exclusion",
        "Case study rule: in Poland offshore wind farms may only be built in the EEZ "
        "(Act on the maritime areas of the Republic of Poland and maritime administration).",
        "Other Member States allow OWFs in the territorial sea; switch off for a generic study.",
    ),
    CriterionInfo(
        "territorial_sea_km",
        "Territorial sea breadth",
        "km",
        "exclusion",
        "UNCLOS Art. 3: up to 12 nautical miles (22.224 km) from the baseline.",
        "Approximated here as distance from the coastline; the legal baseline differs "
        "(Marine Regions limits replace it once imported).",
    ),
    CriterionInfo(
        "cable_buffer_km",
        "Buffer around subsea cables",
        "km",
        "exclusion",
        ILLUSTRATIVE,
        "Crossing and proximity agreements with the cable owner set the real value.",
    ),
    CriterionInfo(
        "owf_buffer_km",
        "Buffer around other wind farm areas",
        "km",
        "exclusion",
        ILLUSTRATIVE,
        "A wider buffer reduces wake losses between neighbouring farms.",
    ),
    CriterionInfo(
        "exclude_protected",
        "Exclude Natura 2000 sites",
        "",
        "exclusion",
        ILLUSTRATIVE,
        "Natura 2000 is not an automatic ban: projects there need an appropriate assessment "
        "(Habitats Directive 92/43/EEC, Art. 6(3)). Screening tools commonly exclude them.",
    ),
    CriterionInfo(
        "min_depth_m",
        "Minimum water depth",
        "m",
        "exclusion",
        ILLUSTRATIVE,
        "Installation vessels need draught; very shallow water is often also sensitive habitat.",
    ),
    CriterionInfo(
        "max_depth_m",
        "Maximum water depth",
        "m",
        "exclusion",
        ILLUSTRATIVE,
        "Floating foundations move this limit far beyond fixed-bottom depths.",
    ),
    CriterionInfo(
        "shore_ideal_km",
        "Shore distance with full score",
        "km",
        "score",
        ILLUSTRATIVE,
        "Closer means a shorter export cable and shorter O&M transits.",
    ),
    CriterionInfo("shore_max_km", "Shore distance with zero score", "km", "score", ILLUSTRATIVE),
    CriterionInfo(
        "grid_ideal_km",
        "Grid-node distance with full score",
        "km",
        "score",
        ILLUSTRATIVE,
        "Straight-line distance to the onshore grid connection point.",
    ),
    CriterionInfo("grid_max_km", "Grid-node distance with zero score", "km", "score", ILLUSTRATIVE),
    CriterionInfo("weight_depth", "Weight: water depth", "", "score", ILLUSTRATIVE),
    CriterionInfo("weight_shore", "Weight: distance to shore", "", "score", ILLUSTRATIVE),
    CriterionInfo("weight_grid", "Weight: distance to grid", "", "score", ILLUSTRATIVE),
    CriterionInfo("suitable_score", "Score for 'suitable'", "", "class", ILLUSTRATIVE),
    CriterionInfo("marginal_score", "Score for 'marginal'", "", "class", ILLUSTRATIVE),
    CriterionInfo(
        "protected_screening_km",
        "Natura 2000 screening distance",
        "km",
        "report",
        ILLUSTRATIVE,
        "Art. 6(3) applies to any project likely to have a significant effect on a site, "
        "including projects outside it; the distance only triggers the screening question.",
    ),
    CriterionInfo(
        "power_density_mw_km2",
        "Installed capacity density",
        "MW/km²",
        "report",
        "SB-510 case study: 510 MW within its ≈ 112 km² site boundary ≈ 4.5 MW/km².",
        "Real farms span a wide range; spacing (in rotor diameters) drives it.",
    ),
)


@dataclass(frozen=True)
class DepthBand:
    """Score of a water-depth band for the foundation technology that fits it."""

    min_m: float
    max_m: float
    score: float
    foundation: str


#: Depth scoring (illustrative): fixed-bottom foundations are cheapest in
#: moderate depths, jackets extend the range, floating costs more today.
DEPTH_BANDS: tuple[DepthBand, ...] = (
    DepthBand(10.0, 20.0, 0.7, "monopile (shallow: vessel access, sensitive habitats)"),
    DepthBand(20.0, 50.0, 1.0, "monopile / jacket"),
    DepthBand(50.0, 70.0, 0.6, "jacket"),
    DepthBand(70.0, 1000.0, 0.3, "floating"),
)


def depth_band(depth_m: float) -> DepthBand | None:
    for band in DEPTH_BANDS:
        if band.min_m <= depth_m < band.max_m:
            return band
    return None
