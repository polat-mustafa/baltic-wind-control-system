/**
 * Zoom-dependent progressive turbine detail overlays.
 *
 * Progressive disclosure at higher zoom levels:
 *   Zoom 11-12 (default): Just spinning turbine icons (existing)
 *   Zoom 13+:  Power output labels (MW) below each turbine
 *   Zoom 14+:  Blade pitch angle arc indicator near nacelle
 *
 * Each per-turbine badge subscribes individually to the store
 * via selectTurbine(id) — only the turbine whose power/pitch
 * actually changed will re-render (same pattern as TurbineMarker).
 *
 * Tower sway animation is toggled via CSS class on the map
 * container at zoom ≥ 14 (subtle oscillation proportional to wind).
 */

import { memo, useEffect, useMemo, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";

import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { selectTurbine, useLandingStore } from "../../store/landingStore";
import type { TurbineStatus } from "../../types/landing";

// ── Shared zoom hook ────────────────────────────────────────────

function useZoom(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  return zoom;
}

// ── Status → badge colour ───────────────────────────────────────

const STATUS_BADGE_COLOR: Record<TurbineStatus, string> = {
  operating: "#3ecf6e",
  curtailed: "#f5a623",
  fault: "#ef4444",
  offline: "#6b7280",
};

// ── Power Badge (zoom ≥ 13) ─────────────────────────────────────
// Shows real-time MW output below each turbine icon.
// DivIcon is recreated when power changes (rounded to 0.1 MW)
// which is fine — there are no CSS animations to preserve here.

const TurbinePowerBadge = memo(function TurbinePowerBadge({
  turbineId,
  lat,
  lon,
}: {
  turbineId: string;
  lat: number;
  lon: number;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  if (!turbine) return null;

  const color = STATUS_BADGE_COLOR[turbine.status];
  const powerText = turbine.powerOutputMW.toFixed(1);

  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<span style="color:${color}">${powerText}<small> MW</small></span>`,
        className: "leaflet-turbine-power-badge",
        iconSize: [52, 14],
        iconAnchor: [26, -40],
      }),
    [color, powerText],
  );

  return (
    <Marker
      position={[lat, lon]}
      icon={icon}
      zIndexOffset={-1000}
    />
  );
});

// ── Pitch Arc Indicator (zoom ≥ 14) ─────────────────────────────
// Small arc gauge showing blade pitch angle (0° = fine, 25° = limiting,
// 90° = feathered/shutdown). Educational: shows how pitch control works.

const TurbinePitchArc = memo(function TurbinePitchArc({
  turbineId,
  lat,
  lon,
}: {
  turbineId: string;
  lat: number;
  lon: number;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  if (!turbine) return null;

  const pitch = turbine.pitchAngleDeg;
  // Arc sweep: pitch 0→90° maps to 0→180° SVG arc
  const sweep = Math.min((pitch / 90) * 180, 180);
  // Colour: green (fine) → amber (limiting) → red (feathered)
  const arcColor =
    pitch < 5 ? "#3ecf6e" : pitch < 15 ? "#f5a623" : "#ef4444";

  const icon = useMemo(() => {
    const r = 7;
    const cx = 10;
    const cy = 10;

    // SVG arc from -90° (top), sweeping clockwise
    const startRad = (-90 * Math.PI) / 180;
    const endRad = ((-90 + sweep) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const large = sweep > 180 ? 1 : 0;

    const arcPath =
      sweep > 0.5
        ? `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${arcColor}" stroke-width="2.5" stroke-linecap="round"/>`
        : `<circle cx="${cx}" cy="${cy - r}" r="1.5" fill="${arcColor}"/>`;

    const svg = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3d4560" stroke-width="1.5" opacity="0.5"/>
      ${arcPath}
      <text x="${cx}" y="${cy + 3}" fill="#94a3b8" font-size="5.5" font-family="JetBrains Mono, monospace" text-anchor="middle">${pitch.toFixed(0)}°</text>
    </svg>`;

    return L.divIcon({
      html: svg,
      className: "leaflet-turbine-pitch-arc",
      iconSize: [20, 20],
      iconAnchor: [-24, 10],
    });
  }, [pitch, sweep, arcColor]);

  return (
    <Marker
      position={[lat, lon]}
      icon={icon}
      zIndexOffset={-1000}
    />
  );
});

// ── Tower Sway CSS class toggle ─────────────────────────────────
// At zoom ≥ 14, adds class that enables subtle horizontal sway
// animation on turbine markers (CSS-only, wind-proportional period).

function TowerSwayUpdater({ zoom }: { zoom: number }) {
  const map = useMap();

  useEffect(() => {
    const el = map.getContainer();
    if (zoom >= 14) {
      el.classList.add("high-zoom-detail");
    } else {
      el.classList.remove("high-zoom-detail");
    }
    return () => {
      el.classList.remove("high-zoom-detail");
    };
  }, [map, zoom]);

  return null;
}

// ── Main Overlay ─────────────────────────────────────────────────

export default function TurbineDetailOverlay() {
  const zoom = useZoom();

  return (
    <>
      {/* Tower sway CSS class toggle (always active for cleanup) */}
      <TowerSwayUpdater zoom={zoom} />

      {/* Power output labels (zoom ≥ 13) */}
      {zoom >= 13 &&
        TURBINE_POSITIONS.map((pos) => (
          <TurbinePowerBadge
            key={`power-${pos.id}`}
            turbineId={pos.id}
            lat={pos.lat}
            lon={pos.lon}
          />
        ))}

      {/* Pitch angle arc indicators (zoom ≥ 14) */}
      {zoom >= 14 &&
        TURBINE_POSITIONS.map((pos) => (
          <TurbinePitchArc
            key={`pitch-${pos.id}`}
            turbineId={pos.id}
            lat={pos.lat}
            lon={pos.lon}
          />
        ))}
    </>
  );
}
