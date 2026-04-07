import type { EducationContent } from "../../../types/education";

export const offshoreSubstationEducation: EducationContent = {
  id: "library.offshore-substation",
  title: "Offshore Substation Mechanical Design",
  subtitle: "A floating power station the size of a tennis court",
  discipline: "Civil",

  overview:
    "The offshore substation (OSS) collects 66 kV array cables from up to ~70 turbines, steps the voltage up to 220 kV " +
    "(or HVDC for long-distance projects) and exports power to shore. It is a 2,000–4,000 t platform supporting 35–60 MVA " +
    "of GIS, oil-filled transformers, dry-type reactors, MV/LV switchgear, helideck, accommodation and emergency systems. " +
    "The mechanical design must withstand decades of corrosive marine atmosphere, breaking waves, and the structural " +
    "vibration of three or four 250 MVA transformers running 24/7.",

  simpleExplanation:
    "Imagine putting an entire electrical substation that you'd normally build on land — transformers, switchgear, " +
    "control room — onto a steel platform standing in 35 m of water 30 km from shore. It needs to keep the electricity " +
    "flowing for 25 years with almost no visits. Everything inside has to survive salt spray, vibration, the sound of " +
    "transformers humming day and night, and the occasional storm wave hitting the underside of the deck.",

  technicalExplanation:
    "Topside layout follows the IEC 61936-1 segregation principles: HV switchgear separated from LV by a fire-rated wall, " +
    "transformer bays bunded for oil containment. Foundation is typically a 4-leg jacket; for shallow Baltic sites a " +
    "monopod or gravity base may be feasible. Air-gap clearance under the topside must exceed the 50-year wave crest plus " +
    "a 1.5 m allowance. Internal climate control keeps the GIS room at 5–35 °C and < 60% RH to prevent SF6 leakage and " +
    "condensation. Helideck is certified to CAP 437 (UK) or equivalent, sized for the largest medevac helicopter.",

  standards: [
    {
      label: "DNV-OS-J201 — Offshore substations for wind farms",
      type: "standard",
    },
    {
      label: "IEC 61936-1 — Power installations exceeding 1 kV AC",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61936",
    },
    {
      label: "CAP 437 — Standards for offshore helicopter landing areas (UK CAA)",
      type: "regulation",
      url: "https://www.caa.co.uk/CAP437",
    },
    {
      label: "DNV-OS-C101 — Design of offshore steel structures",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "h_air = h_crest,50 + h_freeboard,    h_freeboard ≥ 1.5 m",
      variables: [
        { symbol: "h_air", name: "Air-gap clearance from MSL to topside underside", unit: "m" },
        { symbol: "h_crest,50", name: "50-year wave crest height above MSL", unit: "m" },
      ],
      explanation:
        "Slamming a wave into the topside underside generates impulsive loads that no design can economically resist. " +
        "Adequate air gap is the simplest defence and the regulator's first check.",
      reference: "DNV-OS-J201 §6",
    },
  ],

  workedExamples: [
    {
      title: "Air-gap check for Baltic Wind OSS",
      scenario:
        "Hs_50 = 7.5 m, Tp = 11 s, water depth 35 m, no significant tidal range.",
      steps: [
        "Stream-function wave height H_50 = 1.86 · Hs_50 ≈ 13.95 m",
        "Crest factor (Stokes 5th, h/L ≈ 0.18) ≈ 0.6 · H_50 ≈ 8.4 m above MSL",
        "Required air gap = 8.4 + 1.5 = 9.9 m",
        "Topside underside elevation set to +12.0 m above MSL (extra margin for sea-level rise + uncertainty)",
      ],
      result:
        "Topside underside elevation 12 m above MSL. The 4-leg jacket extends from -35 m (mudline) to +12 m, total length " +
        "~47 m, mass ≈ 1,200 t.",
    },
  ],

  realWorldCases: [
    {
      title: "DolWin alpha (Germany) — first HVDC OSS",
      description:
        "TenneT's BorWin alpha (2015) introduced HVDC at scale offshore. The platform measured ~100 × 70 m and weighed " +
        "21,000 t — close to the upper limit of installable single-lift topsides.",
      takeaway:
        "HVDC platforms are 5–10× heavier than HVAC. The decision to go HVDC drives platform mass, foundation size and " +
        "installation vessel choice all at once.",
    },
  ],

  furtherReading: [
    {
      label: "WindEurope — Offshore Wind in Europe (annual statistics report)",
      type: "website",
      url: "https://windeurope.org/intelligence-platform/product/offshore-wind-in-europe-key-trends-and-statistics-2023/",
    },
    {
      label: "Campos et al. (2016) — Review of offshore substation electrical design (IEEE Access)",
      type: "paper",
      url: "https://doi.org/10.1109/ACCESS.2016.2556011",
    },
  ],

  relatedLessons: ["lesson-009"],
};
