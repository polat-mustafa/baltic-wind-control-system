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
    "Global methods (Sobol indices) average over the joint distribution and capture interactions; the backend's " +
    "polynomial-chaos tool reports Sobol indices. Because the AEP cascade is multiplicative and the losses are small, " +
    "interactions between the loss terms are weak, so OAT ranks them almost the same way. The wind-speed → energy step " +
    "is non-linear and turbine-dependent: for the IEA 15 MW at this site, +1 % in Weibull A gives +0.98 % gross AEP (aep_sensitivity()); at a weaker site the same turbine gives more.",

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
      explanation: "'1 % change in x_i gives S_i % change in AEP'. For Weibull A on this site S ≈ 1.0 (0.98 in aep_sensitivity()).",
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
      scenario:
        "P50 = 2,161 GWh/yr (AEP tab); the six components of uncertainty_components() as % of AEP: wind resource 5.51, " +
        "turbine performance 4.0, plant non-wake losses 2.7, wake and blockage 2.1, future variability 0.82, long-term 0.75.",
      steps: [
        "Wind resource (NEWA model, no measurement): ±5.51 % → ±119 GWh",
        "Turbine performance (reference power curve): ±4.0 % → ±86 GWh",
        "Plant non-wake losses: ±2.7 % → ±58 GWh",
        "Wake and blockage model: ±2.1 % → ±45 GWh",
        "Future variability ±0.82 % → ±18 GWh; long-term period ±0.75 % → ±16 GWh",
      ],
      result:
        "The wind-resource term dominates because SB-510 has no on-site measurement, only the NEWA atlas. A floating LiDAR " +
        "campaign buys more bankable energy than refining the cable-loss estimate.",
    },
  ],

  realWorldCases: [
    {
      title: "Ørsted's 2019 production revision",
      description:
        "Better modelling of blockage and wake losses made Ørsted cut the expected lifetime load factor of a European offshore portfolio from 48–50 % to about 48 % and its IRR target from 7.5–8.5 % to 7.0–8.0 %; its share price fell about 7 % that day.",
      takeaway: "One modelling input that shifts energy by a few percent moves the return of a multi-billion project — sensitivity tells you which inputs to measure better.",
      source: "Ørsted company announcement, 29 Oct 2019; offshorewind.biz (2019)",
    },
  ],

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
      description: "Polynomial-chaos expansion with Sobol indices.",
    },
  ],

};
