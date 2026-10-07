import { useEffect, useMemo } from "react";

import { fleetFromPlan, SB510_FLEET, useFleetStore } from "../lib/fleet";
import { farmKey } from "../lib/project/farmHeader";
import { useGridStore } from "../store/gridStore";
import { useSiteStore } from "../store/siteStore";
import { useFarmPlan } from "./useFarmPlan";

/** The site report's grid node, located in the "grid" constraint layer. */
function useGridNode(): { name: string; lat: number; lon: number } | null {
  const name = useSiteStore((s) => s.report?.grid_node ?? null);
  const layers = useSiteStore((s) => s.layers);
  return useMemo(() => {
    for (const l of layers?.layers ?? []) {
      if (l.role !== "grid") continue;
      const f = l.features.find((x) => x.name === name);
      if (f?.geometry.type === "Point") return { name: f.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
    }
    return null;
  }, [name, layers]);
}

/**
 * Keep the live fleet (lib/fleet.ts) on the farm the backend models: SB-510,
 * or the own project once /grid/network-spec has sized its network. Until
 * then — or when the backend refuses the design (HVDC-length export) — the
 * previous fleet stays. Mounted once, in the app shell.
 */
export function useLiveFleet(): void {
  const plan = useFarmPlan();
  const net = useGridStore((s) => s.networkSpec);
  const farmFor = useGridStore((s) => s.farmFor);
  const site = useSiteStore((s) => s.site);
  const grid = useGridNode();
  useEffect(() => {
    const setFleet = useFleetStore.getState().setFleet;
    if (plan.source === "sb510") return setFleet(SB510_FLEET);
    const key = farmKey();
    if (farmFor !== key) {
      void useGridStore.getState().fetchNetworkSpec();
      return;
    }
    if (net) setFleet(fleetFromPlan(plan, net, key, { site, grid }));
  }, [plan, net, farmFor, site, grid]);
}
