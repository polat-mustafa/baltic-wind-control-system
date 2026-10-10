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
    "The app uses a real 30-year hindcast at the site — ERA5 ocean-wave model Hs and ERA5 10 m wind, 1995–2024, " +
    "6-hourly worst hour. Access probability is counted, not modelled: the share of 6-hour steps in that month with " +
    "Hs AND wind inside the vessel limits. The classic shortcut — a Rayleigh Hs distribution times a Weibull wind " +
    "distribution, assumed independent (formula below) — gives a CTV 55 % access a year at this site; the measured " +
    "joint frequency gives 68 %, because wind and waves calm down together. Persistence matters too: campaign " +
    "planning replays the historical years, so a 6-hour job needs 6 consecutive good hours of a real year.",

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
        "Rayleigh CDF written with the mean (mean = σ√(π/2)) — the hand estimate when no hindcast is at hand. Not to " +
        "be confused with exp(−2(H/Hs)²), which is the distribution of individual wave heights within one sea state.",
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
        "(H̄s ≈ 1.6–1.8 m) the same calculation gives only ≈ 42–50 %.",
    },
  ],

  realWorldCases: [
    {
      title: "Sheringham Shoal (UK): installation in poor weather",
      description:
        "Unseasonally poor weather slowed turbine installation; the developer brought in a replacement jack-up vessel, used real-time wave monitoring to catch shorter windows and moved the completion date back.",
      takeaway: "Vessel limits on Hs and wind decide the schedule as much as the vessel count — plan on P90 weather, not on the average.",
      source: "Energy Voice, Sheringham Shoal installation coverage",
    },
  ],

  furtherReading: [
    {
      label: "DNV-RP-C205 — Environmental conditions and environmental loads",
      type: "standard",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/weather_window.py",
      description: "Monthly access per vessel from the measured joint Hs / wind frequency; maintenance-window search (M14).",
    },
    {
      file: "backend/app/services/lifecycle/weather.py",
      description: "30-year ERA5 hindcast at SB-510 (scripts/fetch_metocean.py); campaign runs replay historical years.",
    },
  ],

};
