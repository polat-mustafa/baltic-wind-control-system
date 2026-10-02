import type { EducationContent } from "../../../types/education";

export const marketEducation: EducationContent = {
  id: "p2.market",
  title: "Selling Offshore Wind on the Polish Market",
  subtitle: "Day-ahead schedule, imbalance at CEN, the two-sided CfD and a battery",
  discipline: "Finance",

  overview:
    "The farm sells its forecast on the day-ahead market a day before delivery. When the wind blows differently, the " +
    "deviation from that schedule is settled with PSE at the imbalance price CEN. On top sits a two-sided contract for " +
    "difference: the farm receives or pays back the gap between the strike and the day-ahead price for every MWh it " +
    "delivers. The battery earns separately, by buying cheap hours and selling dear ones.",

  simpleExplanation:
    "Wind costs nothing to burn, so the farm offers everything it expects to make at a price of zero. When the price " +
    "turns negative it would pay to produce, and the CfD pays nothing in those hours, so it stops. Every forecast miss " +
    "costs a little: when this farm is short, its neighbours usually are too, so the balancing energy is dear.",

  technicalExplanation:
    "TGE's day-ahead market is coupled with the rest of Europe in SDAC: one auction at noon the day before, clearing " +
    "prices between −500 and +4 000 €/MWh, and 15-minute periods since delivery day 1 October 2025 (this tab shows " +
    "hours for readability). Since PSE's balancing reform of 14 June 2024 imbalances are settled per 15 minutes at a " +
    "single price CEN for long and short positions; the tab assumes CEN moves against the farm in proportion to its " +
    "deviation, so the cost of error grows with its square. Under the Polish Offshore Wind Act the CfD is settled " +
    "against the day-ahead price of each period and netted yearly; the Phase II auction of 17 December 2025 awarded " +
    "3.4 GW at 476.88–492.32 PLN/MWh for 25 years. EU state-aid rules (CEEAG 2022 §122) bar support for production " +
    "when prices are negative. With the CfD, the farm's price is the strike minus its imbalance cost; without it, " +
    "the capture rate shows how much below the day average wind sells.",

  standards: [
    { label: "Regulation (EU) 2015/1222 (CACM) — single day-ahead coupling", type: "standard" },
    { label: "Regulation (EU) 2017/2195 (EB GL) — 15-minute imbalance settlement period", type: "standard" },
    { label: "PSE Warunki Dotyczące Bilansowania — balancing rules in force since 14 Jun 2024", type: "standard" },
    { label: "Polish Offshore Wind Act (2020) — two-sided CfD", type: "standard" },
    { label: "EU CEEAG 2022 §122 — no aid when prices are negative", type: "standard" },
  ],

  formulas: [
    {
      expression: "Cash = Σ E·P_DA − λ·Σ dev² + Σ E·(K − P_DA)",
      variables: [
        { symbol: "E", name: "Metered energy per period", unit: "MWh" },
        { symbol: "dev", name: "Metered − scheduled", unit: "MWh" },
        { symbol: "λ", name: "CEN shift per MWh deviation (assumed 0.25)", unit: "PLN/MWh²" },
        { symbol: "K", name: "CfD strike", unit: "PLN/MWh" },
      ],
      explanation: "Day-ahead value, imbalance at CEN = P_DA − λ·dev, CfD settlement. The CfD terms cancel P_DA: E·K remains.",
    },
    {
      expression: "Capture rate = (Σ E·P_DA / Σ E) / mean(P_DA)",
      variables: [{ symbol: "P_DA", name: "Day-ahead price", unit: "PLN/MWh" }],
      explanation: "Below 100 %: the farm produces most when prices are low, often because other wind farms do too.",
    },
  ],

  workedExamples: [
    {
      title: "What the CfD guarantees",
      scenario: "Winter weekday, strike 489 PLN/MWh, the day-ahead price at 700 PLN/MWh at 08:00.",
      steps: [
        "Day-ahead: the farm earns 700 PLN for each MWh delivered",
        "CfD: it pays back 700 − 489 = 211 PLN/MWh",
        "Net 489 PLN/MWh — at 50 PLN/MWh it would also get 489",
      ],
      result:
        "With a perfect forecast the farm earns exactly the strike. What it still controls is imbalance: a better P4 forecast is money.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    { label: "SDAC — 15-minute MTU go-live", type: "website", citation: "EPEX SPOT news, 2025" },
    { label: "Poland's first offshore wind CfD auction results", type: "website", citation: "Energy Regulatory Office (URE), 17 Dec 2025" },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/market.py", description: "Schedule, CEN imbalance, CfD settlement, BESS linear programme." },
  ],
};
