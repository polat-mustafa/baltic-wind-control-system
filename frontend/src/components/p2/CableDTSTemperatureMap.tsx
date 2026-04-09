/**
 * CableDTSTemperatureMap — horizontal colour-gradient heat map of the 45 km
 * export cable temperature profile from Distributed Temperature Sensing (DTS).
 *
 * Visual encoding
 * ---------------
 * - X axis: cable distance 0 km (OSS, offshore) → 45 km (onshore substation)
 * - Colour: temperature mapped to a blue→green→amber→red gradient
 *   · < 30°C   → blue   (#3b82f6)   cold / ambient
 *   · 30–60°C  → green  (#22c55e)   normal operating range
 *   · 60–80°C  → amber  (#f59e0b)   warning (> 70°C alarm)
 *   · ≥ 80°C   → red    (#ef4444)   critical (> 90°C trip)
 * - Hotspot markers: vertical white dashed lines with tooltip on hover
 * - Zone annotations: J-tube (0–0.2 km) and onshore transition (43–45 km)
 *
 * Data source: existing `useCableDTSStore().profile` (DTSProfileResponse)
 * No additional API calls needed.
 *
 * IEC references
 * --------------
 * IEC 60287 — temperature limits for XLPE cable (conductor max 90°C)
 * IEC 60840 — joint box temperature limits
 */

import { useState } from "react";
import { useCableDTSStore } from "../../store/cableDtsStore";
import type { DTSProfilePoint } from "../../types/cableDts";
import { InfoButton } from "../ui/InfoButton";
import { dtsThermalMapInfo } from "../../constants/panelInfo";

// ── Colour scale ──────────────────────────────────────────────────────────

function tempToColour(tempC: number): string {
  if (tempC < 30) return "#3b82f6"; // blue
  if (tempC < 50) {
    // blue → green  (30–50°C)
    const t = (tempC - 30) / 20;
    return interpolateHex("#3b82f6", "#22c55e", t);
  }
  if (tempC < 70) {
    // green → amber (50–70°C)
    const t = (tempC - 50) / 20;
    return interpolateHex("#22c55e", "#f59e0b", t);
  }
  if (tempC < 90) {
    // amber → red   (70–90°C)
    const t = (tempC - 70) / 20;
    return interpolateHex("#f59e0b", "#ef4444", t);
  }
  return "#ef4444"; // red (≥ 90°C)
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function interpolateHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Legend strip ──────────────────────────────────────────────────────────

function LegendStrip() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-text-muted">
      <span>Cold</span>
      <div
        className="h-2 w-32 rounded"
        style={{
          background: "linear-gradient(to right, #3b82f6, #22c55e, #f59e0b, #ef4444)",
        }}
      />
      <span>Hot</span>
      <span className="ml-2 text-[9px] opacity-60">
        &lt;30°C · 50°C · 70°C · ≥90°C
      </span>
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  point: DTSProfilePoint;
}

// ── Main component ────────────────────────────────────────────────────────

