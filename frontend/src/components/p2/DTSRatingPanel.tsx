/**
 * DTS Dynamic Rating Panel — M10.
 *
 * KPI cards: static vs dynamic ampacity, headroom, thermal utilisation.
 * Active hotspot severity list.
 * IEC 60287: static 800 A; dynamic = 800 × √((90-T_amb)/(90-15)).
 */

import { useCableDTSStore } from "../../store/cableDtsStore";

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-bg-tertiary rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

export default function DTSRatingPanel() {
  const { dynamicRating, hotspots } = useCableDTSStore();

  if (!dynamicRating) return null;

  const utilisationColor =
    dynamicRating.thermal_utilisation_pct > 90 ? "#ef4444"
    : dynamicRating.thermal_utilisation_pct > 75 ? "#f59e0b"
    : "#3ecf6e";

  return (
    <div className="space-y-3">
      {/* Rating KPIs */}
      <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Dynamic Ampacity Rating</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Static rating (IEC 60287)</p>
            <p className="font-mono font-bold text-text-primary text-lg">{dynamicRating.static_rating_a} <span className="text-sm font-normal text-text-muted">A</span></p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Dynamic rating</p>
            <p className={`font-mono font-bold text-lg ${dynamicRating.dynamic_rating_a >= dynamicRating.static_rating_a ? "text-status-success" : "text-status-warning"}`}>
              {dynamicRating.dynamic_rating_a} <span className="text-sm font-normal text-text-muted">A</span>
            </p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Headroom</p>
            <p className="font-mono font-bold text-text-primary">{dynamicRating.headroom_a} A</p>
            <p className="text-text-muted">{dynamicRating.headroom_pct.toFixed(1)}%</p>
          </div>
          <div className="bg-bg-tertiary rounded p-2">
            <p className="text-text-muted">Thermal utilisation</p>
            <p className="font-mono font-bold" style={{ color: utilisationColor }}>
              {dynamicRating.thermal_utilisation_pct.toFixed(1)}%
            </p>
            <Bar pct={dynamicRating.thermal_utilisation_pct} color={utilisationColor} />
          </div>
        </div>
        <p className="mt-2 text-xs text-text-muted">{dynamicRating.assessment}</p>
      </div>

      {/* Hotspot list */}
      {hotspots && hotspots.hotspot_count > 0 && (
        <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h3 className="text-sm font-semibold text-text-primary mb-2">
            Active Hotspots ({hotspots.hotspot_count})
          </h3>
          <div className="space-y-1.5">
            {hotspots.hotspots.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border-primary/40 last:border-0">
                <span className="font-mono text-text-secondary">{h.distance_km.toFixed(1)} km</span>
                <span className="text-text-primary font-mono">{h.temperature_c.toFixed(1)}°C</span>
                <span className={`px-2 py-0.5 rounded ${h.severity === "CRITICAL" ? "bg-status-alarm/20 text-status-alarm" : "bg-status-warning/20 text-status-warning"}`}>
                  {h.severity}
                </span>
                <span className="text-text-muted truncate max-w-[120px]">{h.cause}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
