import type { EducationContent } from "../../../types/education";

export const sensitivityEducation: EducationContent = {
  id: "p1.sensitivity",
  title: "AEP Sensitivity Analysis",
  subtitle: "Which input matters most for net energy?",
  discipline: "Civil",

  overview:
    "A sensitivity analysis tells you which inputs deserve engineering effort. The tornado chart ranks inputs by how much " +
    "the output AEP moves when each is varied across its uncertainty range. For an offshore project the answer is almost " +
    "always: wind speed first, wake loss second, availability third. Capex and WACC dominate LCOE rather than AEP, so " +
    "they show up in the LCOE tornado but not the AEP one.",

  simpleExplanation:
    "Imagine you can only afford to make ONE thing better next quarter — better wind data, a smarter wake model, faster " +
    "repairs, or cheaper financing. The sensitivity chart points at the option that moves the bottom-line number the most. " +
    "Don't waste effort polishing an input that barely changes the answer.",

  technicalExplanation:
    "Two flavours: one-at-a-time (OAT) tornado charts vary each input ±1σ holding others fixed; global methods (Sobol " +
    "indices, Morris elementary effects) integrate over the joint distribution and capture interactions. OAT is cheap and " +
    "communicative; Sobol is correct when inputs interact (e.g. wake × layout). For AEP cascades the OAT result is nearly " +
    "identical to Sobol because the cascade is multiplicative — interactions are weak.",

  standards: [
    {
      label: "IEC 61400-15-2 — Energy yield assessment uncertainty",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "JCGM 100 — Guide to the Expression of Uncertainty (GUM)",
      type: "standard",
      url: "https://www.bipm.org/en/committees/jc/jcgm",
    },
    {
      label: "Saltelli et al. — Global Sensitivity Analysis: The Primer",
      type: "textbook",
      citation: "Wiley 2008, ISBN 978-0-470-05997-5",
    },
  ],

  formulas: [
    {
      expression: "S_i^OAT = (AEP(x_i + Δ) − AEP(x_i − Δ)) / (2·Δ) · (Δ/AEP_base)",
      variables: [
        { symbol: "S_i^OAT", name: "Normalised one-at-a-time sensitivity to input i", unit: "—" },
        { symbol: "x_i", name: "Input i (e.g. wind speed)", unit: "varies" },
        { symbol: "Δ", name: "Perturbation magnitude (typically ±1σ)", unit: "varies" },
      ],
      explanation:
        "Tornado chart bars are |S_i^OAT| × σ_i, sorted descending. The longest bar is the highest-leverage input.",
    },
    {
      expression: "S_i^Sobol = Var_xi[E_x~i[Y|x_i]] / Var[Y]",
      variables: [
        { symbol: "S_i^Sobol", name: "First-order Sobol index for input i", unit: "—" },
        { symbol: "Y", name: "Output (AEP or LCOE)", unit: "varies" },
      ],
      explanation:
        "Fraction of output variance explained by input i alone. Total Sobol index ST_i additionally includes interaction terms. " +
        "Computed via quasi-Monte Carlo with N(2k+2) samples (Saltelli scheme).",
      reference: "Saltelli 2010",
    },
  ],

  workedExamples: [
    {
      title: "Tornado chart for Baltic Wind 510 MW AEP",
      scenario:
        "P50 AEP = 2,140 GWh. Inputs perturbed by ±1σ: wind ±4.5%, wake ±1.8%, availability ±1.5%, electrical ±0.7%.",
      steps: [
        "ΔAEP_wind = 2,140 × 0.045 = ±96.3 GWh",
        "ΔAEP_wake = 2,140 × 0.018 = ±38.5 GWh",
        "ΔAEP_avail = 2,140 × 0.015 = ±32.1 GWh",
        "ΔAEP_elec = 2,140 × 0.007 = ±15.0 GWh",
      ],
      result:
        "Wind dominates by ~2.5×. The next best investment is wake calibration (PyWake against operational SCADA), then " +
        "O&M strategy. Improving cable losses by 0.7% costs more than it returns — leave it.",
    },
  ],

  realWorldCases: [
    {
      title: "Sheringham Shoal — wind data investment paid back",
      description:
        "Operator extended its met-mast campaign by 18 months at a cost of ~£1.5 M. The longer record reduced σ_wind from " +
        "5.5% to 3.8%, raising P90 by ~2.4%. The lifetime debt sized against the new P90 was ~£60 M larger.",
      takeaway:
        "Wind data is almost always the cheapest uncertainty to reduce per €/MWh of bankable AEP. Sensitivity charts point " +
        "exactly there.",
    },
  ],

  furtherReading: [
    {
      label: "SALib — Python sensitivity analysis library",
      type: "website",
      url: "https://salib.readthedocs.io",
    },
    {
      label: "Pelletier et al. — Wake model bias in operational data",
      type: "paper",
      citation: "Wind Energy Science 6 (2021), doi:10.5194/wes-6-1083-2021",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/sensitivity.py",
      description: "OAT and Sobol drivers; tornado chart endpoint feeds the SensitivityPanel.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
