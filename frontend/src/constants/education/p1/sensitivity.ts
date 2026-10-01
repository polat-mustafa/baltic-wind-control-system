import type { EducationContent } from "../../../types/education";

export const sensitivityEducation: EducationContent = {
  id: "p1.sensitivity",
  title: "AEP Sensitivity",
  subtitle: "Which input moves net energy the most?",
  discipline: "Civil",

  overview:
    "Sensitivity analysis tells you which inputs deserve engineering effort. The sliders in this drawer (Weibull A and " +
    "k, turbulence intensity, price) let you feel it directly: change one, re-run, and see how AEP and revenue respond. " +
    "Formally, a tornado chart ranks inputs by how far the output moves when each is varied over its uncertainty.",

  simpleExplanation:
    "If you could improve only one thing next quarter — better wind data, a better wake model, faster repairs — which " +
    "would change the answer most? Sensitivity analysis points at it, so effort is not wasted on inputs that barely " +
    "matter.",

  technicalExplanation:
    "One-at-a-time (OAT) analysis varies each input by ±1σ with the others fixed — cheap and easy to communicate. " +
    "Global methods (Sobol indices) average over the joint distribution and capture interactions; the Research Lab's " +
    "polynomial-chaos tool reports Sobol indices. Because the AEP cascade is multiplicative and the losses are small, " +
    "interactions between the loss terms are weak, so OAT ranks them almost the same way. The wind-speed → energy step " +
    "is non-linear and turbine-dependent: for the V236 at this site, +1 % in Weibull A gives only +1.2 % gross AEP.",

  standards: [
    {
      label: "JCGM 100 — Guide to the Expression of Uncertainty in Measurement (GUM)",
      type: "standard",
      url: "https://www.bipm.org/en/committees/jc/jcgm",
    },
    {
      label: "Saltelli et al. — Global Sensitivity Analysis: The Primer",
      type: "textbook",
      citation: "Wiley 2008",
    },
  ],

  formulas: [
    {
      expression: "S_i = (∂AEP / ∂x_i) · (x_i / AEP)",
      variables: [
        { symbol: "S_i", name: "Normalised (elasticity) sensitivity to input i", unit: "—" },
        { symbol: "x_i", name: "Input i", unit: "varies" },
      ],
      explanation: "'1 % change in x_i gives S_i % change in AEP'. For Weibull A on this site S ≈ 1.2.",
    },
    {
      expression: "S_i^Sobol = Var[E(Y | x_i)] / Var(Y)",
      variables: [
        { symbol: "Y", name: "Output (AEP or LCOE)", unit: "varies" },
      ],
      explanation: "Share of output variance explained by input i alone; the total index adds interactions.",
    },
  ],

  workedExamples: [
    {
      title: "Tornado for this platform's AEP (±1σ of each source)",
      scenario: "P50 = 2,077 GWh/yr; uncertainty sources as % of AEP: wind 4, wake 3, long-term 3, shear 2, availability 2.",
      steps: [
        "Wind resource: ±4 % → ±83 GWh",
        "Wake model: ±3 % → ±62 GWh",
        "Long-term correction: ±3 % → ±62 GWh",
        "Shear, availability: ±2 % → ±42 GWh each",
      ],
      result:
        "The wind-resource terms (data + long-term + shear) dominate. More measurement — a floating LiDAR campaign, a " +
        "longer reference period — buys more bankable energy than refining the cable-loss estimate.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "SALib — Python sensitivity analysis library",
      type: "website",
      url: "https://salib.readthedocs.io",
    },
  ],

  codeReferences: [
    {
      file: "frontend/src/components/p1/SensitivityPanel.tsx",
      description: "Weibull A/k, turbulence and price controls that re-run the analysis.",
    },
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Polynomial-chaos expansion with Sobol indices (Research Lab).",
    },
  ],

  relatedLessons: ["lesson-006"],
};
