import type { EducationContent } from "../../../types/education";

export const bessEducation: EducationContent = {
  id: "p2.bess",
  title: "Battery Storage at a Wind Farm",
  subtitle: "Frequency containment, ramp smoothing and what cycling costs",
  discipline: "Electrical",

  overview:
    "A 50 MW / 200 MWh LFP battery at the OSS answers in about a second, far faster than any turbine pitch " +
    "or synchronous governor. It can hold frequency reserve, keep the plant's output within an agreed ramp " +
    "rate and store wind that would otherwise be curtailed. Every one of those duties spends cycles, and " +
    "cycles spend the battery.",

  simpleExplanation:
    "The battery is a buffer. When the grid frequency sags it pushes power in, when it rises it soaks power up, " +
    "and when the wind gusts faster than the grid wants it smooths the step. The more it works, the sooner it wears out.",

  technicalExplanation:
    "FCR in Continental Europe (SO GL, EU 2017/1485) is a linear characteristic: full offered capacity at a " +
    "±200 mHz deviation, measurement insensitivity ±10 mHz, full activation within 30 s. Limited-energy providers " +
    "must hold full activation for a period the TSOs set between 15 and 30 min (Art. 156), so the SOC must keep " +
    "that energy in reserve on both sides. The frequency trace here is an input: 50 MW cannot move the frequency " +
    "of the CE synchronous area. The FFR step is shown as an example of a fast product (Nordic TSOs procure one); " +
    "it is not a PSE service. Ramp smoothing makes the POC follow a ramp-limited copy of the wind output — the " +
    "ramp limit is a plant setting agreed with the TSO, not a fixed code value. Degradation uses an empirical " +
    "LFP model with labelled assumptions: cycle loss (20 % after 3000 full cycles at 80 % DoD, scaled by " +
    "(80 %/DoD)^1.5) plus calendar loss (0.5 %/year). Positive battery power means discharging.",

  standards: [
    { label: "Commission Regulation (EU) 2017/1485 (SO GL) — FCR, Art. 154–156 and Annex V", type: "regulation" },
    { label: "IEC 62933 — Electrical energy storage systems", type: "standard" },
  ],

  formulas: [
    {
      expression: "P = P_FCR · clamp((50 − f) / 0.2 Hz, −1, 1)",
      variables: [
        { symbol: "P_FCR", name: "Offered FCR capacity", unit: "MW" },
        { symbol: "f", name: "System frequency", unit: "Hz" },
      ],
      explanation: "CE FCR characteristic, positive = discharge. Zero inside ±10 mHz.",
    },
    {
      expression: "t_end = (SOC − SOC_min) · E_n / P_FCR",
      variables: [
        { symbol: "E_n", name: "Usable energy per % SOC × 100", unit: "MWh" },
        { symbol: "SOC_min", name: "Lower SOC limit (10 %)", unit: "%" },
      ],
      explanation: "Minutes the battery can hold full FCR; SO GL asks for 15–30 min.",
    },
    {
      expression: "SOH = 100 − L_cycle − L_calendar",
      variables: [
        { symbol: "L_cycle", name: "20 % · N / (3000 · (80/DoD)^1.5)", unit: "%" },
        { symbol: "L_calendar", name: "0.5 % per year", unit: "%" },
      ],
      explanation: "The two ageing paths add; end of life at 80 % SOH.",
    },
  ],

  workedExamples: [
    {
      title: "How long can 50 MW of FCR last?",
      scenario: "SOC 60 %, 200 MWh, SOC window 10–90 %.",
      steps: [
        "Energy above the floor: (60 − 10) % × 200 MWh = 100 MWh",
        "At full 50 MW: 100 / 50 = 2 h of discharge",
        "Charging side: (90 − 60) % × 200 MWh / 0.92 = 65 MWh drawn ≈ 78 min at 50 MW",
      ],
      result:
        "Both directions exceed the 15–30 min limited-energy requirement, so all 50 MW can be offered; at SOC 16 % only 14 min remain and FCR is refused.",
    },
  ],

  realWorldCases: [
    {
      title: "Dynamic Containment (GB), first day in service",
      description:
        "National Grid ESO's sub-second post-fault frequency service went live on 1 October 2020 with batteries as the first providers. The next day an interconnector fault removed about 1 GW; frequency fell to 49.597 Hz and one battery was discharging over 28 MW within 10 s.",
      takeaway: "Batteries are bought for speed: they deliver frequency response in under a second, faster than turbines or governors.",
      source: "National Grid ESO (NESO) press release, Oct 2020; Current± (2020)",
    },
  ],

  furtherReading: [
    {
      label: "ENTSO-E — Limited energy reservoirs: CBA on the minimum activation period (SO GL Art. 156(10))",
      type: "website",
      citation: "ENTSO-E, 2019",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/bess.py", description: "FCR characteristic, SOC bookkeeping, ramp smoothing, degradation, dispatch." },
  ],
};
