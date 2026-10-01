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
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Marker, useMap } from "react-leaflet";
import L from "leaflet";

import { TURBINE_POSITIONS, turbineIconScale } from "../../constants/windFarmLayout";
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
// Real-time MW under each turbine icon. The DivIcon is built once per zoom
// scale; the value and colour are written into its DOM each tick, so the
// 34 badges never get replaced (no flicker on wind changes).

const TurbinePowerBadge = memo(function TurbinePowerBadge({
  turbineId,
  lat,
  lon,
  scale,
}: {
  turbineId: string;
  lat: number;
  lon: number;
  scale: number;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const markerRef = useRef<L.Marker | null>(null);
  const color = turbine ? STATUS_BADGE_COLOR[turbine.status] : "";
  const powerText = turbine ? turbine.powerOutputMW.toFixed(1) : "";

  // Below the icon's ID label (text baseline ≈ 34.5 units under the hub).
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<span><b class="wtg-badge-value"></b><small> MW</small></span>`,
        className: "leaflet-turbine-power-badge",
        iconSize: [52, 14],
        iconAnchor: [26, -(36 * scale + 3)],
      }),
    [scale],
  );

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.style.color = color;
    const v = el.querySelector(".wtg-badge-value");
    if (v) v.textContent = powerText;
  }, [icon, color, powerText]);

  if (!turbine) return null;
  return <Marker ref={markerRef} position={[lat, lon]} icon={icon} zIndexOffset={-1000} />;
});

// ── Pitch Arc Indicator (zoom ≥ 14) ─────────────────────────────
// Small arc gauge showing blade pitch angle (0° = fine, 25° = limiting,
// 90° = feathered/shutdown). Educational: shows how pitch control works.
// Same pattern: static icon, arc/text/colour updated in place.

const PITCH_R = 7;
const PITCH_C = 10;

function pitchGaugeArc(pitch: number): string {
  const sweep = Math.min((Math.max(pitch, 0) / 90) * 180, 180);
  if (sweep <= 0.5) return "";
  const end = ((-90 + sweep) * Math.PI) / 180;
  const x2 = PITCH_C + PITCH_R * Math.cos(end);
  const y2 = PITCH_C + PITCH_R * Math.sin(end);
  return `M ${PITCH_C} ${PITCH_C - PITCH_R} A ${PITCH_R} ${PITCH_R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const TurbinePitchArc = memo(function TurbinePitchArc({
  turbineId,
  lat,
  lon,
  scale,
}: {
  turbineId: string;
  lat: number;
  lon: number;
  scale: number;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const markerRef = useRef<L.Marker | null>(null);
  const pitch = turbine?.pitchAngleDeg ?? 0;
  // Colour: green (fine) → amber (limiting) → red (feathered)
  const arcColor = pitch < 5 ? "#3ecf6e" : pitch < 15 ? "#f5a623" : "#ef4444";

  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${PITCH_C}" cy="${PITCH_C}" r="${PITCH_R}" fill="none" stroke="#3d4560" stroke-width="1.5" opacity="0.5"/>
      <path class="pitch-arc" fill="none" stroke-width="2.5" stroke-linecap="round"/>
      <circle class="pitch-dot" cx="${PITCH_C}" cy="${PITCH_C - PITCH_R}" r="1.5"/>
      <text class="pitch-text" x="${PITCH_C}" y="${PITCH_C + 3}" fill="#94a3b8" font-size="5.5" font-family="JetBrains Mono, monospace" text-anchor="middle"></text>
    </svg>`,
        className: "leaflet-turbine-pitch-arc",
        iconSize: [20, 20],
        // Right of the yaw heading arrow (radius 17 units)
        iconAnchor: [-(17 * scale + 4), 10],
      }),
    [scale],
  );

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    const d = pitchGaugeArc(pitch);
    const arc = el.querySelector(".pitch-arc");
    arc?.setAttribute("d", d);
    arc?.setAttribute("stroke", arcColor);
    el.querySelector(".pitch-dot")?.setAttribute("fill", d ? "none" : arcColor);
    const text = el.querySelector(".pitch-text");
    if (text) text.textContent = `${pitch.toFixed(0)}°`;
  }, [icon, pitch, arcColor]);

  if (!turbine) return null;
  return <Marker ref={markerRef} position={[lat, lon]} icon={icon} zIndexOffset={-1000} />;
});

// ── Main Overlay ─────────────────────────────────────────────────

export default function TurbineDetailOverlay() {
  const zoom = useZoom();
  const scale = turbineIconScale(zoom);

  return (
    <>
      {/* Power output labels (zoom ≥ 13) */}
      {zoom >= 13 &&
        TURBINE_POSITIONS.map((pos) => (
          <TurbinePowerBadge
            key={`power-${pos.id}`}
            turbineId={pos.id}
            lat={pos.lat}
            lon={pos.lon}
            scale={scale}
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
            scale={scale}
          />
        ))}
    </>
  );
}
