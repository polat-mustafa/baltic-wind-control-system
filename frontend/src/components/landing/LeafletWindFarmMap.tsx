/**
 * Leaflet-based interactive wind farm map — replaces the SVG WindFarmMap.
 *
 * Uses react-leaflet with OpenStreetMap tiles, CSS-darkened to match the ISA-101 dark theme.
 * Turbines are DivIcon markers with inline SVG, connected by 66 kV array cable
 * polylines. Export cable (220 kV) runs from OSS to onshore substation with
 * animated dash pattern. KPI ribbon overlays at top, alarm ticker at bottom.
 *
 * Geographic coordinates: centered ~54.70°N, 16.55°E (Polish Baltic EEZ).
 *
 * Detail panels are rendered by the parent (LandingPage) — OUTSIDE Leaflet's
 * DOM tree — so they are never hidden behind GPU-composited translate3d layers.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";

import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  EXPORT_CABLE_GEO,
  FARM_CENTER_GEO,
  FARM_DEFAULT_ZOOM,
  LIDAR_GEO,
  ONSHORE_GEO,
  OSS_GEO,
  PSE_GRID_LINE_GEO,
  STRING_COLLECTION_POINTS,
  TURBINE_POSITIONS,
} from "../../constants/windFarmLayout";
import {
  selectKPIs,
  selectTurbine,
  useLandingStore,
} from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";
import type { TurbineStatus } from "../../types/landing";
import { reactiveBalance } from "../../utils/landingPhysics";

import AlarmTicker from "./AlarmTicker";
import BathymetryLayer from "./BathymetryLayer";
import DayNightOverlay from "./DayNightOverlay";
import EnvironmentPanel from "./EnvironmentPanel";
import LayerControlPanel from "./LayerControlPanel";
import MapLegend from "./MapLegend";
import OceanWaveOverlay from "./OceanWaveOverlay";
import TurbineDetailOverlay from "./TurbineDetailOverlay";
import WakeEffectLayer from "./WakeEffectLayer";
import WindParticleOverlay from "./WindParticleOverlay";

// ── Atmospheric Pane (z-index between tiles and markers) ──────
// Creates a custom Leaflet pane at z-index 250 (tile-pane = 200,
// overlay-pane = 400). Overlays portaled here render ABOVE tiles
// but BELOW markers/polylines. Counter-transform keeps the pane
// viewport-fixed despite Leaflet's translate3d on map-pane.
function AtmosphericPanes() {
  const map = useMap();
  const paneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const existing = map.getPane("atmosphericPane");
    if (existing) {
      paneRef.current = existing;
      return;
    }
    const pane = map.createPane("atmosphericPane");
    pane.style.zIndex = "250";
    pane.style.pointerEvents = "none";
    paneRef.current = pane;

    // Counter-transform: undo map-pane translate3d so overlays
    // stay viewport-fixed (fullscreen tints, particle canvas, etc.)
    // RAF guard coalesces multiple same-frame events (move+zoom during
    // pan/pinch gestures) into a single style recalculation per frame.
    let rafPending = false;
    function syncTransform() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const mapPane = map.getPanes().mapPane;
        if (!mapPane || !paneRef.current) return;
        const pos = L.DomUtil.getPosition(mapPane);
        paneRef.current.style.transform = `translate3d(${-pos.x}px, ${-pos.y}px, 0)`;
      });
    }
    syncTransform();
    map.on("move", syncTransform);
    map.on("moveend", syncTransform);
    map.on("zoom", syncTransform);
    map.on("zoomend", syncTransform);

    return () => {
      map.off("move", syncTransform);
      map.off("moveend", syncTransform);
      map.off("zoom", syncTransform);
      map.off("zoomend", syncTransform);
    };
  }, [map]);

  return null;
}

// ── Status Colors ──────────────────────────────────────────────
const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: SCADA_COLORS.ENERGIZED,
  curtailed: SCADA_COLORS.WARNING,
  fault: SCADA_COLORS.FAULT,
  offline: SCADA_COLORS.DE_ENERGIZED,
};

// ── Turbine DivIcon factory ────────────────────────────────────
// Representative power per status so icon reference is stable across 3s ticks.
// Real-time power is shown in the tooltip — icon only changes on status change.
const REPRESENTATIVE_POWER: Record<TurbineStatus, number> = {
  operating: 12,
  curtailed: 8,
  fault: 0,
  offline: 0,
};

function createTurbineIcon(
  status: TurbineStatus,
  shortId: string,
  isSelected: boolean,
  yawDeg: number,
  pitchDeg: number,
): L.DivIcon {
  const color = STATUS_COLOR[status];
  const powerMW = REPRESENTATIVE_POWER[status];
  const isSpinning = status === "operating" || status === "curtailed";
  const dur = powerMW <= 0 ? 0 : Math.max(2, 8 - (powerMW / 15) * 6);
  const fraction = Math.min(powerMW / 15, 1);
  const rotation = isSpinning
    ? `<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="${dur.toFixed(1)}s" repeatCount="indefinite" />`
    : "";
  const glow =
    status === "fault"
      ? `<circle cx="0" cy="0" r="8" fill="${color}" opacity="0.15"><animate attributeName="opacity" values="0.15;0.3;0.15" dur="1.5s" repeatCount="indefinite" /></circle>`
      : status === "operating"
        ? `<circle cx="0" cy="0" r="6" fill="${color}" opacity="0.08"><animate attributeName="opacity" values="0.05;0.18;0.05" dur="3s" repeatCount="indefinite" /></circle>`
        : "";

  const BLADE =
    "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";

  // Yaw compass — faint dashed ring + N-arrow rotated to nacelle yaw
  const yawCompass = `
    <g opacity="0.4">
      <circle cx="0" cy="0" r="13" fill="none" stroke="#94a3b8" stroke-width="0.4" stroke-dasharray="1.2 2"/>
      <g transform="rotate(${yawDeg} 0 0)">
        <path d="M 0,-13 L -1.6,-10.5 L 1.6,-10.5 Z" fill="#cbd5e1"/>
      </g>
    </g>`;

  // Pitch arc — small yellow arc near hub, sweeps from 12 o'clock by pitchDeg
  const pitchClamp = Math.max(0, Math.min(90, pitchDeg));
  const arcRad = ((pitchClamp - 90) * Math.PI) / 180;
  const arcEndX = (8 * Math.cos(arcRad)).toFixed(2);
  const arcEndY = (8 * Math.sin(arcRad)).toFixed(2);
  const pitchArc =
    isSpinning && pitchClamp > 0.5
      ? `<path d="M 0,-8 A 8,8 0 0 1 ${arcEndX},${arcEndY}" fill="none" stroke="#fbbf24" stroke-width="0.9" opacity="0.85"/>`
      : "";

  const svg = `<svg width="40" height="56" viewBox="-20 -20 40 56" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    ${yawCompass}
    <path d="M -2.5,3 L -3.5,22 L 3.5,22 L 2.5,3 Z" fill="${color}" opacity="0.6" style="transition:fill 0.6s"/>
    <line x1="-6" y1="22" x2="6" y2="22" stroke="${color}" stroke-width="2" opacity="0.5"/>
    <line x1="-4.5" y1="24" x2="4.5" y2="24" stroke="${color}" stroke-width="1" opacity="0.3"/>
    <g class="nacelle-group" style="transform-origin: 0px 0px" transform="rotate(${(yawDeg - 90).toFixed(0)} 0 0)">
      <circle cx="0" cy="2" r="3" fill="${color}" opacity="0.4"/>
      <rect x="-5" y="-2" width="10" height="4" rx="2" fill="${color}" opacity="0.85" style="transition:fill 0.6s"/>
    </g>
    ${pitchArc}
    <circle cx="0" cy="0" r="2" fill="${color}" style="transition:fill 0.6s"/>
    <g>${rotation}
      <path d="${BLADE}" fill="${color}" opacity="0.75"/>
      <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(120 0 0)"/>
      <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(240 0 0)"/>
    </g>
    <rect x="-5" y="26" width="10" height="2" rx="0.5" fill="#1e2231" stroke="${color}" stroke-width="0.3" opacity="0.5"/>
    ${fraction > 0 ? `<rect x="-5" y="26" width="${(10 * fraction).toFixed(1)}" height="2" rx="0.5" fill="${color}" opacity="0.6"/>` : ""}
    <text x="0" y="34" fill="#6b7490" font-size="6" font-family="JetBrains Mono, monospace" text-anchor="middle">${shortId}</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: `leaflet-turbine-marker${isSelected ? " turbine-selected" : ""}`,
    iconSize: [40, 56],
    iconAnchor: [20, 20],
  });
}

// ── Single Turbine Marker (connected to store) ─────────────────
// Icon is keyed ONLY on status + isSelected — never on power/wind.
// This keeps the L.DivIcon reference stable across 3s ticks so
// react-leaflet never calls setIcon() → DOM element survives →
// SVG animations keep spinning, CSS hover persists, click works.
// Real-time power/wind values are shown in the Tooltip (React-managed).
const TurbineMarker = memo(function TurbineMarker({
  turbineId,
  lat,
  lon,
  isSelected,
  onHover,
  onLeave,
  onClick,
}: {
  turbineId: string;
  lat: number;
  lon: number;
  isSelected: boolean;
  onHover: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const shortId = turbineId.replace(/^WTG-/, "");

  // Icon depends on status + selection + quantised yaw/pitch.
  // Yaw is quantised to 5° steps so the icon doesn't recreate on every 0.1°
  // wiggle from the yaw controller; pitch to 1° integer for the same reason.
  const yawQ = Math.round((turbine?.nacellePositionDeg ?? 225) / 5) * 5;
  const pitchQ = Math.round(turbine?.pitchAngleDeg ?? 0);
  const icon = useMemo(
    () =>
      createTurbineIcon(
        turbine?.status ?? "offline",
        shortId,
        isSelected,
        yawQ,
        pitchQ,
      ),
    [turbine?.status, shortId, isSelected, yawQ, pitchQ],
  );

  // Stable event handler object — prevents react-leaflet from unbinding/rebinding
  // listeners on every render (onHover/onLeave/onClick are useCallback([]) in parent)
  const eventHandlers = useMemo(
    () => ({
      mouseover: () => onHover(turbineId),
      mouseout: () => onLeave(),
      click: () => onClick(turbineId),
    }),
    [turbineId, onHover, onLeave, onClick],
  );

  if (!turbine) return null;

  return (
    <Marker position={[lat, lon]} icon={icon} eventHandlers={eventHandlers}>
      <Tooltip
        direction="right"
        offset={[20, 0]}
        className="leaflet-turbine-tooltip"
        permanent={false}
      >
        <div
          className="rounded-md border border-border-primary bg-bg-primary overflow-hidden"
          style={{ minWidth: 180 }}
        >
          <div className="px-2 py-1 border-b border-border-primary flex items-center justify-between">
            <span className="font-semibold text-xs text-text-primary">
              {turbine.id}
            </span>
            <span
              className="flex items-center gap-1 text-[10px] font-medium"
              style={{ color: STATUS_COLOR[turbine.status] }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ backgroundColor: STATUS_COLOR[turbine.status] }}
              />
              {turbine.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-2 py-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-text-muted">Power</span>
              <span className="text-text-primary font-mono tabular-nums">
                {turbine.powerOutputMW.toFixed(1)} MW
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Wind</span>
              <span className="text-text-primary font-mono tabular-nums">
                {turbine.windSpeedMs.toFixed(1)} m/s
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Rotor</span>
              <span className="text-text-primary font-mono tabular-nums">
                {turbine.rotorSpeedRpm.toFixed(1)} rpm
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Pitch</span>
              <span className="text-text-primary font-mono tabular-nums">
                {turbine.pitchAngleDeg.toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
});

// ── Equipment chip markers (OSS, STATCOM, LIDAR, onshore, switchyard) ──
// One visual grammar for all plant: a 24 px IEC-style glyph pinned on the
// geographic point + a label chip (tag / live value) to its right. HTML text
// (not scaled SVG) keeps labels crisp at ≥ 9.5 px. Styles: `.eq-marker` in
// index.css. Details live in the panels that open on click.
const EQ_GREEN = "#3ecf6e";
const EQ_INJECT = "#f5a623";
const EQ_ABSORB = "#4FC3D8";
const EQ_IDLE = "#9ba3b8";

/** Two-winding transformer (IEC 60617): LV circle left, HV circle right. */
const transformerGlyph = (lv: string, hv: string) =>
  `<svg width="18" height="14" viewBox="0 0 18 14"><circle cx="6.5" cy="7" r="5" fill="none" stroke="${lv}" stroke-width="1.6"/><circle cx="11.5" cy="7" r="5" fill="none" stroke="${hv}" stroke-width="1.6"/></svg>`;

