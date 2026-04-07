import type { EducationContent } from "../../../types/education";

export const aepCascadeEducation: EducationContent = {
  id: "p1.aep-cascade",
  title: "AEP Cascade & P-Value Bands",
  subtitle: "From gross energy to bankable P50 / P75 / P90",
  discipline: "Civil",

  overview:
    "The AEP cascade is the waterfall that takes you from a turbine's theoretical gross energy to the net energy that " +
    "actually reaches the grid. Each step is a loss factor: wake, blockage, electrical, availability, environmental, " +
    "curtailment. The result is a probability distribution — banks finance against P90 (90% exceedance), equity against " +
    "P50, and PPA buyers price against P75. Misreporting any of these is a financing red flag.",

  simpleExplanation:
    "Imagine pouring water (energy) through a series of sieves. Each sieve catches a little — turbines downwind get less " +
    "wind (wake), some hours the turbine is broken (availability), the cables warm up and lose a bit (electrical). The " +
    "water that comes out at the end is the energy you can sell. Banks want to know the answer in a bad year, not an " +
    "average year — that is what P90 means.",

  technicalExplanation:
    "Net AEP = Gross AEP × (1 − wake) × (1 − availability) × (1 − electrical) × (1 − environmental) × (1 − curtailment). " +
    "Each loss carries an uncertainty; the P-value bands come from combining the wind resource uncertainty with the loss " +
    "uncertainties via root-sum-square (assuming independence) per IEC 61400-15-2. Typical offshore: P50/P90 ratio ≈ 1.10–1.15. " +
    "DSCR-driven debt sizing uses P90 cash flows; equity returns are modelled at P50; PPAs are typically priced at P75.",

  standards: [
    {
      label: "IEC 61400-15-2 — Energy yield assessment uncertainty",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment of offshore wind farms",
      type: "standard",
    },
    {
      label: "MEASNET — Evaluation of Site-Specific Wind Conditions",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
    {
      label: "IEC 61400-1 — Wind turbine design requirements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression:
        "AEP_net = AEP_gross · (1−L_wake) · (1−L_avail) · (1−L_elec) · (1−L_env) · (1−L_curt)",
      variables: [
        { symbol: "AEP_gross", name: "Gross AEP from Weibull × power curve", unit: "MWh/yr" },
        { symbol: "L_wake", name: "Wake loss (5–15% offshore)", unit: "—" },
        { symbol: "L_avail", name: "Availability loss (3–6%)", unit: "—" },
        { symbol: "L_elec", name: "Electrical losses (1.5–3%)", unit: "—" },
        { symbol: "L_env", name: "Environmental (icing, soiling) (<1% offshore)", unit: "—" },
        { symbol: "L_curt", name: "Curtailment (grid, environmental)", unit: "—" },
      ],
      explanation:
        "Multiplicative loss model — order matters only conceptually. Each L_i is itself uncertain; the loss list is " +
        "the same one DNV uses in its bankable energy yield templates.",
      reference: "DNV-RP-J103 §5",
    },
    {
      expression: "P_x = AEP_net · (1 − z_x · σ_combined)",
      variables: [
        { symbol: "P_x", name: "x% exceedance AEP", unit: "MWh/yr" },
        { symbol: "z_x", name: "Standard normal quantile (P90 → 1.282)", unit: "—" },
        { symbol: "σ_combined", name: "Combined relative uncertainty", unit: "—" },
      ],
      explanation:
        "Linear approximation valid when σ ≪ 1. P50 = AEP_net (z=0); P75 ≈ −0.674·σ; P90 ≈ −1.282·σ; P99 ≈ −2.326·σ.",
    },
    {
      expression:
        "σ_combined² = σ_wind² + σ_wake² + σ_avail² + σ_elec² + σ_curt²",
      variables: [
        { symbol: "σ_wind", name: "Wind resource uncertainty (~3–5%)", unit: "—" },
        { symbol: "σ_wake", name: "Wake model uncertainty (~1–2%)", unit: "—" },
        { symbol: "σ_avail", name: "Availability uncertainty (~1–2%)", unit: "—" },
      ],
      explanation:
        "Root-sum-square aggregation under independence assumption. Wind resource always dominates; that is why long-term " +
        "MCP correction is the highest-leverage step in any energy yield assessment.",
      reference: "IEC 61400-15-2 §6",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW — full cascade",
      scenario:
        "510 MW (34 × V236-15.0 MW), V_mean ≈ 10 m/s, capacity factor ≈ 50%. Gross AEP from Weibull × power curve = 2,520 GWh.",
      steps: [
        "Wake loss 8% → 2,520 × 0.92 = 2,318 GWh",
        "Availability loss 4% → 2,318 × 0.96 = 2,225 GWh",
        "Electrical loss 2.5% → 2,225 × 0.975 = 2,170 GWh",
        "Environmental loss 0.5% → 2,170 × 0.995 = 2,159 GWh",
        "Curtailment 1% → 2,159 × 0.99 = 2,138 GWh",
      ],
      result:
        "Net AEP P50 ≈ 2,140 GWh/yr; capacity factor 47.9%. Combined σ ≈ 6.5% → P90 ≈ 1,962 GWh; P75 ≈ 2,049 GWh.",
    },
  ],

  realWorldCases: [
    {
      title: "Borssele I+II (Netherlands, 752 MW)",
      description:
        "Reported losses (DNV-bankable): wake ~9%, availability ~3.5%, electrical ~2.0%. Capacity factor in operation 50.4% in 2022.",
      takeaway:
        "Real-world operating capacity factor often beats P50 by 1–2 percentage points after the first two operational years " +
        "thanks to better-than-modelled availability.",
    },
    {
      title: "Walney Extension (UK, 659 MW) — over-performance",
      description:
        "Achieved 51% capacity factor in its first full year vs P50 forecast of 47%. Driver: better-than-expected wake " +
        "calibration (Bastankhah model recalibrated to operational SCADA).",
      takeaway:
        "P50 forecasts tend to be conservative on wake; modelled losses are systematically higher than measured for well-spaced layouts.",
    },
  ],

  furtherReading: [
    {
      label: "DNV — Energy yield assessment best practice",
      type: "website",
    },
    {
      label: "Clifton et al. — IEA Wind Task 43 Recommended Practice on Uncertainty",
      type: "paper",
      citation: "Wind Energy Science 2022, doi:10.5194/wes-7-2363-2022",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "compute_aep_cascade() — multiplicative loss model + P-value generation via the IEC 61400-15-2 RSS rule.",
    },
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Monte Carlo and polynomial chaos UQ for the cascade; produces full P-value distributions.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
