/**
 * Site & Permits journey: stages, the permit procedure script and the
 * permit decision derived from the site report.
 *
 * Legal periods are quoted from the primary texts (checked on EUR-Lex,
 * 2026-10-05):
 *   - RED III, Directive (EU) 2023/2413, amending Directive (EU) 2018/2001:
 *     Art. 16(2) completeness within 45 days (30 in acceleration areas), the
 *     procedure starts on acknowledgement; Art. 16a/16b offshore procedure
 *     ≤ 2 years in renewables acceleration areas, ≤ 3 years outside, +6 months
 *     in extraordinary circumstances; Art. 16b(2) one combined assessment,
 *     scoping opinion not extended later.
 *   - EIA Directive 2011/92/EU as amended by 2014/52/EU: Art. 4(6) screening
 *     within 90 days; Art. 5 EIA report; Art. 6(7) public consultation ≥ 30 days.
 *   - Habitats Directive 92/43/EEC, Art. 6(3)–(4): appropriate assessment;
 *     consent only if site integrity is not adversely affected (else IROPI
 *     plus compensatory measures).
 * Survey durations are typical practice, labelled "typical"; national
 * procedures differ, so this is a generic EU process, not any one country's.
 */

import type { AssessResponse, SiteCheck } from "../../services/siteApi";

export type StageId = "screening" | "investigation" | "environment" | "permit" | "documents";

export interface Stage {
  id: StageId;
  title: string;
  short: string;
  duration: string;
}

export const STAGES: Stage[] = [
  { id: "screening", title: "Site screening", short: "Screen", duration: "typical: 3–6 months" },
  { id: "investigation", title: "Site investigation", short: "Survey", duration: "typical: 12–24 months" },
  { id: "environment", title: "Environmental studies", short: "Environment", duration: "typical: ≥ 12 months" },
  { id: "permit", title: "Consultation & permit", short: "Permit", duration: "legal limit: ≤ 3 years" },
  { id: "documents", title: "Documents", short: "Documents", duration: "" },
];

export type ActorId = "engineer" | "technician" | "official" | "consultant" | "fisher";

/** Cast: three women (Ada, Ms Nowicka, Dr Karin Lind) and two men (Tomek, Marek). */
export const ACTORS: Record<ActorId, { name: string; role: string }> = {
  engineer: { name: "Ada", role: "Project engineer (developer)" },
  technician: { name: "Tomek", role: "Survey technician" },
  official: { name: "Ms Nowicka", role: "Permitting authority (single contact point)" },
  consultant: { name: "Dr Karin Lind", role: "Environmental consultant" },
  fisher: { name: "Marek", role: "Fisheries representative" },
};

// ── Permit decision ──────────────────────────────────────────────

export type Outcome = "approved" | "approved_with_conditions" | "refused" | "more_information";

export interface Decision {
  outcome: Outcome;
  reasons: string[];
  conditions: string[];
  appropriateAssessment: boolean;
}

/** Conditions any offshore wind consent of this kind typically carries (simulation). */
export const STANDARD_CONDITIONS = [
  "Survey for unexploded ordnance (UXO) and clear it before any seabed works.",
  "Mitigate underwater noise during pile driving (soft start, bubble curtains) and monitor it.",
  "Mark the structures for navigation following IALA guidance for offshore man-made structures.",
  "Run the environmental monitoring programme set out in the EIA, before, during and after construction.",
  "Submit a decommissioning plan and financial security before construction starts.",
];

const BLOCKING = new Set(["sea", "territorial_sea", "eez", "msp_energy", "owf", "cables", "natura2000", "shipping", "restricted", "depth"]);

/**
 * What a permitting authority would decide on this site (simulation).
 *
 * A failed check refuses the application; an unknown essential check asks
 * for more information; a nearby Natura 2000 site triggers an appropriate
 * assessment, assumed here to conclude "no adverse effect on integrity".
 */
/** Engineering and grid findings (design, cost, PSE connection), not consent matters: never a permit condition. */
const ENGINEERING = new Set(["seabed", "grid"]);

