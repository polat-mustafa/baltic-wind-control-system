/**
 * Wake effect visualization layer for the Leaflet wind farm map.
 *
 * Shows Jensen/Park wake deficit cones behind each turbine and
 * quiet loss badges on the most-affected downstream turbines.
 *
 * Wind direction is quantized to 5° steps to avoid excessive
 * polygon recalculation on every store tick.
 *
 * Educational value: students SEE why turbine spacing, layout geometry,
 * and wind direction matter for farm energy yield.
 *
 * Badge policy: badges are only rendered for turbines with loss ≥
 * WAKE_BADGE_MIN_PCT, so at default zoom the map shows at most a handful of
 * subdued indicators instead of a red/amber wall on every icon. Full per-
 * turbine losses are still reachable through the detail panel.
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

/**
 * Badges are only shown for turbines that (a) lose at least this percentage
 * AND (b) are among the MAX_WAKE_BADGES worst offenders in the farm. This
 * keeps the map legible when strong winds deep inside the grid would
 * otherwise paint every icon with a red pill.
 */
const WAKE_BADGE_MIN_PCT = 15;
const MAX_WAKE_BADGES = 6;

function wakeLossIcon(lossPct: number): L.DivIcon {
  const color =
    lossPct > 25 ? "#ef4444" : lossPct > 15 ? "#f97316" : "#fbbf24";

  const minus = String.fromCharCode(0x2212);
  return L.divIcon({
    html: `<span style="
      font-family:'JetBrains Mono',monospace;
      font-size:8px;
      font-weight:600;
      color:${color};
      background:rgba(15,17,23,0.6);
      border:1px solid ${color}40;
      border-radius:999px;
      padding:0 3px;
      white-space:nowrap;
      line-height:10px;
      opacity:0.6;
    ">${minus}${lossPct}%</span>`,
    className: "leaflet-wake-loss-badge",
    iconSize: [0, 0],
    iconAnchor: [-18, 8], // offset right and down from turbine centre
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
    const allLosses = computeWakeLosses(TURBINE_GEO, windDir);
    const losses = allLosses
      .filter((l) => l.lossPct >= WAKE_BADGE_MIN_PCT)
      .sort((a, b) => b.lossPct - a.lossPct)
      .slice(0, MAX_WAKE_BADGES);
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

      {/* Wake loss percentage badges — only for the worst offenders */}
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
