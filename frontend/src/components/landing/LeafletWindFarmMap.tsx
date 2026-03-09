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

import { memo, useCallback, useEffect, useMemo } from "react";
import {
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
import type { TurbineStatus } from "../../types/landing";

import AlarmTicker from "./AlarmTicker";
import MapLegend from "./MapLegend";

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
        ? `<circle cx="0" cy="0" r="6" fill="${color}" opacity="0.08" />`
        : "";

  const BLADE = "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";

  const svg = `<svg width="40" height="56" viewBox="-20 -20 40 56" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <path d="M -1.5,3 L -2.5,20 L 2.5,20 L 1.5,3 Z" fill="${color}" opacity="0.5" style="transition:fill 0.6s"/>
    <line x1="-4" y1="20" x2="4" y2="20" stroke="${color}" stroke-width="1.5" opacity="0.4"/>
    <rect x="-4" y="-2" width="8" height="4" rx="1.5" fill="${color}" opacity="0.85" style="transition:fill 0.6s"/>
    <circle cx="0" cy="0" r="2" fill="${color}" style="transition:fill 0.6s"/>
    <g>${rotation}
      <path d="${BLADE}" fill="${color}" opacity="0.75"/>
      <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(120 0 0)"/>
      <path d="${BLADE}" fill="${color}" opacity="0.75" transform="rotate(240 0 0)"/>
    </g>
    <rect x="-5" y="22" width="10" height="2" rx="0.5" fill="#1e2231" stroke="${color}" stroke-width="0.3" opacity="0.5"/>
    ${fraction > 0 ? `<rect x="-5" y="22" width="${(10 * fraction).toFixed(1)}" height="2" rx="0.5" fill="${color}" opacity="0.6"/>` : ""}
    <text x="0" y="30" fill="#6b7490" font-size="6" font-family="JetBrains Mono, monospace" text-anchor="middle">${shortId}</text>
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

// ── OSS Marker Icon ──────────────────────────────────────────────
function createOSSIcon(powerMW: number): L.DivIcon {
  const svg = `<svg width="56" height="70" viewBox="-28 -20 56 70" xmlns="http://www.w3.org/2000/svg">
    <rect x="-20" y="-16" width="40" height="32" rx="3" fill="#1e293b" stroke="${SCADA_COLORS.ENERGIZED}" stroke-width="2"/>
    <circle cx="-5" cy="0" r="8" fill="none" stroke="${SCADA_COLORS.VOLTAGE_66KV}" stroke-width="1.5"/>
    <circle cx="5" cy="0" r="8" fill="none" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.5"/>
    <text x="0" y="-22" text-anchor="middle" fill="${SCADA_COLORS.ENERGIZED}" font-size="10" font-weight="bold" font-family="Inter, sans-serif">OSS</text>
    <text x="0" y="28" text-anchor="middle" fill="#94a3b8" font-size="7" font-family="JetBrains Mono, monospace">66/220 kV</text>
    <text x="0" y="40" text-anchor="middle" fill="#e2e8f0" font-size="8" font-weight="bold" font-family="JetBrains Mono, monospace">${powerMW.toFixed(0)} MW</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "leaflet-oss-marker",
    iconSize: [56, 70],
    iconAnchor: [28, 20],
  });
}

// ── Onshore Substation Marker Icon ───────────────────────────────
function createOnshoreIcon(): L.DivIcon {
  const svg = `<svg width="60" height="70" viewBox="-30 -24 60 70" xmlns="http://www.w3.org/2000/svg">
    <rect x="-22" y="-18" width="44" height="36" rx="3" fill="#1e293b" stroke="${SCADA_COLORS.VOLTAGE_400KV}" stroke-width="2"/>
    <circle cx="-6" cy="0" r="8" fill="none" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.5"/>
    <circle cx="6" cy="0" r="8" fill="none" stroke="${SCADA_COLORS.VOLTAGE_400KV}" stroke-width="1.5"/>
    <text x="0" y="-24" text-anchor="middle" fill="${SCADA_COLORS.VOLTAGE_400KV}" font-size="9" font-weight="bold" font-family="Inter, sans-serif">Onshore SS</text>
    <text x="0" y="28" text-anchor="middle" fill="#94a3b8" font-size="7" font-family="JetBrains Mono, monospace">220/400 kV</text>
    <text x="24" y="4" fill="${SCADA_COLORS.VOLTAGE_400KV}" font-size="8" font-weight="bold" font-family="Inter, sans-serif">PSE</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "leaflet-onshore-marker",
    iconSize: [60, 70],
    iconAnchor: [30, 24],
  });
}

// ── Wind Direction Overlay ────────────────────────────────────────
function WindCompass() {
  const kpis = useLandingStore(selectKPIs);
  const windDirDeg = kpis.windDirectionDeg;
  const cardinals = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const windCardinal = cardinals[Math.round(windDirDeg / 22.5) % 16];

  return (
    <div className="absolute top-3 right-3 z-[1000] pointer-events-none">
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

        {/* CartoDB Dark Matter tiles — dark control room theme */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Exclusion zone boundary */}
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

        {/* 66 kV array cables */}
        <ArrayCables />

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

        {/* Offshore Substation marker */}
        <Marker
          position={[OSS_GEO.lat, OSS_GEO.lon]}
          icon={ossIcon}
          eventHandlers={ossHandlers}
        />

        {/* Onshore Substation marker */}
        <Marker
          position={[ONSHORE_GEO.lat, ONSHORE_GEO.lon]}
          icon={onshoreIcon}
          eventHandlers={onshoreHandlers}
        />

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

      {/* Compass overlay */}
      <WindCompass />

      {/* Legend overlay */}
      <MapLegend />

      {/* Alarm ticker */}
      <AlarmTicker />
    </div>
  );
}

export default memo(LeafletWindFarmMapInner);