/** Static converter (IEC 60617): box, diagonal, AC ~ top-left, DC = bottom-right. */
const converterGlyph = (c: string) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${c}" stroke-width="1.4"><rect x="1" y="1" width="14" height="14" rx="1.5"/><path d="M1 15 15 1"/><path d="M3 5.5q1-2 2 0t2 0" /><path d="M9 10.5h4M9 12.5h4"/></svg>`;

/** Buoy with a conical scan. */
const lidarGlyph = (c: string) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"><path d="M8 9 3.5 2M8 9l4.5-7" stroke-dasharray="2 1.6"/><path d="M8 9v3"/><path d="M3.5 12.5h9" stroke-width="2"/></svg>`;

/** Circuit breaker on a busbar: filled = closed, hollow = open. */
const breakerGlyph = (c: string, closed: boolean) =>
  `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${c}" stroke-width="1.4"><path d="M1 8h4M11 8h4"/><rect x="5" y="5" width="6" height="6" fill="${closed ? c : "none"}"/></svg>`;

function createEquipmentIcon(opts: {
  glyph: string;
  tag: string;
  value: string;
  sub?: string;
  color: string;
  live?: boolean;
}): L.DivIcon {
  const html = `<div class="eq-marker" style="--eq-color:${opts.color}">
    <span class="eq-marker__glyph${opts.live ? " is-live" : ""}">${opts.glyph}</span>
    <span class="eq-marker__body">
      <span class="eq-marker__tag">${opts.tag}</span>
      <span class="eq-marker__value">${opts.value}${opts.sub ? `<span class="eq-marker__sub">${opts.sub}</span>` : ""}</span>
    </span>
  </div>`;
  return L.divIcon({ html, className: "leaflet-eq-marker", iconSize: [24, 24], iconAnchor: [12, 12] });
}

