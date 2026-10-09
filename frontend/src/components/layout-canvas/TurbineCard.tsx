/**
 * Card for the selected turbine, or the one being dragged (live, once per
 * animation frame): net AEP and wake loss, free and waked mean wind speed,
 * the two nearest neighbours, water depth → foundation, seabed sediment, and warnings.
 */

import { X } from "lucide-react";

import { compass, type TurbineStats } from "../../lib/layout/evaluate";
import type { LonLat } from "../../lib/layout/geometry";
import { cn } from "../../lib/utils";
import { useProjectStore } from "../../store/projectStore";
import { STATUS_STYLE, turbineGlyph, useDrag } from "./shared";

export default function TurbineCard({ stats }: { stats: (id: string, at: LonLat | null) => TurbineStats | null }) {
  const drag = useDrag();
  const selected = useProjectStore((s) => s.selected);
  const select = useProjectStore((s) => s.select);
  const id = drag.id ?? selected;
  const s = id ? stats(id, drag.id ? drag.p : null) : null;
  if (!s) return null;
  const row = (k: string, v: React.ReactNode) => (
    <div key={k} className="flex justify-between gap-3">
      <span className="text-text-muted">{k}</span>
      <span className="text-right tabular-nums text-text-primary">{v}</span>
    </div>
  );
  return (
    <div
      className="pointer-events-auto space-y-1 rounded-md border border-border-primary bg-bg-secondary/95 p-2 text-xs shadow"
      role="status"
      aria-live="polite"
      data-tour="layout-card"
    >
      <div className="flex items-center gap-1.5">
        <span dangerouslySetInnerHTML={{ __html: turbineGlyph(STATUS_STYLE[s.status].color, 16) }} />
        <b className="text-[12px] text-text-primary">{s.id}</b>
        <span className="truncate text-text-muted">{drag.id ? "moving…" : s.status === "ok" ? "OK" : STATUS_STYLE[s.status].label}</span>
        {!drag.id && (
          <button
            type="button"
            onClick={() => select(null)}
            aria-label="Close turbine card"
            className="ml-auto rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-text-secondary"
          >
            <X size={12} />
          </button>
        )}
      </div>
      {row("Net AEP (wake only)", `${s.netGWh.toFixed(1)} GWh/yr`)}
      {row("Wake loss", `${s.lossPct.toFixed(1)} %`)}
      {s.deltaGWh != null &&
        row(
          "Farm AEP if dropped here",
          <span className={cn(s.deltaGWh > 0.005 ? "text-status-normal" : s.deltaGWh < -0.005 && "text-status-warning")}>
            {s.deltaGWh >= 0 ? "+" : ""}
            {s.deltaGWh.toFixed(2)} GWh/yr
          </span>,
        )}
      {row("Mean wind, free → waked", `${s.freeMs.toFixed(2)} → ${s.wakedMs.toFixed(2)} m/s`)}
      {s.neighbours.map((n, k) =>
        row(k === 0 ? "Nearest" : "Next", `${n.id} · ${(n.m / 1000).toFixed(2)} km · ${n.d.toFixed(1)} D · ${compass(n.bearing)}`),
      )}
      {row("Water depth", s.depthM != null ? `${s.depthM.toFixed(0)} m${s.foundation ? ` → ${s.foundation.split(" (")[0]}` : ""}` : "—")}
      {row("Seabed", s.seabed ? s.seabed.name : "—")}
      {s.warnings.length > 0 && (
        <ul className="space-y-0.5 border-t border-border-primary pt-1 text-status-warning">
          {s.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
