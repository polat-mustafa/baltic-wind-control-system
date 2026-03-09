/**
 * FarmHealthMapPanel — 34-turbine grid colored by health status.
 *
 * Displays turbines in a grid layout with color-coded health:
 * - Green (>70%): healthy
 * - Amber (40-70%): degraded
 * - Red (<40%): critical
 *
 * Click a turbine to select it for detailed analysis in other panels.
 */

import { ChartWrapper } from "../ui/ChartWrapper";
import { useDigitalTwinStore } from "../../store/digitalTwinStore";

function healthColor(pct: number): string {
  if (pct >= 70) return "bg-green-500/80 border-green-400/50";
  if (pct >= 40) return "bg-amber-500/80 border-amber-400/50";
  return "bg-red-500/80 border-red-400/50";
}

function healthTextColor(pct: number): string {
  if (pct >= 70) return "text-green-100";
  if (pct >= 40) return "text-amber-100";
  return "text-red-100";
}

export default function FarmHealthMapPanel() {
  const analysis = useDigitalTwinStore((s) => s.analysis);
  const selectedTurbineId = useDigitalTwinStore((s) => s.selectedTurbineId);
  const setSelectedTurbineId = useDigitalTwinStore((s) => s.setSelectedTurbineId);

  if (!analysis) return null;

  const turbines = analysis.turbine_health;

  return (
    <ChartWrapper
      title="Farm Health Map"
      footer="Click a turbine to inspect details. Color = health status."
    >
      <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 p-2">
        {turbines.map((t) => {
          const isSelected = selectedTurbineId === t.turbine_id;
          return (
            <button
              key={t.turbine_id}
              onClick={() => setSelectedTurbineId(t.turbine_id)}
              className={`
                relative rounded-md border p-1.5 transition-all duration-200
                ${healthColor(t.health_composite)}
                ${isSelected ? "ring-2 ring-white/80 scale-110 z-10" : "hover:scale-105"}
              `}
              title={`${t.turbine_name}: ${t.health_composite.toFixed(1)}% (${t.status})`}
            >
              <p className={`text-[9px] font-bold ${healthTextColor(t.health_composite)}`}>
                {t.turbine_name.replace("WTG-", "")}
              </p>
              <p className={`text-[8px] font-mono ${healthTextColor(t.health_composite)}`}>
                {t.health_composite.toFixed(0)}%
              </p>
              {t.anomaly_count > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full text-[7px] font-bold text-white flex items-center justify-center">
                  {t.anomaly_count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </ChartWrapper>
  );
}
