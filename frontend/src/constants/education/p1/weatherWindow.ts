import type { EducationContent } from "../../../types/education";

export const weatherWindowEducation: EducationContent = {
  id: "p1.weather-window",
  title: "Weather Windows & Vessel Access",
  subtitle: "When can technicians actually reach a turbine?",
  discipline: "Marine",

  overview:
    "Offshore, a fault is fixed only when a vessel can safely reach the turbine and transfer people. Each access " +
    "method has limits on significant wave height (Hs) and wind speed. The monthly access probability per vessel type " +
    "shows the strong seasonality of the Baltic: summer is easy, winter is not — which is why planned maintenance is " +
    "scheduled in summer and why winter faults last longest.",

  simpleExplanation:
    "A small crew boat can only push its bow against the turbine when the waves are low (about 1.5 m). A big service " +
    "ship with a motion-compensated gangway can work in rougher seas. A helicopter doesn't care about waves but does " +
    "care about wind and visibility. Each month, the chart shows the chance that each of them can get out.",

  technicalExplanation:
    "Long-term Hs within a month is modelled with a Rayleigh distribution (Weibull, k = 2) fitted to the monthly mean " +
    "Hs, and the wind limit with a Weibull wind distribution. Access probability is the product of the wave and wind " +
    "probabilities — an independence approximation; in reality high wind and high waves come together, so the true " +
    "joint probability is higher than the product in benign months and the limits interact. Persistence also matters: " +
    "a 6-hour job needs 6 consecutive good hours, which is less likely than 6 random ones.",

  standards: [
    {
      label: "DNV-RP-C205 — Environmental conditions and environmental loads",
      type: "standard",
    },
    {
      label: "G+ Global Offshore Wind health & safety good practice",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
  ],

  formulas: [
    {
      expression: "P(Hs ≤ H_lim) = 1 − exp(−(π/4) · (H_lim / H̄s)²)",
      variables: [
        { symbol: "H_lim", name: "Vessel wave-height limit", unit: "m" },
        { symbol: "H̄s", name: "Mean significant wave height of the month", unit: "m" },
      ],
      explanation:
        "Rayleigh CDF written with the mean (mean = σ√(π/2)). Not to be confused with exp(−2(H/Hs)²), which is the " +
        "distribution of individual wave heights within one sea state.",
    },
    {
      expression: "E[T_wait] = (1 − p) / p · Δt",
      variables: [
        { symbol: "p", name: "Probability that a Δt window is workable", unit: "—" },
        { symbol: "Δt", name: "Window length", unit: "h" },
      ],
      explanation: "Geometric waiting time if successive windows were independent — a first estimate of weather delay.",
    },
  ],

  workedExamples: [
    {
      title: "CTV wave access in a month with H̄s = 1.05 m",
      scenario: "CTV limit Hs ≤ 1.5 m.",
      steps: [
        "H_lim / H̄s = 1.5 / 1.05 = 1.429;  squared = 2.041",
        "(π/4) × 2.041 = 1.603",
        "P = 1 − exp(−1.603) = 1 − 0.201 = 0.80",
      ],
      result:
        "≈ 80 % of the time the waves allow a CTV transfer; the wind limit lowers it further. In the winter months " +
        "(H̄s ≈ 1.6–1.8 m) the same calculation gives only ≈ 45–50 %.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "DNV-RP-C205 — Environmental conditions and environmental loads",
      type: "standard",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/weather_window.py",
      description: "Monthly Rayleigh Hs and Weibull wind access model per vessel; maintenance-window search (M14).",
    },
  ],

  relatedLessons: ["lesson-006"],
};