const STATCOM_CHIP_GEO: [number, number] = [OSS_GEO.lat + 0.025, OSS_GEO.lon + 0.04];

function createOSSIcon(powerMW: number): L.DivIcon {
  return createEquipmentIcon({
    glyph: transformerGlyph(SCADA_COLORS.VOLTAGE_66KV, SCADA_COLORS.VOLTAGE_220KV),
    tag: "OSS · 66/220 kV",
    value: `${powerMW.toFixed(0)} MW`,
    sub: "2 × 300 MVA",
    color: EQ_GREEN,
  });
}

function createOnshoreIcon(): L.DivIcon {
  return createEquipmentIcon({
    glyph: transformerGlyph(SCADA_COLORS.VOLTAGE_220KV, SCADA_COLORS.VOLTAGE_400KV),
    tag: "Onshore · 220/400 kV",
    value: "2 × 300 MVA",
    color: EQ_GREEN,
  });
}

function createGridSwitchyardIcon(breakerClosed: boolean): L.DivIcon {
  const color = breakerClosed ? EQ_GREEN : EQ_IDLE;
  return createEquipmentIcon({
    glyph: breakerGlyph(color, breakerClosed),
    tag: "PSE · 400 kV",
    value: breakerClosed ? "CB closed" : "CB open",
    color,
  });
}

