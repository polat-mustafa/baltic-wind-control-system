import type { EducationContent } from "../../../types/education";

export const farmConfigEducation: EducationContent = {
  id: "p1.farm-config",
  title: "Farm Layout Configuration (M04)",
  subtitle: "Why turbine spacing follows the 7D × 10D rule",
  discipline: "Civil",

  overview:
    "Spacing turbines is a trade-off: too close and wakes destroy AEP; too far and cable cost explodes. The classical " +
    "rule of thumb is 7 rotor diameters (7D) along the prevailing wind direction and 10 D across it. For the V236 (236 m " +
    "rotor) that translates to 1,652 m × 2,360 m grid pitch — and a 510 MW farm covering ~70 km² of seabed.",

  simpleExplanation:
    "Wind turbines need elbow room. If you put them too close together, the turbine in front 'eats' the wind before it " +
    "reaches the one behind — and you lose 20–30% of the energy you paid to build. But spacing them out means much longer " +
    "(and more expensive) cables. The 7D × 10D rule is the sweet spot most projects start from before optimising further.",

  technicalExplanation:
    "Wake recovery scales roughly with downwind distance x as ΔU ∝ exp(−x/(k·D)), with k ≈ 0.04 (offshore) — meaning the " +
    "deficit halves over ~7D. Crosswind spacing matters less because adjacent rows rarely shadow each other. PyWake-driven " +
    "layout optimisation can typically squeeze out 1–3% more AEP than a pure 7D × 10D grid by exploiting the asymmetric wind " +
    "rose, but only with sound foundation cost data — otherwise the optimiser places turbines in expensive seabed.",

  standards: [
    {
      label: "IEC 61400-1 — Site classification & wind farm wake effects",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment",
      type: "standard",
    },
    {
      label: "Burton et al., Wind Energy Handbook 2e §3",
      type: "textbook",
      citation: "Wiley 2011, ISBN 978-0-470-69975-1",
    },
  ],

  formulas: [
    {
      expression: "Area_farm ≈ N_turbines · (S_x · D) · (S_y · D)",
      variables: [
        { symbol: "N_turbines", name: "Number of turbines", unit: "—" },
        { symbol: "D", name: "Rotor diameter", unit: "m" },
        { symbol: "S_x, S_y", name: "Spacing in rotor diameters along × across wind", unit: "—" },
      ],
      explanation:
        "First-order area estimate. For 34 × V236 at 7 × 10 D: 34 · 1,652 · 2,360 ≈ 132 km² envelope; the actual seabed lease " +
        "is about half that because the perimeter row only counts once.",
    },
    {
      expression: "L_cable_intra ≈ N_turbines · S_y · D · k_topology",
      variables: [
        { symbol: "L_cable_intra", name: "Total intra-array cable length", unit: "m" },
        { symbol: "k_topology", name: "Topology factor: 1.0 radial, 1.4 ring, 1.6 mesh", unit: "—" },
      ],
      explanation:
        "Cable cost is roughly proportional to length. A radial topology is cheapest but loses the whole string on a single " +
        "fault; ring topologies cost ~40% more but allow restoration after a fault, important for revenue protection.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW seabed footprint",
      scenario:
        "34 × V236-15.0 MW, prevailing wind from west, 7D × 10D grid, ring topology.",
      steps: [
        "S_x · D = 7 × 236 = 1,652 m (along-wind pitch)",
        "S_y · D = 10 × 236 = 2,360 m (cross-wind pitch)",
        "Approx. envelope = 34 × 1,652 × 2,360 ≈ 132,500,000 m² ≈ 132 km²",
        "Effective lease (perimeter discount ≈ 50%) ≈ 66 km²",
        "Intra-array cable length ≈ 34 × 2,360 × 1.4 ≈ 112 km of 66 kV cable",
      ],
      result:
        "~66 km² seabed, ~112 km of 66 kV array cable. The cable cost (~110 M EUR at 1,000 EUR/m installed) is the largest " +
        "single non-turbine balance-of-plant line item.",
    },
  ],

  realWorldCases: [
    {
      title: "Horns Rev 1 — the original 7D × 7D grid",
      description:
        "80 × Vestas V80 in a regular 7 × 7 grid. Operational SCADA showed wake losses ~12%, higher than the planning estimate " +
        "because long-distance wakes between rows had been under-modelled. Subsequent farms widened cross-wind spacing to 10 D.",
      takeaway:
        "Symmetric grids feel intuitively right but trade AEP for simplicity. Modern projects use asymmetric spacing aligned " +
        "with the wind rose.",
    },
    {
      title: "Hornsea 2 — irregular layout",
      description:
        "165 × SG 8.0 MW arranged in an irregular pattern that hugs the seabed bathymetry to avoid sand-wave migration and " +
        "minimise foundation cost. PyWake/AEP optimisation accepted ~1% more wake loss in exchange for ~80 M GBP foundation savings.",
      takeaway:
        "Layout optimisation must include foundation cost surfaces; pure AEP optimisation produces 'all turbines on the cheapest " +
        "rocks' which loses money overall.",
    },
  ],

  furtherReading: [
    {
      label: "PyWake — wind farm wake & layout optimisation",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/PyWake/",
    },
    {
      label: "Stevens et al. — Optimal turbine spacing in fully developed wind farm boundary layers",
      type: "paper",
      citation: "Wind Energy 19 (2016), doi:10.1002/we.1835",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/farm_layout.py",
      description: "Grid generator + cable router for the M04 multi-farm comparison module.",
    },
  ],

  relatedLessons: ["lesson-005", "lesson-006"],
};