export function decide(report: AssessResponse | null): Decision {
  if (!report) {
    return { outcome: "more_information", reasons: ["No site has been assessed yet."], conditions: [], appropriateAssessment: false };
  }
  const blocking = (c: SiteCheck) => BLOCKING.has(c.id);
  const failed = report.checks.filter((c) => blocking(c) && c.status === "fail");
  if (failed.length > 0) {
    return {
      outcome: "refused",
      reasons: failed.map((c) => `${c.title}: ${c.detail}`),
      conditions: [],
      appropriateAssessment: false,
    };
  }
  const unknown = report.checks.filter((c) => blocking(c) && c.status === "unknown");
  if (unknown.length > 0) {
    return {
      outcome: "more_information",
      reasons: unknown.map((c) => `${c.title}: ${c.detail}`),
      conditions: [],
      appropriateAssessment: false,
    };
  }
  const natura = report.checks.find((c) => c.id === "natura2000");
  const aa = natura?.status === "warn";
  const extra: string[] = [];
  if (aa) {
    extra.push(
      "Appropriate assessment (Habitats Directive Art. 6(3)) concluded no adverse effect on the integrity of the nearby Natura 2000 site, subject to the mitigation it sets out.",
    );
  }
  for (const c of report.checks) {
    if (c.status === "warn" && c.id !== "natura2000" && !ENGINEERING.has(c.id)) extra.push(`${c.title}: ${c.detail}`);
  }
  return {
    outcome: extra.length > 0 ? "approved_with_conditions" : "approved",
    reasons: [],
    conditions: [...extra, ...STANDARD_CONDITIONS],
    appropriateAssessment: aa,
  };
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  approved: "Consent granted",
  approved_with_conditions: "Consent granted with conditions",
  refused: "Consent refused",
  more_information: "More information required",
};

// ── Permit procedure script ──────────────────────────────────────

export interface PermitStep {
  id: string;
  title: string;
  month: number; // months after the application was submitted
  actor: ActorId;
  say: string;
  note: string;
  reference: string;
  /** Only shown when an appropriate assessment is needed. */
  onlyIfAA?: boolean;
}

/** The procedure in compressed time; months are illustrative within the legal limits. */
export function permitSteps(decision: Decision): PermitStep[] {
  const steps: PermitStep[] = [
    {
      id: "submit",
      title: "Application submitted",
      month: 0,
      actor: "engineer",
      say: "Here is our application: site outline, project description and the screening report.",
      note: "One application to the single contact point covers all permits, including the grid connection.",
      reference: "RED III Art. 16(1), 16(3)",
    },
    {
      id: "complete",
      title: "Completeness acknowledged",
      month: 1.5,
      actor: "official",
      say: "Your application is complete. From today the permit-granting clock is running.",
      note: "The authority must confirm completeness within 45 days (30 days in a renewables acceleration area).",
      reference: "RED III Art. 16(2)",
    },
    {
      id: "scoping",
      title: "Scoping opinion",
      month: 3,
      actor: "consultant",
      say: "The authority's scoping opinion fixes what the EIA report must cover. It will not be widened later.",
      note: "All environmental assessments run as one combined procedure.",
      reference: "EIA Directive Art. 5(2); RED III Art. 16b(2)",
    },
    {
      id: "eia",
      title: "EIA report submitted",
      month: 12,
      actor: "consultant",
      say: "The EIA report covers birds, marine mammals, fish, seabed habitats, noise, shipping and landscape.",
      note: "Built on at least a full year of baseline surveys, so every season is covered.",
      reference: "EIA Directive Art. 5(1), Annex IV",
    },
    {
      id: "consultation",
      title: "Public consultation",
      month: 13,
      actor: "fisher",
      say: "Our trawlers fish this bank. We want a say on safety zones and compensation.",
      note: "The public concerned gets at least 30 days to comment on the EIA report.",
      reference: "EIA Directive Art. 6(7)",
    },
    {
      id: "aa",
      title: "Appropriate assessment",
      month: 16,
      actor: "consultant",
      say: "With noise mitigation during piling, the project does not harm the integrity of the nearby Natura 2000 site.",
      note: "Consent is only possible once the authority is certain the site's integrity is not adversely affected.",
      reference: "Habitats Directive Art. 6(3)",
      onlyIfAA: true,
    },
    {
      id: "decision",
      title: "Decision",
      month: decision.appropriateAssessment ? 20 : 18,
      actor: "official",
      say:
        decision.outcome === "refused"
          ? "We cannot grant consent for this site. The reasons are set out in the decision."
          : decision.outcome === "more_information"
            ? "We need more information before we can decide."
            : "Consent is granted, subject to the conditions in the decision.",
      note: "Offshore projects: at most 3 years from completeness (2 years in acceleration areas), +6 months in extraordinary circumstances.",
      reference: "RED III Art. 16a(1), 16b(1)",
    },
  ];
  return steps.filter((s) => !s.onlyIfAA || decision.appropriateAssessment);
}

