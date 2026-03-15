/**
 * Leaflet-based interactive wind farm map — replaces the SVG WindFarmMap.
 *
 * Uses react-leaflet with CartoDB Dark Matter tiles (matches ISA-101 dark theme).
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

  const BLADE = "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";

  const svg = `<svg width="40" height="56" viewBox="-20 -20 40 56" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <path d="M -2.5,3 L -3.5,22 L 3.5,22 L 2.5,3 Z" fill="${color}" opacity="0.6" style="transition:fill 0.6s"/>
    <line x1="-6" y1="22" x2="6" y2="22" stroke="${color}" stroke-width="2" opacity="0.5"/>
    <line x1="-4.5" y1="24" x2="4.5" y2="24" stroke="${color}" stroke-width="1" opacity="0.3"/>
    <g class="nacelle-group" style="transform-origin: 0px 0px">
      <circle cx="0" cy="2" r="3" fill="${color}" opacity="0.4"/>
      <rect x="-5" y="-2" width="10" height="4" rx="2" fill="${color}" opacity="0.85" style="transition:fill 0.6s"/>
      <circle cx="0" cy="0" r="2" fill="${color}" style="transition:fill 0.6s"/>
      <g>${rotation}
        <path d="${BLADE}" fill="${color}" opacity="0.75"/>
        <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(120 0 0)"/>
        <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(240 0 0)"/>
      </g>
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

  // Icon depends ONLY on status + selection — stable across power/wind ticks
  const icon = useMemo(
    () => createTurbineIcon(turbine?.status ?? "offline", shortId, isSelected),
    [turbine?.status, shortId, isSelected],
  );

  // Stable event handler object — prevents react-leaflet from unbinding/rebinding
  // listeners on every render (onHover/onLeave/onClick are useCallback([]) in parent)
  const eventHandlers = useMemo(() => ({
    mouseover: () => onHover(turbineId),
    mouseout: () => onLeave(),
    click: () => onClick(turbineId),
  }), [turbineId, onHover, onLeave, onClick]);

  if (!turbine) return null;

  return (
    <Marker
      position={[lat, lon]}
      icon={icon}
      eventHandlers={eventHandlers}
    >
      <Tooltip
        direction="right"
        offset={[20, 0]}
        className="leaflet-turbine-tooltip"
        permanent={false}
      >
        <div
          className="rounded-md border overflow-hidden"
          style={{
            backgroundColor: "#0f1117",
            borderColor: "#2a3040",
            minWidth: 180,
          }}
        >
          <div
            className="px-2 py-1 border-b flex items-center justify-between"
            style={{ borderColor: "#2a3040" }}
          >
            <span className="font-semibold text-xs text-[#e8eaf0]">{turbine.id}</span>
            <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: STATUS_COLOR[turbine.status] }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_COLOR[turbine.status] }} />
              {turbine.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-2 py-1.5 text-[10px]">
            <div className="flex justify-between"><span className="text-[#6b7490]">Power</span><span className="text-[#e8eaf0] font-mono tabular-nums">{turbine.powerOutputMW.toFixed(1)} MW</span></div>
            <div className="flex justify-between"><span className="text-[#6b7490]">Wind</span><span className="text-[#e8eaf0] font-mono tabular-nums">{turbine.windSpeedMs.toFixed(1)} m/s</span></div>
            <div className="flex justify-between"><span className="text-[#6b7490]">Rotor</span><span className="text-[#e8eaf0] font-mono tabular-nums">{turbine.rotorSpeedRpm.toFixed(1)} rpm</span></div>
            <div className="flex justify-between"><span className="text-[#6b7490]">Pitch</span><span className="text-[#e8eaf0] font-mono tabular-nums">{turbine.pitchAngleDeg.toFixed(1)}°</span></div>
          </div>
        </div>
      </Tooltip>
    </Marker>
  );
});

// ── OSS Marker Icon (IEC 60617 HVAC Transformer) ────────────────
function createOSSIcon(powerMW: number): L.DivIcon {
  const svg = `<svg width="64" height="78" viewBox="-32 -24 64 78" xmlns="http://www.w3.org/2000/svg">
    <!-- Label -->
    <text x="0" y="-15" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="600" font-family="Inter, sans-serif" letter-spacing="0.5">OSS</text>

    <!-- Platform deck (offshore structure) -->
    <rect x="-26" y="-8" width="52" height="28" rx="2" fill="#0d1017" stroke="#2a3040" stroke-width="1"/>

    <!-- Transformer tank body -->
    <rect x="-21" y="-4" width="42" height="20" rx="1.5" fill="#151b28" stroke="#3d4560" stroke-width="0.8"/>
    <!-- Tank top edge highlight (depth) -->
    <line x1="-20" y1="-3" x2="20" y2="-3" stroke="#283044" stroke-width="0.5"/>

    <!-- Cooling radiator fins (right side of tank) -->
    <g opacity="0.35" stroke="#4a5580" stroke-width="0.6" fill="#1a2030">
      <rect x="16" y="-1" width="3" height="2.5" rx="0.3"/>
      <rect x="16" y="2.5" width="3" height="2.5" rx="0.3"/>
      <rect x="16" y="6" width="3" height="2.5" rx="0.3"/>
      <rect x="16" y="9.5" width="3" height="2.5" rx="0.3"/>
    </g>

    <!-- HV bushing insulator (left — 66 kV) -->
    <rect x="-27" y="2" width="7" height="5" rx="1" fill="#111622" stroke="${SCADA_COLORS.VOLTAGE_66KV}" stroke-width="0.7" opacity="0.8"/>
    <line x1="-20" y1="4.5" x2="-12" y2="4.5" stroke="${SCADA_COLORS.VOLTAGE_66KV}" stroke-width="1.2" opacity="0.85"/>

    <!-- LV bushing insulator (right — 220 kV) -->
    <rect x="20" y="2" width="7" height="5" rx="1" fill="#111622" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="0.7" opacity="0.8"/>
    <line x1="12" y1="4.5" x2="20" y2="4.5" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.2" opacity="0.85"/>

    <!-- Primary winding — 66 kV (IEC circle with subtle fill) -->
    <circle cx="-4" cy="5" r="7" fill="${SCADA_COLORS.VOLTAGE_66KV}" opacity="0.06"/>
    <circle cx="-4" cy="5" r="7" fill="none" stroke="${SCADA_COLORS.VOLTAGE_66KV}" stroke-width="1.4" opacity="0.85"/>
    <!-- Polarity dot -->
    <circle cx="-4" cy="-0.5" r="1" fill="${SCADA_COLORS.VOLTAGE_66KV}" opacity="0.65"/>

    <!-- Secondary winding — 220 kV (IEC circle with subtle fill) -->
    <circle cx="4" cy="5" r="7" fill="${SCADA_COLORS.VOLTAGE_220KV}" opacity="0.06"/>
    <circle cx="4" cy="5" r="7" fill="none" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.4" opacity="0.85"/>
    <!-- Polarity dot -->
    <circle cx="4" cy="-0.5" r="1" fill="${SCADA_COLORS.VOLTAGE_220KV}" opacity="0.65"/>

    <!-- Tap changer arrow indicator -->
    <polygon points="6,10 8,10 7,12.5" fill="#64748b" opacity="0.4"/>

    <!-- Status LED (energized) -->
    <circle cx="-17" cy="-1" r="1.5" fill="${SCADA_COLORS.ENERGIZED}">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="-17" cy="-1" r="3.5" fill="${SCADA_COLORS.ENERGIZED}" opacity="0.08"/>

    <!-- Voltage rating -->
    <text x="0" y="28" text-anchor="middle" fill="#64748b" font-size="7" font-family="JetBrains Mono, monospace">66/220 kV</text>
    <!-- Power readout -->
    <text x="0" y="40" text-anchor="middle" fill="#cbd5e1" font-size="9" font-weight="600" font-family="JetBrains Mono, monospace">${powerMW.toFixed(0)} MW</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "leaflet-oss-marker",
    iconSize: [64, 78],
    iconAnchor: [32, 26],
  });
}

// ── Onshore Substation Marker Icon (IEC 60617 HVAC Transformer) ─
function createOnshoreIcon(): L.DivIcon {
  const svg = `<svg width="64" height="82" viewBox="-32 -24 64 82" xmlns="http://www.w3.org/2000/svg">
    <!-- Label -->
    <text x="0" y="-15" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="600" font-family="Inter, sans-serif" letter-spacing="0.5">Onshore</text>

    <!-- Substation fence / perimeter (dashed) -->
    <rect x="-28" y="-8" width="56" height="30" rx="2" fill="none" stroke="#3d4560" stroke-width="0.6" stroke-dasharray="4 2"/>

    <!-- Building body -->
    <rect x="-24" y="-6" width="48" height="26" rx="2" fill="#0d1017" stroke="#2a3040" stroke-width="1"/>

    <!-- Transformer tank body -->
    <rect x="-19" y="-2" width="38" height="18" rx="1.5" fill="#151b28" stroke="#3d4560" stroke-width="0.8"/>
    <!-- Tank top edge highlight (depth) -->
    <line x1="-18" y1="-1" x2="18" y2="-1" stroke="#283044" stroke-width="0.5"/>

    <!-- Cooling radiator fins (right side of tank) -->
    <g opacity="0.35" stroke="#4a5580" stroke-width="0.6" fill="#1a2030">
      <rect x="14" y="1" width="3" height="2.5" rx="0.3"/>
      <rect x="14" y="4.5" width="3" height="2.5" rx="0.3"/>
      <rect x="14" y="8" width="3" height="2.5" rx="0.3"/>
    </g>

    <!-- HV bushing insulator (left — 220 kV) -->
    <rect x="-25" y="4" width="7" height="5" rx="1" fill="#111622" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="0.7" opacity="0.8"/>
    <line x1="-18" y1="6.5" x2="-10" y2="6.5" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.2" opacity="0.85"/>

    <!-- LV bushing insulator (right — 400 kV) -->
    <rect x="18" y="4" width="7" height="5" rx="1" fill="#111622" stroke="${SCADA_COLORS.VOLTAGE_400KV}" stroke-width="0.7" opacity="0.8"/>
    <line x1="10" y1="6.5" x2="18" y2="6.5" stroke="${SCADA_COLORS.VOLTAGE_400KV}" stroke-width="1.2" opacity="0.85"/>

    <!-- Primary winding — 220 kV (IEC circle with subtle fill) -->
    <circle cx="-3" cy="7" r="6.5" fill="${SCADA_COLORS.VOLTAGE_220KV}" opacity="0.06"/>
    <circle cx="-3" cy="7" r="6.5" fill="none" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.4" opacity="0.85"/>
    <!-- Polarity dot -->
    <circle cx="-3" cy="2" r="1" fill="${SCADA_COLORS.VOLTAGE_220KV}" opacity="0.65"/>

    <!-- Secondary winding — 400 kV (IEC circle with subtle fill) -->
    <circle cx="3" cy="7" r="6.5" fill="${SCADA_COLORS.VOLTAGE_400KV}" opacity="0.06"/>
    <circle cx="3" cy="7" r="6.5" fill="none" stroke="${SCADA_COLORS.VOLTAGE_400KV}" stroke-width="1.4" opacity="0.85"/>
    <!-- Polarity dot -->
    <circle cx="3" cy="2" r="1" fill="${SCADA_COLORS.VOLTAGE_400KV}" opacity="0.65"/>

    <!-- Tap changer arrow indicator -->
    <polygon points="5,11.5 7,11.5 6,14" fill="#64748b" opacity="0.4"/>

    <!-- Status LED (energized) -->
    <circle cx="-15" cy="1" r="1.5" fill="${SCADA_COLORS.ENERGIZED}">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="-15" cy="1" r="3.5" fill="${SCADA_COLORS.ENERGIZED}" opacity="0.08"/>

    <!-- Ground symbol -->
    <g transform="translate(0, 24)" opacity="0.4" stroke="#64748b" stroke-width="0.8" fill="none">
      <line x1="0" y1="0" x2="0" y2="3"/>
      <line x1="-4" y1="3" x2="4" y2="3"/>
      <line x1="-2.5" y1="5" x2="2.5" y2="5"/>
      <line x1="-1" y1="7" x2="1" y2="7"/>
    </g>

    <!-- Voltage rating -->
    <text x="0" y="38" text-anchor="middle" fill="#64748b" font-size="7" font-family="JetBrains Mono, monospace">220/400 kV</text>
    <!-- PSE Grid label -->
    <text x="0" y="50" text-anchor="middle" fill="${SCADA_COLORS.VOLTAGE_400KV}" font-size="8" font-weight="600" font-family="Inter, sans-serif" opacity="0.85">PSE Grid</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "leaflet-onshore-marker",
    iconSize: [64, 82],
    iconAnchor: [32, 26],
  });
}

// ── Wind Direction Overlay ────────────────────────────────────────
function WindCompass() {
  const kpis = useLandingStore(selectKPIs);
  const windDirDeg = kpis.windDirectionDeg;
  const cardinals = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const windCardinal = cardinals[Math.round(windDirDeg / 22.5) % 16];

  return (
    <div className="absolute top-14 right-3 z-[1000] pointer-events-none">
      <svg width="72" height="90" viewBox="-36 -36 72 90">
        <circle cx={0} cy={0} r={32} fill="rgba(15,17,23,0.85)" stroke="#3d4560" strokeWidth={1} />
        <line x1={0} y1={-30} x2={0} y2={-24} stroke="#ef4444" strokeWidth={1.5} />
        <line x1={0} y1={30} x2={0} y2={24} stroke="#4a5568" strokeWidth={1} />
        <line x1={30} y1={0} x2={24} y2={0} stroke="#4a5568" strokeWidth={1} />
        <line x1={-30} y1={0} x2={-24} y2={0} stroke="#4a5568" strokeWidth={1} />
        <text x={0} y={-20} fill="#ef4444" fontSize={7} fontWeight="700" textAnchor="middle" dominantBaseline="middle">N</text>
        <text x={0} y={21} fill="#6b7490" fontSize={6} textAnchor="middle" dominantBaseline="middle">S</text>
        <text x={20} y={1} fill="#6b7490" fontSize={6} textAnchor="middle" dominantBaseline="middle">E</text>
        <text x={-20} y={1} fill="#6b7490" fontSize={6} textAnchor="middle" dominantBaseline="middle">W</text>
        <g transform={`rotate(${windDirDeg + 180})`}>
          <line x1={0} y1={14} x2={0} y2={-14} stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
          <polygon points="0,-17 -4,-10 4,-10" fill="#3b82f6" />
          <circle cx={0} cy={0} r={2.5} fill="#3b82f6" opacity={0.6} />
        </g>
        <text x={0} y={44} fill="#94a3b8" fontSize={8} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
          {windCardinal} {kpis.averageWindSpeedMs.toFixed(1)} m/s
        </text>
      </svg>
    </div>
  );
}

// ── Exclusion Zone Polygon (farm boundary) ────────────────────────
const EXCLUSION_ZONE: [number, number][] = [
  [54.7950, 16.3100],
  [54.7950, 16.4850],
  [54.7050, 16.4850],
  [54.7050, 16.3100],
];

// ── Array cable polylines (66 kV within each string) ──────────────
function ArrayCables() {
  const lines: { positions: [number, number][]; key: string }[] = [];

  for (const cp of STRING_COLLECTION_POINTS) {
    const stringTurbines = TURBINE_POSITIONS.filter(
      (t) => t.stringNumber === cp.stringNumber,
    );
    // Within-string cables
    for (let i = 1; i < stringTurbines.length; i++) {
      const prev = stringTurbines[i - 1];
      const curr = stringTurbines[i];
      lines.push({
        positions: [[prev.lat, prev.lon], [curr.lat, curr.lon]],
        key: `cable-${prev.id}-${curr.id}`,
      });
    }
    // String to OSS cable
    const last = stringTurbines[stringTurbines.length - 1];
    lines.push({
      positions: [[last.lat, last.lon], [OSS_GEO.lat, OSS_GEO.lon]],
      key: `string-${cp.stringNumber}-oss`,
    });
  }

  return (
    <>
      {lines.map((line) => (
        <Polyline
          key={line.key}
          positions={line.positions}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_66KV,
            weight: 1.5,
            opacity: 0.25,
            dashArray: line.key.startsWith("string") ? "6 6" : undefined,
          }}
        />
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
    map.getContainer().style.setProperty(
      "--wind-yaw",
      `${kpis.windDirectionDeg}deg`,
    );
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
    return () => { map.off("zoomend", applyZoomClass); };
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
    return () => { map.off("zoomend", onZoom); };
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
const EXPORT_CABLE_PATH: [number, number][] = EXPORT_CABLE_GEO.map((p) => [p.lat, p.lon]);
const PSE_GRID_PATH: [number, number][] = PSE_GRID_LINE_GEO.map((p) => [p.lat, p.lon]);

// ── Props ────────────────────────────────────────────────────────
interface LeafletWindFarmMapProps {
  totalPowerMW: number;
  selectedTurbineId: string | null;
  onTurbineClick: (id: string) => void;
  onOSSClick: () => void;
  onOnshoreClick: () => void;
  onCableClick: () => void;
}

// ── Main Component ──────────────────────────────────────────────
function LeafletWindFarmMapInner({
  totalPowerMW,
  selectedTurbineId,
  onTurbineClick,
  onOSSClick,
  onOnshoreClick,
  onCableClick,
}: LeafletWindFarmMapProps) {
  const ossIcon = useMemo(() => createOSSIcon(totalPowerMW), [totalPowerMW]);
  const onshoreIcon = useMemo(() => createOnshoreIcon(), []);
  const layers = useLayerStore((s) => s.layers);

  const handleTurbineHover = useCallback((_id: string) => {}, []);
  const handleTurbineLeave = useCallback(() => {}, []);

  // Stable event handler objects for non-turbine markers
  const ossHandlers = useMemo(() => ({ click: onOSSClick }), [onOSSClick]);
  const onshoreHandlers = useMemo(() => ({ click: onOnshoreClick }), [onOnshoreClick]);
  const cableHandlers = useMemo(() => ({ click: onCableClick }), [onCableClick]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border-primary shadow-lg shadow-black/20" style={{ minHeight: 450 }}>
      <MapContainer
        center={FARM_CENTER_GEO}
        zoom={FARM_DEFAULT_ZOOM}
        className="w-full h-full"
        style={{ background: "#0a1628" }}
        zoomControl={false}
        attributionControl={false}
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

        {/* CartoDB Dark Matter tiles — dark control room theme */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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

        {/* 220 kV export cable (animated via CSS) */}
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

        {/* Onshore Substation marker (z above turbines) */}
        <Marker
          position={[ONSHORE_GEO.lat, ONSHORE_GEO.lon]}
          icon={onshoreIcon}
          eventHandlers={onshoreHandlers}
          zIndexOffset={1000}
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
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-2 pointer-events-none">
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
