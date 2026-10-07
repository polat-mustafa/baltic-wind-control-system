import { useMemo } from "react";

import { farmPlan, type FarmPlan } from "../lib/lifecycle/farm";
import { useModeStore } from "../store/modeStore";
import { useProjectStore } from "../store/projectStore";
import { useSiteStore } from "../store/siteStore";

const NONE: never[] = [];

/** The farm the lifecycle pages work on: the layout project in own-project mode, else SB-510
 * (same rule as the X-Farm header, so pages and backend results describe one farm). */
export function useFarmPlan(): FarmPlan {
  const own = useModeStore((s) => s.mode === "own");
  const turbines = useProjectStore((s) => (own ? s.turbines : NONE));
  const oss = useProjectStore((s) => (own ? s.oss : null));
  const site = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  return useMemo(() => farmPlan({ turbines, oss }, { site, report }), [turbines, oss, site, report]);
}