// ── Investigation and environment content ────────────────────────

export interface Task {
  id: string;
  title: string;
  actor: ActorId;
  months: number; // typical duration, for the progress animation
  what: string;
  why: string;
  watchOut?: string;
  reference?: string;
}

export const INVESTIGATION: Task[] = [
  {
    id: "lidar",
    title: "Wind measurement campaign",
    actor: "technician",
    months: 12,
    what: "A floating LiDAR buoy measures wind speed and direction up to hub height for at least a year.",
    why: "The energy yield and its uncertainty rest on these data, correlated with long-term reanalysis.",
    watchOut: "Less than a full year misses the seasonal cycle and inflates the uncertainty of the yield.",
  },
  {
    id: "geophysics",
    title: "Geophysical survey",
    actor: "technician",
    months: 4,
    what: "Multibeam echosounder (bathymetry), side-scan sonar (objects), sub-bottom profiler (shallow geology) and magnetometer (ferrous objects) over the site and the cable route.",
    why: "Maps the seabed and finds boulders, wrecks and possible munitions before anyone drills.",
    watchOut: "The Baltic seabed holds wartime munitions: magnetometer anomalies must be investigated before geotechnical work.",
  },
  {
    id: "geotech",
    title: "Geotechnical campaign",
    actor: "engineer",
    months: 6,
    what: "Cone penetration tests (CPT) and boreholes at the planned foundation positions.",
    why: "Soil strength and layering size the monopile or jacket foundation.",
    reference: "DNV-RP-C212 (offshore soil mechanics and geotechnical engineering)",
  },
  {
    id: "metocean",
    title: "Metocean measurements",
    actor: "technician",
    months: 12,
    what: "Wave buoys and current profilers (ADCP) record waves, currents and water levels.",
    why: "Design loads on turbines and foundations, and the weather windows for installation.",
    reference: "IEC 61400-3-1 (design requirements for fixed offshore wind turbines)",
  },
];

export interface Season {
  id: "winter" | "spring" | "summer" | "autumn";
  title: string;
  focus: string;
}

export const SEASONS: Season[] = [
  { id: "winter", title: "Winter", focus: "Wintering sea ducks and divers on the offshore banks; ice conditions." },
  { id: "spring", title: "Spring", focus: "Bird migration across the Baltic; fish spawning." },
  { id: "summer", title: "Summer", focus: "Harbour porpoise and seals; seabed (benthic) sampling." },
  { id: "autumn", title: "Autumn", focus: "Autumn bird migration, including nocturnal passerines (radar)." },
];

export const ENVIRONMENT: Task[] = [
  {
    id: "birds",
    title: "Seabirds and migration",
    actor: "consultant",
    months: 12,
    what: "Aerial digital surveys and ship-based counts across all seasons; radar for night-time migration.",
    why: "Collision risk and displacement of seabirds are central EIA questions in the Baltic.",
    watchOut: "Southern Baltic offshore banks hold internationally important numbers of wintering sea ducks: survey the winter well.",
  },
  {
    id: "mammals",
    title: "Marine mammals",
    actor: "consultant",
    months: 12,
    what: "Passive acoustic monitoring (click detectors) for harbour porpoise; seal tracking where relevant.",
    why: "The Baltic Proper harbour porpoise population is critically endangered; pile-driving noise can injure or displace it.",
    watchOut: "Plan noise mitigation from the start: some countries set hard limits, e.g. Germany 160 dB SEL at 750 m.",
  },
  {
    id: "benthos",
    title: "Seabed habitats",
    actor: "consultant",
    months: 6,
    what: "Grab samples, video transects and habitat mapping over the site and the cable route.",
    why: "Sandbanks (habitat 1110) and reefs (1170) are protected habitat types under the Habitats Directive; the screening's Natura 2000 check shows whether a designated site lies near yours.",
  },
  {
    id: "fish",
    title: "Fish and fisheries",
    actor: "fisher",
    months: 12,
    what: "Survey trawls and fishing-effort data; talk to the fishers who use the area.",
    why: "Safety zones close fishing grounds; early agreement avoids objections in the consultation.",
  },
];
