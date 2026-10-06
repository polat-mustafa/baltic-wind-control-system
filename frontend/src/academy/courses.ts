/**
 * Academy course map: four tracks along the project lifecycle
 * (Develop → Design → Build → Operate). Each track has lessons — an
 * EducationContent primer to read or a module to explore — and scored
 * missions.
 *
 * Missions are of three kinds:
 *   - work: grades what the learner built elsewhere in the app (site, layout);
 *   - challenge: generated cases solved inside the Academy (seeded);
 *   - drill: a control-room scenario (training/scenarios.ts) run on the
 *     live farm map, scored by store/trainingStore.
 */

import { arrayVoltageEducation } from "../constants/education/library/arrayVoltage";
import { cableCrossSectionEducation } from "../constants/education/library/cableCrossSection";
import { hvacVsHvdcEducation } from "../constants/education/library/hvacVsHvdc";
import { turbineSelectionEducation } from "../constants/education/library/turbineSelection";
import {
  availabilityWaterfallEducation,
  lcoeEducation,
  wakeLossEducation,
  weatherWindowEducation,
  weibullEducation,
  windRoseEducation,
} from "../constants/education/p1";
import {
  faultRideThroughEducation,
  powerPlantControllerEducation,
  protectionEducation,
  reactiveCompensationEducation,
} from "../constants/education/p2";
import type { EducationContent } from "../types/education";

export type TrackId = "develop" | "design" | "build" | "operate";

export type Lesson =
  | { kind: "read"; content: EducationContent }
  | { kind: "explore"; id: string; title: string; route: string; note: string };

export const lessonId = (l: Lesson) => (l.kind === "read" ? l.content.id : l.id);
export const lessonTitle = (l: Lesson) => (l.kind === "read" ? l.content.title : l.title);

export type MissionKind = "work" | "challenge" | "drill";

export interface Mission {
  id: string;
  track: TrackId;
  kind: MissionKind;
  title: string;
  summary: string;
  /** How it is scored, shown on the card. */
  scoring: string;
  refs: string[];
  /** Typical time [min]. */
  minutes: number;
  /** drill: scenario id in training/scenarios.ts */
  scenario?: string;
}

export interface Track {
  id: TrackId;
  title: string;
  goal: string;
  lessons: Lesson[];
}

export const TRACKS: Track[] = [
  {
    id: "develop",
    title: "Develop",
    goal: "Find a site that can be consented and connected.",
    lessons: [
      { kind: "read", content: weibullEducation },
      { kind: "read", content: windRoseEducation },
      {
        kind: "explore",
        id: "explore.site-permits",
        title: "Site & Permits journey",
        route: "/develop",
        note: "Screen the Southern Baltic on open marine data and take a site through the permit procedure.",
      },
    ],
  },
  {
    id: "design",
    title: "Design",
    goal: "Lay out turbines and cables for the lowest cost of energy.",
    lessons: [
      { kind: "read", content: turbineSelectionEducation },
      { kind: "read", content: wakeLossEducation },
      { kind: "read", content: lcoeEducation },
      { kind: "read", content: arrayVoltageEducation },
      { kind: "read", content: cableCrossSectionEducation },
      { kind: "read", content: hvacVsHvdcEducation },
      {
        kind: "explore",
        id: "explore.layout",
        title: "Layout canvas",
        route: "/develop/layout",
        note: "Place turbines, watch the wakes, route the array cables and price the farm.",
      },
    ],
  },
  {
    id: "build",
    title: "Build",
    goal: "Install in the weather windows and energise safely.",
    lessons: [
      { kind: "read", content: weatherWindowEducation },
      {
        kind: "explore",
        id: "explore.construction",
        title: "Construction campaign",
        route: "/build",
        note: "Install your farm in Baltic weather windows; compare a spring and an autumn start on P50 and P90.",
      },
      { kind: "read", content: protectionEducation },
      {
        kind: "explore",
        id: "explore.commissioning",
        title: "HV commissioning",
        route: "/commissioning",
        note: "Energise export circuit 1 step by step: isolation locks, interlocks, hold points and load-flow readings.",
      },
      {
        kind: "explore",
        id: "explore.handover",
        title: "Hand-over to operation",
        route: "/build/handover",
        note: "Print the as-built register and put your farm on the control-room map.",
      },
    ],
  },
  {
    id: "operate",
    title: "Operate",
    goal: "Keep the plant compliant, available and healthy.",
    lessons: [
      { kind: "read", content: faultRideThroughEducation },
      { kind: "read", content: reactiveCompensationEducation },
      { kind: "read", content: powerPlantControllerEducation },
      { kind: "read", content: availabilityWaterfallEducation },
      {
        kind: "explore",
        id: "explore.digital-twin",
        title: "Digital Twin",
        route: "/digital-twin",
        note: "Detect, diagnose and predict turbine faults against a physics model.",
      },
      {
        kind: "explore",
        id: "explore.decommissioning",
        title: "Decommissioning",
        route: "/decommission",
        note: "Choose what comes out of the sea at end of life, simulate the removal and restore the seabed.",
      },
    ],
  },
];

