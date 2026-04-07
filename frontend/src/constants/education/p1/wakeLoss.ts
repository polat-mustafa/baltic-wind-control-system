import type { EducationContent } from "../../../types/education";

export const wakeLossEducation: EducationContent = {
  id: "p1.wake-loss",
  title: "Wake Losses & Wake Models",
  subtitle: "How upstream turbines steal energy from downstream ones",
  discipline: "Civil",

  overview:
    "When a turbine extracts kinetic energy from the wind it leaves behind a slower, more turbulent wake. Any turbine " +
    "downstream sits inside that wake and produces less power. The cumulative loss across a 34-turbine farm is typically " +
    "5–15% of gross AEP — the single largest deduction in the cascade. Wake models trade speed against fidelity: Jensen " +
    "(1983) is fast and conservative, Bastankhah-Porté-Agel (2014) is the modern industry default, RANS-CFD is reserved " +
    "for layout optimisation studies.",

  simpleExplanation:
    "Turbines work by slowing the wind down. The slowed wind carries on for several kilometres before recovering. If you " +
    "put another turbine in that slow zone, it makes less power. The trick of farm layout is to give downwind turbines " +
    "enough room to recover — typically 7 rotor diameters across the wind, 10 along the wind direction.",

  technicalExplanation:
    "Modern wake modelling represents the velocity deficit as a Gaussian function of downstream distance, calibrated by " +
    "the thrust coefficient Ct. Multiple wakes are superposed (linear, quadratic, or energy-balance methods). For dense " +
    "farms, blockage (the upstream slowdown caused by the array as a whole) adds another 1–2% loss. Wake steering — " +
    "yawing upstream turbines a few degrees off the wind — recovers 1–4% of farm energy at the cost of higher loads " +
    "on the steered machines.",

  standards: [
    {
      label: "IEC 61400-12-4 — Numerical site calibration & wake models",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment",
      type: "standard",
    },
    {
      label: "IEC 61400-1 — Design conditions inside wakes",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression: "ΔU/U₀ = (1 − √(1 − Ct/(8(σ/D)²))) · exp(−r²/(2σ²))",
      variables: [
        { symbol: "ΔU/U₀", name: "Velocity deficit (fraction)", unit: "—" },
        { symbol: "Ct", name: "Thrust coefficient", unit: "—" },
        { symbol: "σ", name: "Wake half-width", unit: "m" },
        { symbol: "D", name: "Rotor diameter (236 m)", unit: "m" },
        { symbol: "r", name: "Radial distance from wake centre", unit: "m" },
      ],
      explanation:
        "Bastankhah-Porté-Agel Gaussian wake (2014). σ grows linearly with downstream distance: σ = k_w·x + ε_0·D, with " +
        "wake expansion coefficient k_w ≈ 0.025–0.04 offshore. Replaces the older Jensen top-hat profile in modern tools.",
      reference: "Bastankhah & Porté-Agel, Renewable Energy 70 (2014) 116–123",
    },
    {
      expression: "ΔU_total² = Σ ΔU_i²    (quadratic superposition)",
      variables: [
        { symbol: "ΔU_total", name: "Combined deficit at a downstream turbine", unit: "m/s" },
        { symbol: "ΔU_i", name: "Single-wake deficit from upstream turbine i", unit: "m/s" },
      ],
      explanation:
        "Katic-Hojstrup-Jensen quadratic superposition is the de facto standard for combining multiple wakes. Linear " +
        "superposition over-predicts losses; energy-balance is used in research codes.",
      reference: "Katic, Højstrup, Jensen — EWEC 1986",
    },
    {
      expression: "Ct(v) = 4·a(v)·(1 − a(v)),    a = ½(1 − √(1 − Ct))",
      variables: [
        { symbol: "Ct", name: "Thrust coefficient", unit: "—" },
        { symbol: "a", name: "Axial induction factor", unit: "—" },
      ],
      explanation:
        "Actuator-disc relation between thrust coefficient and axial induction. Ct=8/9 corresponds to the Betz optimum " +
        "(a=1/3). Modern controllers reduce Ct above rated to limit loads, which slightly relaxes downstream wakes.",
    },
  ],

  workedExamples: [
    {
      title: "Single Bastankhah wake at 7D downstream",
      scenario:
        "V236 with Ct=0.78 at v=8 m/s, free-stream velocity 8 m/s, downstream distance 7D = 1,652 m, wake expansion k_w = 0.038.",
      steps: [
        "σ = k_w · x + ε_0 · D = 0.038·1652 + 0.235·236 ≈ 62.8 + 55.5 = 118.3 m",
        "σ/D = 118.3 / 236 = 0.501",
        "(σ/D)² = 0.251",
        "Inside √: 1 − Ct / (8·0.251) = 1 − 0.78 / 2.011 = 1 − 0.388 = 0.612",
        "√0.612 = 0.782; 1 − 0.782 = 0.218",
        "ΔU/U₀ on axis (r=0) ≈ 0.218 → centre-line deficit ≈ 22%",
      ],
      result:
        "A turbine 7D downstream sitting on the wake centreline sees ≈ 22% lower wind speed. Power ∝ v³, so its output is " +
        "about 0.78³ ≈ 47% of free-stream — roughly half. This is why edge turbines vastly out-produce inner-row turbines.",
    },
  ],

  realWorldCases: [
    {
      title: "Lillgrund (Sweden) — the close-spacing experiment",
      description:
        "Built with 3.3D × 4.3D spacing as a deliberate stress test. Measured wake losses ~23%, vs ~10% for normally-spaced " +
        "farms. Used to validate Bastankhah and CFD codes for over a decade.",
      takeaway:
        "Spacing tighter than 5D crosswind dramatically degrades AEP. The cost of extra inter-array cable for wider " +
        "spacing is almost always paid back within the first year of operation.",
    },
    {
      title: "Horns Rev 1 (Denmark) — the iconic wake photograph",
      description:
        "Famous photograph from 2008 showing fog condensing in the wakes of all 80 turbines. Used in every wind energy " +
        "textbook to motivate why wake models matter.",
      takeaway:
        "Wakes are not abstract numbers in a spreadsheet — they are visible, persistent, and extend several kilometres downstream.",
    },
    {
      title: "Wake steering trial — TotalEnergies/SSE Beatrice (Scotland)",
      description:
        "Yaw misalignment of 15–20° on upstream turbines recovered 1.4% of farm AEP in trial sectors with no measurable " +
        "increase in fatigue loads on the steered machines.",
      takeaway:
        "Wake steering is moving from research into commercial control products. Expect 1–4% gains as standard within 5 years.",
    },
  ],

  furtherReading: [
    {
      label: "PyWake — open-source wake modelling toolkit (DTU)",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/PyWake/",
    },
    {
      label: "Bastankhah & Porté-Agel — A new analytical model for wind-turbine wakes",
      type: "paper",
      citation: "Renewable Energy 70 (2014) 116–123, doi:10.1016/j.renene.2014.01.002",
    },
    {
      label: "Fleming et al. — Wake steering field campaign",
      type: "paper",
      citation: "Wind Energy Science 4 (2019) 273–285, doi:10.5194/wes-4-273-2019",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wake_model.py",
      description: "Jensen + Bastankhah implementations; quadratic superposition; turbine pair-wise loss matrix.",
    },
    {
      file: "backend/app/services/p1/wake_models.py",
      description: "PyWake wrapper used for the canonical layout-vs-wake studies.",
    },
    {
      file: "backend/app/services/p1/yaw_optimizer.py",
      description: "Wake-steering optimisation by sector — yaw setpoints that maximise farm power.",
    },
  ],

  relatedLessons: ["lesson-005", "lesson-006"],
};