export default function CableDTSTemperatureMap() {
  const { profile } = useCableDTSStore();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (!profile || profile.profile.length === 0) {
    return (
      <div className="rounded-lg border border-border-primary bg-bg-secondary p-4">
        <p className="text-xs text-text-muted text-center py-6">
          Run analysis to see temperature heat map
        </p>
      </div>
    );
  }

  const pts = profile.profile;
  const cableKm = profile.cable_length_km;
  const hotspots = pts.filter((p) => p.is_hotspot);

  // SVG dimensions
  const svgW = 600;
  const svgH = 40;
  const paddingX = 0;

  // Convert distance → x pixel
  const toX = (km: number) => paddingX + (km / cableKm) * (svgW - 2 * paddingX);

  // Build one rect per profile point (variable width based on spacing)
  const rects = pts.map((pt, i) => {
    const x = toX(pt.distance_km);
    const nextKm = i < pts.length - 1 ? pts[i + 1].distance_km : cableKm;
    const w = Math.max(1, toX(nextKm) - x);
    return { x, w, pt };
  });

  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-3 space-y-2">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-text-primary">
            45 km Cable Temperature Profile (DTS)
          </span>
          <InfoButton info={dtsThermalMapInfo} />
        </div>
        <LegendStrip />
      </div>

      {/* Heat map strip */}
      <div className="relative" style={{ height: svgH + 20 }}>
        <svg
          width="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: svgH }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Colour-coded segments */}
          {rects.map(({ x, w, pt }, i) => (
            <rect
              key={i}
              x={x}
              y={0}
              width={w}
              height={svgH}
              fill={tempToColour(pt.temperature_c)}
              onMouseEnter={(e) => {
                const svgRect = (e.target as SVGElement)
                  .closest("svg")!
                  .getBoundingClientRect();
                setTooltip({
                  x: e.clientX - svgRect.left,
                  y: e.clientY - svgRect.top,
                  point: pt,
                });
              }}
            />
          ))}

          {/* Hotspot vertical markers */}
          {hotspots.map((hp, i) => (
            <line
              key={`hp-${i}`}
              x1={toX(hp.distance_km)}
              y1={0}
              x2={toX(hp.distance_km)}
              y2={svgH}
              stroke="white"
              strokeWidth={1.5}
              strokeDasharray="3,2"
              opacity={0.8}
            />
          ))}

          {/* Zone labels */}
          <text x={4} y={svgH - 4} fontSize={7} fill="white" opacity={0.7}>
            OSS (0 km)
          </text>
          <text x={svgW - 4} y={svgH - 4} fontSize={7} fill="white" opacity={0.7} textAnchor="end">
            Onshore ({cableKm} km)
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 bg-bg-primary border border-border-primary rounded px-2 py-1 text-[10px] text-text-primary shadow-lg"
            style={{ left: tooltip.x + 8, top: -4 }}
          >
            <div className="font-semibold">{tooltip.point.distance_km.toFixed(1)} km</div>
            <div style={{ color: tempToColour(tooltip.point.temperature_c) }}>
              {tooltip.point.temperature_c.toFixed(1)}°C
            </div>
            <div className="text-text-muted">{tooltip.point.loading_percent.toFixed(0)}% rated</div>
            {tooltip.point.is_hotspot && (
              <div className="text-status-alarm">⚠ hotspot</div>
            )}
          </div>
        )}
      </div>

      {/* Distance scale */}
      <div className="flex justify-between text-[9px] text-text-muted font-mono px-0">
        {[0, 9, 18, 27, 36, 45].map((km) => (
          <span key={km}>{km} km</span>
        ))}
      </div>

      {/* Hot-spot summary row */}
      <div className="flex items-center gap-4 text-[10px]">
        <span className="text-text-muted">
          Max temp:{" "}
          <span style={{ color: tempToColour(profile.max_temp_c) }} className="font-mono font-semibold">
            {profile.max_temp_c.toFixed(1)}°C
          </span>
          {" "}@ {profile.max_temp_location_km.toFixed(1)} km
        </span>
        <span className="text-text-muted">
          Hotspots: <span className="text-status-alarm font-semibold">{profile.hotspot_count}</span>
        </span>
        <span className="text-text-muted">
          Assessment:{" "}
          <span
            className="font-semibold"
            style={{
              color:
                profile.assessment === "NORMAL"
                  ? "#22c55e"
                  : profile.assessment === "WARNING"
                  ? "#f59e0b"
                  : "#ef4444",
            }}
          >
            {profile.assessment}
          </span>
        </span>
      </div>

      {/* IEC reference */}
      <div className="text-[9px] text-text-muted opacity-60">
        IEC 60287 thermal model · XLPE conductor max 90°C · J-tube zone factor 1.4 · Warning &gt;70°C
      </div>
    </div>
  );
}