/** Q sign convention (rule 4): + injecting (capacitive), − absorbing (inductive). */
function createSTATCOMIcon(qMVAR: number): L.DivIcon {
  const color = qMVAR > 5 ? EQ_INJECT : qMVAR < -5 ? EQ_ABSORB : EQ_IDLE;
  const sign = qMVAR > 0 ? "+" : qMVAR < 0 ? "−" : "";
  return createEquipmentIcon({
    glyph: converterGlyph(color),
    tag: "STATCOM",
    value: `${sign}${Math.abs(qMVAR).toFixed(0)} MVAr`,
    sub: qMVAR > 5 ? "inject" : qMVAR < -5 ? "absorb" : "float",
    color,
  });
}

function createMetMastIcon(windMs: number, windDirDeg: number): L.DivIcon {
  return createEquipmentIcon({
    glyph: lidarGlyph(EQ_ABSORB),
    tag: "LIDAR MM-01",
    value: `${windMs.toFixed(1)} m/s`,
    sub: `${windDirDeg.toFixed(0)}°`,
    color: EQ_ABSORB,
    live: true,
  });
}

// ── Wind Direction Overlay ────────────────────────────────────────
function WindCompass() {
  const kpis = useLandingStore(selectKPIs);
  const windDirDeg = kpis.windDirectionDeg;
  const cardinals = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const windCardinal = cardinals[Math.round(windDirDeg / 22.5) % 16];

  return (
    <div className="absolute top-14 right-3 z-1000 pointer-events-none">
      <svg width="72" height="90" viewBox="-36 -36 72 90">
        <circle
          cx={0}
          cy={0}
          r={32}
          fill="rgba(15,17,23,0.85)"
          stroke="#3d4560"
          strokeWidth={1}
        />
        <line
          x1={0}
          y1={-30}
          x2={0}
          y2={-24}
          stroke="#ef4444"
          strokeWidth={1.5}
        />
        <line x1={0} y1={30} x2={0} y2={24} stroke="#4a5568" strokeWidth={1} />
        <line x1={30} y1={0} x2={24} y2={0} stroke="#4a5568" strokeWidth={1} />
        <line
          x1={-30}
          y1={0}
          x2={-24}
          y2={0}
          stroke="#4a5568"
          strokeWidth={1}
        />
        <text
          x={0}
          y={-20}
          fill="#ef4444"
          fontSize={7}
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          N
        </text>
        <text
          x={0}
          y={21}
          fill="#6b7490"
          fontSize={6}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          S
        </text>
        <text
          x={20}
          y={1}
          fill="#6b7490"
          fontSize={6}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          E
        </text>
        <text
          x={-20}
          y={1}
          fill="#6b7490"
          fontSize={6}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          W
        </text>
        <g transform={`rotate(${windDirDeg + 180})`}>
          <line
            x1={0}
            y1={14}
            x2={0}
            y2={-14}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinecap="round"
          />
          <polygon points="0,-17 -4,-10 4,-10" fill="#3b82f6" />
          <circle cx={0} cy={0} r={2.5} fill="#3b82f6" opacity={0.6} />
        </g>
        <text
          x={0}
          y={44}
          fill="#94a3b8"
          fontSize={8}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
        >
          {windCardinal} {kpis.averageWindSpeedMs.toFixed(1)} m/s
        </text>
      </svg>
    </div>
  );
}

