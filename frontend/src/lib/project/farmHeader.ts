/**
 * The farm the P2 grid, P3 SCADA, P5 commissioning and Digital Twin endpoints
 * model. In own-project mode with a layout (turbines + OSS) their requests
 * carry it in the `X-Farm` header — strings from the cable tree, mean array
 * section length, export length, the site's hub-height Weibull wind — and the
 * backend sizes the network for it (routers/farm_spec.py); a switching
 * programme keeps the farm it was created for. Otherwise no header: SB-510.
 * The live control room runs the same farm (lib/fleet.ts), so the bay
 * controllers behind its single-line diagram get the header too.
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
  /** Site Weibull A [m/s] and k at hub height (Digital Twin inflow), when known. */
  wind_a?: number;
  wind_k?: number;
  /** PSE connection point of the site assessment. */
  grid_node?: string;
  /** Short-circuit power at that node [MVA], from the TSO's connection conditions. */
  grid_ssc_mva?: number;
}

/** The own project's farm, or null (reference mode or no layout yet). */
export function farmInput(): FarmInput | null {
  if (useModeStore.getState().mode !== "own") return null;
  const { turbines, oss } = useProjectStore.getState();
  const { site, report, routeKm, gridSscMva } = useSiteStore.getState();
  const plan = farmPlan({ turbines, oss }, { site, report, routeKm });
  if (plan.source !== "project") return null;
  return {
    name: useProjectSync.getState().name,
    strings: plan.strings,
    export_km: Math.max(1, plan.exportKm),
    array_km: Math.max(0.1, Math.round((plan.arrayKm / plan.turbines.length) * 1000) / 1000),
    ...(report?.wind ? { wind_a: report.wind.weibull_a, wind_k: report.wind.weibull_k } : {}),
    ...(report?.grid_node ? { grid_node: report.grid_node } : {}),
    ...(gridSscMva ? { grid_ssc_mva: gridSscMva } : {}),
  };
}

/** Header value (URL-encoded JSON: header values must be Latin-1), or null for SB-510. */
export function farmHeader(): string | null {
  const f = farmInput();
  return f ? encodeURIComponent(JSON.stringify(f)) : null;
}

/** Same value as `farmHeader`, "sb510" without one — tells when P2 results belong to another farm. */
export const farmKey = () => farmHeader() ?? "sb510";

const FARM_APIS = ["/api/v1/grid", "/api/v1/commissioning", "/api/v1/scada", "/api/v1/digital-twin"];

export const sendsFarm = (url: string) => FARM_APIS.some((p) => url.startsWith(p));

export function initFarmHeader(): void {
  setRequestHeaders((url): Record<string, string> => {
    const h = sendsFarm(url) ? farmHeader() : null;
    return h ? { "X-Farm": h } : {};
  });
}
