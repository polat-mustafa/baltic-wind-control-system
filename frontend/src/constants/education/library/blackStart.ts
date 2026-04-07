import type { EducationContent } from "../../../types/education";

export const blackStartEducation: EducationContent = {
  id: "library.black-start",
  title: "Black Start & Island Operation",
  subtitle: "Restoring the grid when there is no grid to lean on",
  discipline: "Electrical",

  overview:
    "Wind farms have historically been grid-followers — they can only operate when there is already a stiff voltage on " +
    "the connection point. This is changing fast: grid-forming inverters and storage allow modern offshore wind to " +
    "energise its own export cable, support an islanded section of the network, and contribute to a top-down restoration " +
    "after a blackout. Several jurisdictions now expect 'black start capability' from new offshore farms — a fundamental " +
    "shift in how the asset is engineered and contracted.",

  simpleExplanation:
    "Imagine the entire grid goes dark and there's no power anywhere. To restart it you need at least one machine that " +
    "can create a voltage from nothing — usually a hydro plant or a gas turbine with batteries. Modern wind farms with " +
    "the right inverters and a small battery can also do this. They become the 'first match' that lights everything else.",

  technicalExplanation:
    "Two technical capabilities are required. First, grid-forming inverter control (typically virtual synchronous machine " +
    "or droop-based) that produces a stable voltage and frequency reference instead of synchronising to an external one. " +
    "Second, an energy buffer (BESS, supercap, or sufficient inertia from synchronous condensers) to absorb the inrush " +
    "transient when blocks of load are picked up. The black-start sequence is: (1) energise own auxiliaries from BESS, " +
    "(2) energise array cables sequentially with controlled inrush, (3) turbines auto-synchronise as soft-start grid-" +
    "followers behind the grid-forming inverter, (4) export cable energised at no-load, (5) shore substation re-" +
    "energised, (6) blocks of load picked up under operator control.",

  standards: [
    {
      label: "ENTSO-E NC ER — Network Code on Emergency and Restoration (EU Reg. 2017/2196)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R2196",
    },
    {
      label: "GB Electricity System Restoration Standard (National Grid ESO)",
      type: "regulation",
      url: "https://www.nationalgrideso.com/industry-information/codes/grid-code/meet-the-grid-code/ecc-legal-text",
    },
    {
      label: "VDE-AR-N 4131 — Technical conditions for offshore HVDC connection",
      type: "standard",
    },
    {
      label: "IEEE 2800 — Interconnection of inverter-based resources",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Grid-forming_inverter",
    },
  ],

  formulas: [
    {
      expression: "f_droop = f_set − k_p · (P − P_set)",
      variables: [
        { symbol: "f_droop", name: "Inverter output frequency", unit: "Hz" },
        { symbol: "k_p", name: "P-f droop slope (5%)", unit: "Hz/MW" },
        { symbol: "P", name: "Inverter active power", unit: "MW" },
      ],
      explanation:
        "Droop control gives an inverter 'synchronous-like' behaviour: more load → frequency drops. Multiple grid-forming " +
        "inverters can share load on the same droop characteristic just like a parallel connection of generators.",
    },
    {
      expression: "S_inrush ≈ U² / X_T (transformer cold-load pickup)",
      variables: [
        { symbol: "S_inrush", name: "Initial inrush apparent power", unit: "VA" },
        { symbol: "X_T", name: "Transformer leakage reactance", unit: "Ω" },
      ],
      explanation:
        "When energising a transformer cold, the inrush current can be 6–10× rated for the first half-cycle. The black-" +
        "start source must absorb this transient without tripping. Soft-start techniques (POW switching, pre-insertion " +
        "resistors) reduce the inrush to manageable levels.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind black-start sequence (illustrative)",
      scenario:
        "Hypothetical 50 MW BESS at the OSS, grid-forming inverter, V236 turbines as grid-followers.",
      steps: [
        "T+0 min: BESS auxiliary supply energises; OSS battery room and SCADA come online",
        "T+5 min: BESS PCS in grid-forming mode energises one 66 kV string at no-load",
        "T+10 min: First 4 V236 turbines synchronise behind BESS, ride wind, contribute up to 60 MW",
        "T+25 min: All 9 strings energised, all 34 turbines online, total 510 MW available",
        "T+30 min: 220 kV export cable energised at no-load (BESS absorbs charging Q)",
        "T+45 min: Shore substation re-energised; first 200 MW load pickup under TSO direction",
      ],
      result:
        "Full restoration to a regional 200 MW load in ~45 min from a totally dark start. The OZMB CfD does not currently " +
        "require black start, but PSE has signalled it will become a paid ancillary service from 2027 onward.",
    },
  ],

  realWorldCases: [
    {
      title: "Dogger Bank A — first GB offshore wind black-start contract",
      description:
        "SSE/Equinor signed a black-start contract with National Grid ESO covering 1.2 GW of offshore wind plus a " +
        "co-located battery and synchronous condenser. Operational from 2024.",
      takeaway:
        "Black start is now a real revenue stream (~£10–20 M per year per GW). Worth designing in from the start, " +
        "expensive to retrofit later.",
    },
    {
      title: "Hornsea 2 — grid-forming retrofit",
      description:
        "Ørsted retrofitted grid-forming control to the existing converter cabinets in 2023, demonstrating that fleet-" +
        "wide upgrades are possible without major hardware changes.",
      takeaway:
        "Grid-forming is increasingly a software upgrade rather than a hardware swap.",
    },
  ],

  furtherReading: [
    {
      label: "ESIG — Grid-forming inverters: technology and applications",
      type: "website",
      url: "https://www.esig.energy/resources/grid-forming-inverters-a-primer/",
    },
    {
      label: "Mitsubishi UK — Black start from offshore wind feasibility",
      type: "paper",
      citation: "CIGRE B4 colloquium 2022",
    },
  ],

  relatedLessons: ["lesson-011"],
};