// ── Exclusion Zone Polygon (farm boundary) ────────────────────────
const EXCLUSION_ZONE: [number, number][] = [
  [54.795, 16.31],
  [54.795, 16.485],
  [54.705, 16.485],
  [54.705, 16.31],
];

// ── Array cable polylines (66 kV within each string) ──────────────
// Each cable carries the cumulative power of the upstream turbines on its
// string. We colour-code by load fraction relative to the cable's continuous
// rating (3×1×400 mm² Cu XLPE 66 kV ≈ 105 MVA), per IEC 60287:
//   <60% rating  → green (idle / light)
//   60–85%       → amber (normal-heavy)
//   >85%         → red   (overload risk)
const CABLE_RATING_MVA = 105;
const FULL_TURBINE_MW = 15.0;

function loadColor(loadFrac: number): string {
  if (loadFrac < 0.6) return "#3ecf6e";
  if (loadFrac < 0.85) return "#f5a623";
  return "#ef4444";
}

function ArrayCables() {
  // Compute per-cable load: each segment carries the sum of all turbines
  // downstream on the string (between this segment and the OSS).
  const lines: {
    positions: [number, number][];
    key: string;
    loadFrac: number;
    cumMW: number;
    isCollector: boolean;
  }[] = [];

  for (const cp of STRING_COLLECTION_POINTS) {
    const stringTurbines = TURBINE_POSITIONS.filter(
      (t) => t.stringNumber === cp.stringNumber,
    );
    const stringLength = stringTurbines.length;
    // Within-string cables — segment i carries turbines [0..i-1] toward OSS.
    // Segment direction: prev → curr, but power flows from turbines toward
    // the collection point at the FAR end of the string. So segment between
    // station k and k+1 carries power from all stations <= k that drain
    // toward the OSS-side end (assume turbines numbered 0..N-1, OSS at end).
    for (let i = 1; i < stringLength; i++) {
      const prev = stringTurbines[i - 1];
      const curr = stringTurbines[i];
      // Power carried = sum of all turbines from index 0..i-1 (those upstream)
      const cumMW = i * FULL_TURBINE_MW * 0.78; // typical 78% capacity factor
      const loadFrac = cumMW / CABLE_RATING_MVA;
      lines.push({
        positions: [
          [prev.lat, prev.lon],
          [curr.lat, curr.lon],
        ],
        key: `cable-${prev.id}-${curr.id}`,
        loadFrac,
        cumMW,
        isCollector: false,
      });
    }
    // String → OSS cable carries the entire string's power.
    const last = stringTurbines[stringTurbines.length - 1];
    const stringTotalMW = stringLength * FULL_TURBINE_MW * 0.78;
    lines.push({
      positions: [
        [last.lat, last.lon],
        [OSS_GEO.lat, OSS_GEO.lon],
      ],
      key: `string-${cp.stringNumber}-oss`,
      loadFrac: stringTotalMW / CABLE_RATING_MVA,
      cumMW: stringTotalMW,
      isCollector: true,
    });
  }

  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={line.key}
          positions={line.positions}
          pathOptions={{
            color: loadColor(line.loadFrac),
            weight: line.isCollector ? 2.4 : 1.6,
            opacity: 0.55 + Math.min(line.loadFrac, 0.35),
            dashArray: line.isCollector ? "6 6" : undefined,
          }}
        >
          <Tooltip
            direction="top"
            sticky
            offset={[0, -2]}
            className="leaflet-cable-tooltip"
          >
            <div className="text-[10px] font-mono text-text-secondary">
              <div
                className="font-bold mb-0.5"
                style={{ color: loadColor(line.loadFrac) }}
              >
                {line.cumMW.toFixed(1)} MW · {(line.loadFrac * 100).toFixed(0)}%
              </div>
              <div className="text-text-muted">
                {line.isCollector ? "String → OSS" : "Inter-WTG"}
              </div>
              <div className="text-text-muted">3×1×400mm² Cu · 66 kV</div>
            </div>
          </Tooltip>
        </Polyline>
      ))}
    </>
  );
}

