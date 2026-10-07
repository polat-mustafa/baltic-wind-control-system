/**
 * The farm the P2 grid and P5 commissioning endpoints model. In own-project
 * mode with a layout (turbines + OSS) every `/api/v1/grid` and
 * `/api/v1/commissioning` request carries it in the `X-Farm` header — strings
 * from the cable tree, mean array section length, export length — and the
 * backend sizes the network for it (routers/farm_spec.py); a switching
 * programme keeps the farm it was created for. Otherwise no header: SB-510.
 */

import { setRequestHeaders } from "../../services/apiClient";
import { useModeStore } from "../../store/modeStore";
import { useProjectStore } from "../../store/projectStore";
import { useProjectSync } from "../../store/projectSync";
import { useSiteStore } from "../../store/siteStore";
import { farmPlan } from "../lifecycle/farm";

export interface FarmInput {
  name: string;
  strings: number[];
  export_km: number;
  array_km: number;
}

/** The own project's farm, or null (reference mode or no layout yet). */
export function farmInput(): FarmInput | null {
  if (useModeStore.getState().mode !== "own") return null;
  const { turbines, oss } = useProjectStore.getState();
  const { site, report } = useSiteStore.getState();
  const plan = farmPlan({ turbines, oss }, { site, report });
  if (plan.source !== "project") return null;
  return {
    name: useProjectSync.getState().name,
    strings: plan.strings,
    export_km: Math.max(1, plan.exportKm),
    array_km: Math.max(0.1, Math.round((plan.arrayKm / plan.turbines.length) * 1000) / 1000),
  };
}

/** Header value (URL-encoded JSON: header values must be Latin-1), or null for SB-510. */
export function farmHeader(): string | null {
  const f = farmInput();
  return f ? encodeURIComponent(JSON.stringify(f)) : null;
}

/** Same value as `farmHeader`, "sb510" without one — tells when P2 results belong to another farm. */
export const farmKey = () => farmHeader() ?? "sb510";

const FARM_APIS = ["/api/v1/grid", "/api/v1/commissioning"];

export function initFarmHeader(): void {
  setRequestHeaders((url): Record<string, string> => {
    const h = FARM_APIS.some((p) => url.startsWith(p)) ? farmHeader() : null;
    return h ? { "X-Farm": h } : {};
  });
}
