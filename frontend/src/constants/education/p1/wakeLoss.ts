import type { EducationContent } from "../../../types/education";

export const wakeLossEducation: EducationContent = {
  id: "p1.wake-loss",
  title: "Wake Losses & Wake Models",
  subtitle: "How upstream turbines take energy from downstream ones",
  discipline: "Civil",

  overview:
    "A turbine extracts momentum from the wind and leaves a slower, more turbulent wake behind it. Turbines inside " +
    "that wake produce less. Across a large offshore array this is typically the biggest single loss in the cascade " +
    "(often 5–15 %). Offshore wakes are long because the sea surface is smooth and ambient turbulence low, so the " +
    "slowed air mixes back slowly.",

  simpleExplanation:
    "Turbines work by slowing the wind down. That slow air carries on for kilometres before it recovers. A turbine " +
    "placed in it makes less power. Layout design is about giving downstream turbines room to recover — more room " +
    "along the prevailing wind direction than across it.",

  technicalExplanation:
    "This platform uses PyWake's Gaussian deficit (Bastankhah & Porté-Agel 2014) with a turbulence-dependent " +
    "expansion k* = 0.38·TI + 0.004 (Niayifar & Porté-Agel 2016), linear superposition of deficits and the STF2017 " +
    "wake-added-turbulence model — so more turbulent air (higher TI) means faster recovery and lower wake loss. Older tools used the Jensen (1983) top-hat model with quadratic " +
    "superposition (Katić et al. 1986). Power ∝ v³ below rated, so a 10 % speed deficit costs ≈ 27 % of power there — " +
    "but nothing above rated if the waked speed still exceeds rated (10.7 m/s). That is why wake loss as a share of AEP is " +
    "much smaller than single-wake power deficits suggest.",

  standards: [
    {
      label: "IEC 61400-15 (series) — Energy yield assessment (wake loss reporting)",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-1 — Design requirements (wake-added turbulence in load cases)",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression: "ΔU/U₀ = (1 − √(1 − Ct / (8 (σ/D)²))) · exp(−r² / (2σ²)),   σ = k*·x + ε·D",
      variables: [
        { symbol: "ΔU/U₀", name: "Fractional velocity deficit", unit: "—" },
        { symbol: "Ct", name: "Thrust coefficient", unit: "—" },
        { symbol: "σ", name: "Gaussian wake width", unit: "m" },
        { symbol: "k*", name: "Wake expansion rate", unit: "—" },
        { symbol: "ε", name: "Initial width ≈ 0.2√β, β = ½(1+√(1−Ct))/√(1−Ct)", unit: "—" },
        { symbol: "r", name: "Radial distance from wake centre", unit: "m" },
      ],
      explanation: "Bastankhah–Porté-Agel Gaussian wake: deficit decays and widens with downstream distance x.",
      reference: "Bastankhah & Porté-Agel, Renewable Energy 70 (2014) 116–123",
    },
    {
      expression: "Ct = 4a(1 − a)",
      variables: [{ symbol: "a", name: "Axial induction factor", unit: "—" }],
      explanation:
        "Actuator-disk relation. The Betz optimum a = 1/3 gives Ct = 8/9. Above rated, blade pitch lowers Ct, so wakes " +
        "are weaker in strong winds.",
    },
  ],

  workedExamples: [
    {
      title: "Single wake 7 D behind a V236 (centre line)",
      scenario: "Ct = 0.78 (≈ 8 m/s), ambient TI = 6 % → k* = 0.38 × 0.06 + 0.004 = 0.0268, x = 7D = 1,652 m.",
      steps: [
        "β = ½(1 + √0.22)/√0.22 = ½ · 1.469 / 0.469 = 1.566;  ε = 0.2·√1.566 = 0.250",
        "σ = 0.0268 × 1,652 + 0.250 × 236 = 44.3 + 59.0 = 103.3 m  →  σ/D = 0.438",
        "Ct / (8 (σ/D)²) = 0.78 / 1.532 = 0.509",
        "Centre-line deficit = 1 − √(1 − 0.509) = 1 − 0.701 = 0.30",
        "Power ratio at that point ≈ (1 − 0.30)³ = 0.34",
      ],
      result:
        "A turbine exactly on the centre line 7 D downstream sees ≈ 30 % less wind and ≈ 1/3 of the power, at that " +
        "wind speed and direction. Averaged over the rotor, all directions and all speeds, the farm wake loss is far " +
        "smaller — about 5.6 % on the AEP tab.",
    },
  ],

  realWorldCases: [
    {
      title: "Horns Rev 1 (Denmark) — wakes made visible",
      description:
        "A 2008 photograph of the 80-turbine farm in humid, cold conditions shows condensation tracing each turbine's " +
        "wake far downstream.",
      takeaway: "Offshore wakes are persistent and kilometres long — spacing decisions are worth real energy.",
    },
    {
      title: "Lillgrund (Sweden) — very tight spacing",
      description:
        "Built with unusually close spacing (about 3.3 D × 4.3 D). It became a reference data set for wake model " +
        "validation because its wake losses are much larger than at conventionally spaced farms.",
      takeaway: "Spacing below ~5 D gives disproportionately large wake losses.",
    },
  ],

  furtherReading: [
    {
      label: "PyWake — open-source wake modelling (DTU)",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/PyWake/",
    },
    {
      label: "Bastankhah & Porté-Agel — A new analytical model for wind-turbine wakes",
      type: "paper",
      citation: "Renewable Energy 70 (2014) 116–123, doi:10.1016/j.renene.2014.01.002",
    },
    {
      label: "Niayifar & Porté-Agel — Analytical modeling of wind farms: a new approach for power prediction",
      type: "paper",
      citation: "Energies 9 (2016) 741, doi:10.3390/en9090741",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wake_model.py",
      description: "V236 power/Ct curves; PyWake BPA + LinearSum + STF2017 configuration; run_wake_analysis().",
    },
    {
      file: "backend/app/services/p1/wake_models.py",
      description: "Jensen / BPA / NOJ / Zong comparison.",
    },
  ],

};
