/**
 * Compact alarm ticker bar — shows currently faulted turbines on the map.
 *
 * Reads from landingStore turbineMap, filters for status === "fault",
 * and displays up to 5 active faults with turbine ID + fault type label.
 * Pulsing red dots per ISA-101 styling.
 */

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { useLandingStore } from "../../store/landingStore";

export default function AlarmTicker() {
  const turbineMap = useLandingStore((s) => s.turbineMap);

  const faultedTurbines = Object.values(turbineMap)
    .filter((t) => t.status === "fault")
    .slice(0, 5);

  if (faultedTurbines.length === 0) return null;

  return (
    <div
      className="absolute bottom-3 left-3 z-40 rounded-md border px-2 py-1.5 backdrop-blur-sm"
      style={{
        backgroundColor: "rgba(15,17,23,0.9)",
        borderColor: "rgba(239,68,68,0.3)",
        maxWidth: 360,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: SCADA_COLORS.FAULT }}
        />
        <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: SCADA_COLORS.FAULT }}>
          Active Faults ({faultedTurbines.length})
        </span>
      </div>
      <div className="space-y-0.5">
        {faultedTurbines.map((t) => {
          const category = t.faultType
            ? FAULT_CATEGORIES.find((c) => c.type === t.faultType)
            : null;
          return (
            <div key={t.id} className="flex items-center gap-1.5">
              <span
                className="w-1 h-1 rounded-full animate-pulse"
                style={{ backgroundColor: SCADA_COLORS.FAULT }}
              />
              <span className="text-[10px] font-mono font-medium" style={{ color: SCADA_COLORS.FAULT }}>
                {t.id}
              </span>
              {category && (
                <span className="text-[9px] text-[#6b7490] truncate">
                  {category.label}
                </span>
              )}
            </div>
          );
        })}
        {Object.values(turbineMap).filter((t) => t.status === "fault").length > 5 && (
          <div className="text-[9px] text-[#6b7490] font-mono">
            +{Object.values(turbineMap).filter((t) => t.status === "fault").length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}
