import type { LoadFlowScenario } from "../types/grid";

/** Display names of the four P2 load-flow scenarios. */
export const SCENARIO_LABEL: Record<LoadFlowScenario, string> = {
  full_load: "Full load 510 MW",
  partial_load: "Part load 255 MW",
  no_load: "No load",
  n_minus_1: "N-1 string 6 out",
};
