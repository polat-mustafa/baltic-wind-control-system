import { useMemo } from "react";

import { farmPlan, type FarmPlan } from "../lib/lifecycle/farm";
import { useProjectStore } from "../store/projectStore";
import { useSiteStore } from "../store/siteStore";

/** The farm the lifecycle pages work on (layout project, else SB-510). */
export function useFarmPlan(): FarmPlan {
  const turbines = useProjectStore((s) => s.turbines);
  const oss = useProjectStore((s) => s.oss);
  const site = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  return useMemo(() => farmPlan({ turbines, oss }, { site, report }), [turbines, oss, site, report]);
}