// ── Invalidate size on mount (fires once, not every render) ──────
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// ── Turbine label visibility (CSS class toggle on container) ─────
function TurbineLabelToggler() {
  const map = useMap();
  const show = useLayerStore((s) => s.layers.turbineLabels);

  useEffect(() => {
    const el = map.getContainer();
    if (show) el.classList.remove("hide-turbine-labels");
    else el.classList.add("hide-turbine-labels");
  }, [map, show]);

  return null;
}

// ── Yaw rotation — sets CSS custom property for nacelle orientation ──
function YawUpdater() {
  const map = useMap();
  const kpis = useLandingStore(selectKPIs);

  useEffect(() => {
    map
      .getContainer()
      .style.setProperty("--wind-yaw", `${kpis.windDirectionDeg}deg`);
  }, [map, kpis.windDirectionDeg]);

  return null;
}

// ── Zoom-dependent turbine scale — toggles CSS classes on the map container ──
// Uses the same DOM class toggle pattern as TurbineLabelToggler.
// CSS rules in index.css handle SVG-level transform to avoid Leaflet conflicts.
const ZOOM_FAR_CLASS = "turbine-zoom-far";
const ZOOM_CLOSE_CLASS = "turbine-zoom-close";

function TurbineZoomScaler() {
  const map = useMap();

  useEffect(() => {
    function applyZoomClass() {
      const z = map.getZoom();
      const el = map.getContainer();
      // zoom < 11 → far (small), 11-12 → default, ≥ 13 → close (big)
      el.classList.toggle(ZOOM_FAR_CLASS, z < 11);
      el.classList.toggle(ZOOM_CLOSE_CLASS, z >= 13);
    }
    applyZoomClass();
    map.on("zoomend", applyZoomClass);
    return () => {
      map.off("zoomend", applyZoomClass);
    };
  }, [map]);

  return null;
}

// ── Foundation circles visible at high zoom (monopile outline) ───
function FoundationLayer() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  if (zoom < 14) return null;

  return (
    <>
      {TURBINE_POSITIONS.map((pos) => (
        <CircleMarker
          key={`foundation-${pos.id}`}
          center={[pos.lat, pos.lon]}
          radius={8}
          pathOptions={{
            color: "#4a5580",
            weight: 1.5,
            fillColor: "#1e2231",
            fillOpacity: 0.6,
            interactive: false,
          }}
        />
      ))}
    </>
  );
}

// ── Static polyline paths (derived from constants, never change) ─
const EXPORT_CABLE_PATH: [number, number][] = EXPORT_CABLE_GEO.map((p) => [
  p.lat,
  p.lon,
]);
const PSE_GRID_PATH: [number, number][] = PSE_GRID_LINE_GEO.map((p) => [
  p.lat,
  p.lon,
]);

