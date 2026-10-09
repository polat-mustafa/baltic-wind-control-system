/**
 * Wake effect visualization layer for the Leaflet wind farm map.
 *
 * Shows the 2σ envelope of each turbine's Gaussian (Bastankhah) wake and
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

import { useFleet } from "../../lib/fleet";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { farmWakeDeficits, wakePowerLossPct } from "../../utils/landingPhysics";
import { wakeConePoly } from "../../utils/wakeModel";

// ── Helpers ──────────────────────────────────────────────────────

/** Round wind direction to nearest `step` degrees. */
function quantize(deg: number, step = 5): number {
  return Math.round(deg / step) * step;
}

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
    lossPct > 25 ? "#f25c54" : lossPct > 15 ? "#f97316" : "#fbbf24";

  const minus = String.fromCharCode(0x2212);
  return L.divIcon({
    html: `<span style="
      font-family:'IBM Plex Mono',monospace;
      font-size:8px;
      font-weight:600;
      color:${color};
      background:rgba(10,21,32,0.6);
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
  // Cones follow the wind in 1° steps (smooth sweep); the wake deficits
  // behind the loss badges are cached per 5° (utils/landingPhysics).
  const coneDir = quantize(kpis.windDirectionDeg, 1);
  const windDir = quantize(kpis.windDirectionDeg);
  // Live power loss depends on the freestream speed (none once the waked
  // wind is still above rated) — rounded to 0.5 m/s to limit recomputes.
  const freeMs = Math.round(kpis.freestreamWindMs * 2) / 2;
  const fleet = useFleet();
  const posById = useMemo(() => new Map(fleet.turbines.map((t) => [t.id, t])), [fleet]);

  const cones = useMemo(
    () => fleet.turbines.map((t) => ({ id: t.id, poly: wakeConePoly(t.lat, t.lon, coneDir) })),
    [coneDir, fleet],
  );
  const losses = useMemo(() => {
    const allLosses = [...farmWakeDeficits(windDir, fleet)].map(([turbineId, deficit]) => ({
      turbineId,
      lossPct: Math.round(wakePowerLossPct(freeMs, deficit)),
    }));
    return allLosses
      .filter((l) => l.lossPct >= WAKE_BADGE_MIN_PCT)
      .sort((a, b) => b.lossPct - a.lossPct)
      .slice(0, MAX_WAKE_BADGES)
      .map((l) => ({ ...l, icon: wakeLossIcon(l.lossPct) }));
  }, [windDir, freeMs, fleet]);

  return (
    <>
      {/* Wake cone polygons (semi-transparent red fill) */}
      {cones.map((c) => (
        <Polygon
          key={`wake-${c.id}`}
          positions={c.poly}
          pathOptions={{
            color: "transparent",
            fillColor: "#f25c54",
            fillOpacity: 0.06,
            weight: 0,
            interactive: false,
          }}
        />
      ))}

      {/* Wake loss percentage badges — only for the worst offenders */}
      {losses.map((l) => {
        const pos = posById.get(l.turbineId);
        if (!pos) return null;
        return (
          <Marker
            key={`loss-${l.turbineId}`}
            position={[pos.lat, pos.lon]}
            icon={l.icon}
            interactive={false}
          />
        );
      })}
    </>
  );
}
