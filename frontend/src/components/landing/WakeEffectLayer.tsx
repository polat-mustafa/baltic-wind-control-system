/**
 * Wake effect visualization layer for the Leaflet wind farm map.
 *
 * Shows Jensen/Park wake deficit cones behind each turbine and
 * "-X%" power loss badges on downstream turbines caught in wakes.
 *
 * Wind direction is quantized to 5° steps to avoid excessive
 * polygon recalculation on every store tick.
 *
 * Educational value: students SEE why turbine spacing, layout geometry,
 * and wind direction matter for farm energy yield.
 */

import { useMemo } from "react";
import L from "leaflet";
import { Marker, Polygon } from "react-leaflet";

import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { computeWakeLosses, wakeConePoly } from "../../utils/wakeModel";

// ── Helpers ──────────────────────────────────────────────────────

/** Round wind direction to nearest `step` degrees. */
function quantize(deg: number, step = 5): number {
  return Math.round(deg / step) * step;
}

/** Stable reference to turbine geographic data (never changes). */
const TURBINE_GEO = TURBINE_POSITIONS.map((t) => ({
  id: t.id,
  lat: t.lat,
  lon: t.lon,
}));

// ── Wake loss badge icon factory ─────────────────────────────────

function wakeLossIcon(lossPct: number): L.DivIcon {
  const color =
    lossPct > 20 ? "#ef4444" : lossPct > 10 ? "#f97316" : "#fbbf24";

  return L.divIcon({
    html: `<span style="
      font-family:'JetBrains Mono',monospace;
      font-size:9px;
      font-weight:600;
      color:${color};
      background:rgba(15,17,23,0.85);
      border:1px solid ${color}40;
      border-radius:3px;
      padding:1px 3px;
      white-space:nowrap;
    ">\u2212${lossPct}%</span>`,
    className: "leaflet-wake-loss-badge",
    iconSize: [0, 0],
    iconAnchor: [-22, 10], // offset right and down from turbine centre
  });
}

// ── Component ────────────────────────────────────────────────────

export default function WakeEffectLayer() {
  const kpis = useLandingStore(selectKPIs);
  const windDir = quantize(kpis.windDirectionDeg);

  const { cones, losses } = useMemo(() => {
    const cones = TURBINE_GEO.map((t) => ({
      id: t.id,
      poly: wakeConePoly(t.lat, t.lon, windDir),
    }));
    const losses = computeWakeLosses(TURBINE_GEO, windDir);
    return { cones, losses };
  }, [windDir]);

  return (
    <>
      {/* Wake cone polygons (semi-transparent red fill) */}
      {cones.map((c) => (
        <Polygon
          key={`wake-${c.id}`}
          positions={c.poly}
          pathOptions={{
            color: "transparent",
            fillColor: "#ef4444",
            fillOpacity: 0.06,
            weight: 0,
            interactive: false,
          }}
        />
      ))}

      {/* Wake loss percentage badges on affected downstream turbines */}
      {losses.map((l) => {
        const pos = TURBINE_POSITIONS.find((t) => t.id === l.turbineId);
        if (!pos) return null;
        return (
          <Marker
            key={`loss-${l.turbineId}`}
            position={[pos.lat, pos.lon]}
            icon={wakeLossIcon(l.lossPct)}
            interactive={false}
          />
        );
      })}
    </>
  );
}