// ── Props ────────────────────────────────────────────────────────
interface LeafletWindFarmMapProps {
  totalPowerMW: number;
  selectedTurbineId: string | null;
  onTurbineClick: (id: string) => void;
  onOSSClick: () => void;
  onOnshoreClick: () => void;
  onCableClick: () => void;
  onSTATCOMClick?: () => void;
  onLIDARClick?: () => void;
}

// ── Main Component ──────────────────────────────────────────────
function LeafletWindFarmMapInner({
  totalPowerMW,
  selectedTurbineId,
  onTurbineClick,
  onOSSClick,
  onOnshoreClick,
  onCableClick,
  onSTATCOMClick,
  onLIDARClick,
}: LeafletWindFarmMapProps) {
  const ossIcon = useMemo(() => createOSSIcon(totalPowerMW), [totalPowerMW]);
  const onshoreIcon = useMemo(() => createOnshoreIcon(), []);
  // STATCOM Q closes the OSS reactive balance (utils/landingPhysics).
  // Rounded to 1 MVAr, the same as the KPI ribbon and the panel.
  const statcomQ = Math.round(reactiveBalance(totalPowerMW).statcomMVAr);
  const statcomIcon = useMemo(() => createSTATCOMIcon(statcomQ), [statcomQ]);
  // Grid switchyard breaker is closed whenever the farm is exporting power.
  const isExporting = totalPowerMW > 0.5;
  const switchyardIcon = useMemo(
    () => createGridSwitchyardIcon(isExporting),
    [isExporting],
  );
  // Floating LIDAR met mast — independent wind reference for resource validation.
  // Reads farm-level wind from the KPI stream (quantised so the icon is stable).
  const farmKpis = useLandingStore(selectKPIs);
  const lidarWindMs = Math.round(farmKpis.averageWindSpeedMs * 10) / 10;
  const lidarWindDir = Math.round(farmKpis.windDirectionDeg / 5) * 5;
  const metMastIcon = useMemo(
    () => createMetMastIcon(lidarWindMs, lidarWindDir),
    [lidarWindMs, lidarWindDir],
  );
  const layers = useLayerStore((s) => s.layers);

  const handleTurbineHover = useCallback((_id: string) => {}, []);
  const handleTurbineLeave = useCallback(() => {}, []);

  // Stable event handler objects for non-turbine markers
  const ossHandlers = useMemo(() => ({ click: onOSSClick }), [onOSSClick]);
  const onshoreHandlers = useMemo(
    () => ({ click: onOnshoreClick }),
    [onOnshoreClick],
  );
  const cableHandlers = useMemo(
    () => ({ click: onCableClick }),
    [onCableClick],
  );
  const statcomHandlers = useMemo(
    () => (onSTATCOMClick ? { click: onSTATCOMClick } : {}),
    [onSTATCOMClick],
  );
  const metMastHandlers = useMemo(
    () => (onLIDARClick ? { click: onLIDARClick } : {}),
    [onLIDARClick],
  );

  return (
    <div
      className="relative w-full h-full rounded-lg overflow-hidden border border-border-primary shadow-lg shadow-black/20"
      style={{ minHeight: 450 }}
    >
      <MapContainer
        center={FARM_CENTER_GEO}
        zoom={FARM_DEFAULT_ZOOM}
        className="w-full h-full"
        style={{ background: "#0a1628" }}
        zoomControl={false}
      >
        <InvalidateSize />

        {/* Custom pane for atmospheric overlays (z: 250, between tiles and markers) */}
        <AtmosphericPanes />

        {/* Ocean wave texture (Canvas-animated sine wave crests) */}
        {layers.oceanWaves && <OceanWaveOverlay />}

        {/* Day/night tint (compressed 24h cycle) */}
        {layers.dayNightTint && <DayNightOverlay />}

        {/* Wind particle animation (Windy.com style) */}
        {layers.windParticles && <WindParticleOverlay />}

        {/* OpenStreetMap tiles (free, no API key), darkened via CSS filter
            (.osm-dark-tiles) for the control room theme. ODbL requires the
            attribution. ponytail: OSM's public tile server is for light use;
            self-host or switch to OpenFreeMap vector tiles if traffic grows. */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="osm-dark-tiles"
          maxZoom={19}
        />

        {/* Exclusion zone boundary */}
        {layers.exclusionZone && (
          <Polygon
            positions={EXCLUSION_ZONE}
            pathOptions={{
              color: "rgba(59,130,246,0.4)",
              weight: 1.5,
              dashArray: "10 5",
              fillColor: "rgba(59,130,246,0.03)",
              fillOpacity: 1,
            }}
          />
        )}

        {/* Bathymetry contour lines (isobaths) */}
        {layers.bathymetry && <BathymetryLayer />}

        {/* Jensen/Park wake effect cones + loss badges */}
        {layers.wakeEffects && <WakeEffectLayer />}

        {/* 66 kV array cables */}
        {layers.arrayCables && <ArrayCables />}

        {/* 2 × 220 kV export cables, drawn as one route (animated via CSS) */}
        <Polyline
          positions={EXPORT_CABLE_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 4,
            opacity: 0.3,
          }}
        />
        <Polyline
          positions={EXPORT_CABLE_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 3,
            opacity: 0.9,
            dashArray: "8 12",
            className: "leaflet-export-cable-animated",
          }}
          eventHandlers={cableHandlers}
        />

        {/* PSE grid connection line */}
        <Polyline
          positions={PSE_GRID_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_400KV,
            weight: 3,
            opacity: 0.7,
          }}
        />

        {/* Offshore Substation marker (z above turbines) */}
        <Marker
          position={[OSS_GEO.lat, OSS_GEO.lon]}
          icon={ossIcon}
          eventHandlers={ossHandlers}
          zIndexOffset={1000}
        />

        {/* STATCOM marker — ±120 MVAr on the OSS 220 kV busbar. Drawn offset
            northeast so its chip clears the OSS label; the leader line shows
            it is the same platform. */}
        <Polyline
          positions={[[OSS_GEO.lat, OSS_GEO.lon], STATCOM_CHIP_GEO]}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 1.5,
            opacity: 0.8,
            dashArray: "3 4",
            interactive: false,
          }}
        />
        <Marker
          position={STATCOM_CHIP_GEO}
          icon={statcomIcon}
          eventHandlers={statcomHandlers}
          zIndexOffset={950}
        />

        {/* Onshore Substation marker (z above turbines) */}
        <Marker
          position={[ONSHORE_GEO.lat, ONSHORE_GEO.lon]}
          icon={onshoreIcon}
          eventHandlers={onshoreHandlers}
          zIndexOffset={1000}
        />

        {/* Grid switchyard marker — between onshore SS and PSE Grid label */}
        <Marker
          position={[ONSHORE_GEO.lat - 0.012, ONSHORE_GEO.lon + 0.085]}
          icon={switchyardIcon}
          zIndexOffset={950}
        />

        {/* Floating LIDAR met mast — placed in clear water northwest of the
            turbine array, outside the marker swarm and turbine wake field.
            zIndex above turbines so it remains discoverable.
            Provides independent wind validation per IEC 61400-12-1. */}
        <Marker
          position={[LIDAR_GEO.lat, LIDAR_GEO.lon]}
          icon={metMastIcon}
          eventHandlers={metMastHandlers}
          zIndexOffset={1100}
        />

        {/* Yaw rotation — updates CSS custom property on map container */}
        <YawUpdater />

        {/* Turbine label visibility (CSS class toggle) */}
        <TurbineLabelToggler />

        {/* Zoom-dependent turbine scaling (CSS class toggle on container) */}
        <TurbineZoomScaler />

        {/* Monopile foundation circles (zoom ≥ 14) */}
        {layers.foundations && <FoundationLayer />}

        {/* Zoom-dependent turbine detail (power labels, pitch arcs, sway) */}
        <TurbineDetailOverlay />

        {/* Turbine markers */}
        {TURBINE_POSITIONS.map((pos) => (
          <TurbineMarker
            key={pos.id}
            turbineId={pos.id}
            lat={pos.lat}
            lon={pos.lon}
            isSelected={selectedTurbineId === pos.id}
            onHover={handleTurbineHover}
            onLeave={handleTurbineLeave}
            onClick={onTurbineClick}
          />
        ))}
      </MapContainer>

      {/* Layer control panel */}
      <LayerControlPanel />

      {/* Bottom-left panels (flex column to prevent overlap) */}
      <div className="absolute bottom-3 left-3 z-1000 flex flex-col gap-2 pointer-events-none">
        <EnvironmentPanel />
        <MapLegend />
        <AlarmTicker />
      </div>

      {/* Compass overlay */}
      <WindCompass />
    </div>
  );
}

export default memo(LeafletWindFarmMapInner);
