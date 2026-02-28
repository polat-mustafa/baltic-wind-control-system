/**
 * Status color legend for the wind farm map.
 *
 * Shows ISA-101 compliant color mapping:
 *   green = operating, amber = curtailed, red = fault, gray = offline
 */

import { SCADA_COLORS } from "../../constants/scadaColors";
import type { TurbineStatus } from "../../types/landing";

const LEGEND_ITEMS: { status: TurbineStatus; label: string; color: string }[] = [
  { status: "operating", label: "Operating", color: SCADA_COLORS.ENERGIZED },
  { status: "curtailed", label: "Curtailed", color: SCADA_COLORS.WARNING },
  { status: "fault", label: "Fault", color: SCADA_COLORS.FAULT },
  { status: "offline", label: "Offline", color: SCADA_COLORS.DE_ENERGIZED },
];

export default function MapLegend() {
  return (
    <div className="absolute top-3 right-3 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2">
      <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-semibold">
        Status
      </div>
      <div className="flex flex-col gap-1">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.status} className="flex items-center gap-2 text-xs text-slate-300">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
