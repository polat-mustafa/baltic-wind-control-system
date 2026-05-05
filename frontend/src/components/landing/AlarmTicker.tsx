/**
 * Compact alarm ticker bar — shows currently faulted turbines on the map.
 *
 * Reads from landingStore turbineMap, filters for status === "fault",
 * and displays up to 5 active faults with turbine ID + fault type label.
 * Pulsing red dots per ISA-101 styling.
 */

import { Link } from "react-router-dom";

import { FAULT_CATEGORIES } from "../../constants/faultCategories";
import { SCADA_COLORS } from "../../constants/scadaColors";
import { useLandingStore } from "../../store/landingStore";
import { useScadaStore } from "../../store/scadaStore";

export default function AlarmTicker() {
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const scadaAlarmCount = useScadaStore((s) =>
    s.alarms.filter((a) => a.state === "ACTIVE" || a.state === "ACKNOWLEDGED").length,
  );

  const faultedTurbines = Object.values(turbineMap)
    .filter((t) => t.status === "fault")
    .slice(0, 5);

  const totalFaults = Object.values(turbineMap).filter((t) => t.status === "fault").length;

  if (faultedTurbines.length === 0 && scadaAlarmCount === 0) return null;

  return (
    <div
      className="pointer-events-auto rounded-md border px-2 py-1.5 backdrop-blur-sm"
      style={{
        backgroundColor: "rgba(15,17,23,0.9)",
        borderColor: faultedTurbines.length > 0 ? "rgba(239,68,68,0.3)" : "rgba(107,116,144,0.3)",
        maxWidth: 360,
      }}
    >
      {faultedTurbines.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: SCADA_COLORS.FAULT }}
            />
            <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: SCADA_COLORS.FAULT }}>
              Active Faults ({totalFaults})
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
                    <span className="text-[9px] text-text-muted truncate">
                      {category.label}
                    </span>
                  )}
                </div>
              );
            })}
            {totalFaults > 5 && (
              <div className="text-[9px] text-text-muted font-mono">
                +{totalFaults - 5} more
              </div>
            )}
          </div>
        </>
      )}

      {/* SCADA alarm count link */}
      {scadaAlarmCount > 0 && (
        <>
          {faultedTurbines.length > 0 && (
            <div className="my-1 border-t" style={{ borderColor: "rgba(107,116,144,0.2)" }} />
          )}
          <Link
            to="/scada"
            className="flex items-center gap-1.5 text-[9px] font-mono text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span className="w-1 h-1 rounded-full bg-amber-400" />
            {scadaAlarmCount} SCADA alarm{scadaAlarmCount !== 1 ? "s" : ""} active →
          </Link>
        </>
      )}
    </div>
  );
}
