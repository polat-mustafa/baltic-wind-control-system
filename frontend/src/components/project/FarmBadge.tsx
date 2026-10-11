/**
 * The farm a page works on, the same words everywhere: "SB-510 reference · 34 × 15 MW = 510 MW"
 * or the own project's name and size. `live` follows the live fleet (lib/fleet.ts — the
 * own project once it has a layout, else SB-510); `reference` is for pages that always
 * analyse SB-510.
 */

import { farmTitle, SB510_FLEET, useFleet } from "../../lib/fleet";

export type FarmScope = "live" | "reference";

export function FarmBadge({ scope }: { scope: FarmScope }) {
  const live = useFleet();
  const f = scope === "reference" ? SB510_FLEET : live;
  const n = f.turbines.length;
  return (
    <span
      data-testid="farm-badge"
      className="rounded border border-accent/50 px-2 py-0.5 font-mono text-xs text-text-primary"
      title={scope === "reference" ? "This page analyses the SB-510 reference farm" : "The farm this page models"}
    >
      {farmTitle(f)} · {n} × 15 MW = {f.net.total_capacity_mw.toFixed(0)} MW
    </span>
  );
}
