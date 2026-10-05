import type { ChartPalette } from "../../hooks/useChartPalette";

/** One fixed colour per route zone, shared by the rating and transient charts. */
export const zoneColor = (c: ChartPalette, name: string): string =>
  ({ "OSS J-tube": c.blue, "Subsea burial": c.aqua, "HDD landfall": c.orange, "Land cable": c.yellow })[name] ?? c.ref;
