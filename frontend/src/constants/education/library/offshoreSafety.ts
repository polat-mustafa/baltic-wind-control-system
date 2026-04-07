import type { EducationContent } from "../../../types/education";

export const offshoreSafetyEducation: EducationContent = {
  id: "library.offshore-safety",
  title: "Offshore Safety (SOLAS / IMCA / GWO)",
  subtitle: "The procedural and physical safeguards that keep crews alive",
  discipline: "Safety",

  overview:
    "Offshore wind has the highest LTI rate of any modern energy industry — typically 3–6 LTIF (lost-time injuries per " +
    "million worked hours), an order of magnitude above onshore wind. The risks are physical (falls from height, " +
    "drowning, dropped objects), environmental (cold-water immersion, wave-induced motion sickness, lightning) and " +
    "logistical (long medevac times, single-point-of-failure boats). The regulatory frame is a layered combination of " +
    "international maritime law (SOLAS), industry guidelines (IMCA, G+) and standardised personnel training (GWO BST).",

  simpleExplanation:
    "Working on an offshore turbine is one of the most dangerous jobs in the energy world. People can fall from 280 m, " +
    "be caught between a moving boat and the boat landing, get hypothermia in cold water, or be trapped on a turbine " +
    "during a storm. The safety system layers many small protections so that no single failure becomes fatal: trained " +
    "people, certified equipment, written procedures, redundant communications, and a vessel always within reach.",

  technicalExplanation:
    "Mandatory safety architecture: (1) every offshore worker holds a current GWO BST (Basic Safety Training) certificate " +
    "covering working at height, manual handling, fire awareness, sea survival, and first aid, plus a GWO ART (Advanced " +
    "Rescue Training) for technicians; (2) every transfer is governed by an IMCA-compliant CTV operating procedure with " +
    "Hs limits per vessel class and a captain authority over the dispatch decision; (3) every 'live electrical task' " +
    "requires a Permit-to-Work (LOTO) signed by a competent person and the operator; (4) every site has a documented " +
    "Emergency Response Plan including helicopter medevac, tested at least annually; (5) lone working is prohibited at " +
    "height — the buddy rule applies inside every nacelle. Compliance is audited quarterly by the operator and yearly by " +
    "an external HSE assessor (DNV, Lloyd's).",

  standards: [
    {
      label: "SOLAS — International Convention for the Safety of Life at Sea",
      type: "regulation",
      url: "https://en.wikipedia.org/wiki/SOLAS_Convention",
    },
    {
      label: "IMCA M 159 — Guidance for the use of CTVs",
      type: "standard",
      url: "https://www.imca-int.com/product-category/documents/",
    },
    {
      label: "GWO Basic Safety Training Standard (BST)",
      type: "standard",
      url: "https://www.globalwindsafety.org/standards/bst-standard",
    },
    {
      label: "G+ Good Practice Guidelines — offshore wind safety publications",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
    {
      label: "ISO 45001 — Occupational health and safety management",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/ISO_45001",
    },
  ],

  formulas: [
    {
      expression: "LTIF = (LTIs × 1,000,000) / total worked hours",
      variables: [
        { symbol: "LTIs", name: "Lost-time injuries (≥1 day off work)", unit: "—" },
        { symbol: "LTIF", name: "Lost-time injury frequency", unit: "per Mh worked" },
      ],
      explanation:
        "Industry-standard safety KPI. Offshore wind 2023 G+ data: median LTIF 3.4. Best-in-class operators run < 2.0; " +
        "incidents above 6 trigger root-cause investigation and operator review.",
    },
  ],

  workedExamples: [
    {
      title: "Survival time in Baltic seawater (March)",
      scenario:
        "Technician falls overboard, sea temperature 4 °C, wearing standard work clothes (not survival suit).",
      steps: [
        "Cold-shock response: ~1 min of involuntary gasping; uncontrolled aspiration most common cause of drowning",
        "Functional time before swim failure: ~10 min before hand grip lost",
        "Hypothermia (core 35 °C): ~30 min depending on body composition",
        "Effective rescue window: ≤ 10 min from MOB alarm to recovery onboard CTV",
      ],
      result:
        "The Baltic in winter is brutally unforgiving. Why a survival immersion suit (SOLAS Reg III/22) and a fast-rescue " +
        "boat are mandatory equipment, not optional.",
    },
  ],

  realWorldCases: [
    {
      title: "Fatal CTV crush incident, North Sea 2017",
      description:
        "Technician crushed between boat landing and bow fender while transferring in 1.6 m Hs (just below CTV limit). " +
        "Investigation found inconsistent cushioning system and recommended fender redesign for the entire UK CTV fleet.",
      takeaway:
        "Hs at the operating limit is not a safe place to work. Modern operators set their own internal Hs ~0.3 m below " +
        "the catalogue limit to absorb measurement uncertainty.",
    },
    {
      title: "GWO BST adoption",
      description:
        "GWO certification became a contractual requirement on every European offshore project after 2014. Today > 100,000 " +
        "technicians hold valid BST certificates across the global wind industry.",
      takeaway:
        "Standardised training shifts the safety culture upward across the entire supply chain — a positive externality of " +
        "industry coordination.",
    },
  ],

  furtherReading: [
    {
      label: "G+ Annual Incident Data Report",
      type: "website",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
    {
      label: "Hallowell et al. (2018) — Offshore wind farm accidents: rates and causes (WIREs)",
      type: "paper",
      url: "https://doi.org/10.1002/wene.289",
    },
  ],

  relatedLessons: ["lesson-006"],
};