export const MISSIONS: Mission[] = [
  {
    id: "site-selection",
    track: "develop",
    kind: "work",
    title: "Site selection",
    summary: "Draw a site in Site & Permits that can be consented and hosts a 500 MW farm close to the grid.",
    scoring: "Permit decision 40 · capacity 20 · water depth 15 · grid distance 15 · usable area 10 (illustrative weights).",
    refs: ["RED III, Directive (EU) 2023/2413", "EIA Directive 2011/92/EU", "Habitats Directive 92/43/EEC Art. 6(3)"],
    minutes: 20,
  },
  {
    id: "layout-challenge",
    track: "design",
    kind: "work",
    title: "Layout challenge",
    summary: "Lay out 450–550 MW inside your site for the lowest LCOE: tighter spacing saves cable and sea area but costs wake loss.",
    scoring: "Capacity band 25 · LCOE 50 · wake loss 15 · array cable per MW 10; −10 per turbine outside the site or in a constraint area. Graded with the default cost inputs.",
    refs: ["Bastankhah & Porté-Agel (2014) wake model", "Esau–Williams capacitated tree", "LCOE = (CAPEX·CRF + OPEX) / AEP"],
    minutes: 30,
  },
  {
    id: "energisation-sequence",
    track: "build",
    kind: "challenge",
    title: "First energisation",
    summary: "Put the key steps of the export system and array energisation in a safe order.",
    scoring: "100 − 15 per wrong step − 1 per 10 s over a 2 min par.",
    refs: ["P5 switching programme S-001 … S-030", "EN 50110-1 (operation of electrical installations)"],
    minutes: 5,
  },
  {
    id: "frt-compliance",
    track: "operate",
    kind: "challenge",
    title: "Fault ride-through compliance",
    summary: "Five voltage dips at the connection point: must the farm ride through, and what reactive current does it inject?",
    scoring: "Per dip: 12 points for the verdict, 8 for the reactive current set-point.",
    refs: ["NC RfG, Regulation (EU) 2016/631, Art. 16 / 20", "PSE requirements of general application (2018), Art. 16(3)(a), 20(2)(b)"],
    minutes: 10,
  },
  {
    id: "twin-diagnosis",
    track: "operate",
    kind: "challenge",
    title: "Digital Twin diagnosis",
    summary: "A week of SCADA residuals from a fleet with an unknown injected fault (or none). Find the turbines and name the fault.",
    scoring: "Per injected fault: half for the turbine, half for the fault type; −15 per healthy turbine flagged.",
    refs: ["ISO 13374 condition monitoring", "IEC 61400-25 (SCADA data model)"],
    minutes: 15,
  },
  {
    id: "drill-cable-fault",
    track: "operate",
    kind: "drill",
    scenario: "cable-fault",
    title: "Array cable fault drill",
    summary: "A 66 kV feeder trips: find the faulted section with the fault passage indicators and restore the healthy turbines.",
    scoring: "100 − 15 per mistake − 1 per 10 s over par.",
    refs: ["IEC 60255-151"],
    minutes: 5,
  },
  {
    id: "drill-turbine-fault",
    track: "operate",
    kind: "drill",
    scenario: "turbine-fault",
    title: "Pitch fault drill",
    summary: "Reset or dispatch? Pick the vessel the sea state allows.",
    scoring: "100 − 15 per mistake − 1 per 10 s over par.",
    refs: ["IEC 61400-26-1"],
    minutes: 5,
  },
  {
    id: "drill-underfrequency",
    track: "operate",
    kind: "drill",
    scenario: "underfrequency",
    title: "Under-frequency drill",
    summary: "Lose 3 GW in Continental Europe and see what a delta reserve buys.",
    scoring: "100 − 15 per mistake − 1 per 10 s over par.",
    refs: ["ENTSO-E SOGL Art. 153", "NC RfG Art. 15(2)(c)"],
    minutes: 5,
  },
  {
    id: "drill-voltage-dip",
    track: "operate",
    kind: "drill",
    scenario: "voltage-dip",
    title: "Voltage dip drill",
    summary: "Ride through a 400 kV fault near Słupsk on the live farm.",
    scoring: "100 − 15 per mistake − 1 per 10 s over par.",
    refs: ["NC RfG Art. 16 / 20"],
    minutes: 3,
  },
];

export const missionById = (id: string) => MISSIONS.find((m) => m.id === id);
