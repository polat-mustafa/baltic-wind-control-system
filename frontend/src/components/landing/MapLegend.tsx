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
    <div className="pointer-events-auto bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5">
      <div className="flex items-center gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 text-[10px] text-slate-300">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
