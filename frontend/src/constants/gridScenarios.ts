import type { LoadFlowScenario, NetworkSpec } from "../types/grid";

/** Display names of the four P2 load-flow scenarios for the modelled farm. */
export function scenarioLabels(n: NetworkSpec): Record<LoadFlowScenario, string> {
  const mw = n.total_capacity_mw;
  return {
    full_load: `Full load ${mw.toFixed(0)} MW`,
    partial_load: `Part load ${(mw / 2).toFixed(0)} MW`,
    no_load: "No load",
    n_minus_1: n.num_strings > 1 ? `N-1 string ${n.num_strings} out` : "N-1 (one string: no outage case)",
  };
}
