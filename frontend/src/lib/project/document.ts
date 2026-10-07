/**
 * The project document (schema 2): everything the learner builds in one JSON
 * object — site + journey progress (siteStore), layout and costs
 * (projectStore), construction / decommissioning inputs (lifecycleStore).
 *
 * The same document is exported as `.offshoreforge.json`, imported, and saved
 * online (backend/app/schemas/project.py ProjectData — keep the two in step).
 * Schema 1 files (layout only: site corners, turbines, OSS, costs) are upgraded
 * on import.
 */

import { DEFAULT_TURBINE_ID, TURBINE_MODELS } from "../../constants/turbineModels";
import { useLifecycleStore } from "../../store/lifecycleStore";
import { MAX_TURBINES, useProjectStore, type Turbine } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import type { CostInputs } from "../layout/cost";
import type { LonLat } from "../layout/geometry";

export const DOC_SCHEMA = 2;
export const DEFAULT_NAME = "Untitled project";

export interface ProjectDoc {
  schema: 2;
  app: "OffshoreForge";
  name: string;
  turbineModel: string;
  site: { polygon: LonLat[] | null; stage: string; done: string[] };
  turbines: Turbine[];
  oss: LonLat | null;
  costs: CostInputs;
  lifecycle: Record<string, unknown> | null;
}

/** The current project, read from the three stores. */
export function buildDoc(name = DEFAULT_NAME): ProjectDoc {
  const s = useSiteStore.getState();
  const p = useProjectStore.getState();
  const l = useLifecycleStore.getState();
  return {
    schema: DOC_SCHEMA,
    app: "OffshoreForge",
    name,
    turbineModel: DEFAULT_TURBINE_ID,
    site: { polygon: s.site, stage: s.stage, done: s.done },
    turbines: p.turbines,
    oss: p.oss,
    costs: p.costs,
    lifecycle: { build: l.build, decom: l.decom, done: l.done },
  };
}

/** Load a (validated) document into the stores. */
export function applyDoc(doc: ProjectDoc): void {
  if (!useProjectStore.getState().restore(doc as unknown as Record<string, unknown>))
    throw new Error(`Invalid turbine list (at most ${MAX_TURBINES}).`);
  useLifecycleStore.getState().restore(doc.lifecycle ?? {});
  useSiteStore.getState().restore({
    site: doc.site.polygon,
    stage: doc.site.stage,
    done: doc.site.done,
  });
}

/** Parse an exported file or a stored document; schema 1 is upgraded. Throws a readable Error. */
export function parseDoc(input: string | unknown): ProjectDoc {
  let p: Record<string, unknown>;
  try {
    p = (typeof input === "string" ? JSON.parse(input) : input) as Record<string, unknown>;
  } catch {
    throw new Error("Not a JSON file.");
  }
  if (!p || typeof p !== "object" || p.app !== "OffshoreForge" || (p.schema !== 1 && p.schema !== 2))
    throw new Error("Not an OffshoreForge project file (schema 1 or 2).");
  const turbines = Array.isArray(p.turbines) && p.turbines.length <= MAX_TURBINES ? (p.turbines as Turbine[]) : null;
  if (!turbines) throw new Error(`Invalid turbine list (at most ${MAX_TURBINES}).`);

  const site = (p.schema === 1 ? { polygon: p.site } : (p.site ?? {})) as Record<string, unknown>;
  const polygon = Array.isArray(site.polygon) && site.polygon.length >= 3 ? (site.polygon as LonLat[]) : null;
  const model = typeof p.turbineModel === "string" && p.turbineModel in TURBINE_MODELS ? p.turbineModel : DEFAULT_TURBINE_ID;
  return {
    schema: DOC_SCHEMA,
    app: "OffshoreForge",
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 100) : DEFAULT_NAME,
    turbineModel: model,
    site: {
      polygon,
      stage: typeof site.stage === "string" ? site.stage : "screening",
      done: Array.isArray(site.done) ? site.done.filter((d): d is string => typeof d === "string") : [],
    },
    turbines,
    oss: (p.oss as LonLat | null) ?? null,
    costs: (p.costs as CostInputs) ?? {},
    lifecycle: p.lifecycle && typeof p.lifecycle === "object" ? (p.lifecycle as Record<string, unknown>) : null,
  };
}
