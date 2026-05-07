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

// ── OSS Marker Icon (IEC 60617 HVAC Transformer) ────────────────
function createOSSIcon(powerMW: number): L.DivIcon {
  const svg = `<svg width="64" height="78" viewBox="-32 -24 64 78" xmlns="http://www.w3.org/2000/svg">
    <!-- Label -->
    <text x="0" y="-15" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="600" font-family="Inter, sans-serif" letter-spacing="0.5">OSS</text>

    <!-- Platform deck (offshore structure) -->
    <rect x="-26" y="-8" width="52" height="28" rx="2" fill="#0d1017" stroke="#2a3040" stroke-width="1"/>

    <!-- Conservator tank (oil expansion) — small horizontal cylinder on top -->
    <ellipse cx="0" cy="-9" rx="9" ry="2.2" fill="#1a2030" stroke="${SCADA_COLORS.ENERGIZED}" stroke-width="0.5" opacity="0.7"/>
    <!-- Buchholz relay -->
    <rect x="-1.6" y="-7" width="3.2" height="2" fill="${SCADA_COLORS.ENERGIZED}" opacity="0.5"/>
    <!-- Connecting pipe -->
    <line x1="0" y1="-7" x2="0" y2="-4" stroke="#475569" stroke-width="0.7"/>
    <!-- LTC motor drive box (left of tank top) -->
    <rect x="-18" y="-7" width="5" height="3.5" fill="#0d1421" stroke="#94a3b8" stroke-width="0.5"/>
    <text x="-15.5" y="-4" text-anchor="middle" fill="#cbd5e1" font-size="2.6" font-family="monospace">T7</text>

    <!-- Transformer tank body -->
    <rect x="-21" y="-4" width="42" height="20" rx="1.5" fill="#151b28" stroke="#3d4560" stroke-width="0.8"/>
    <!-- Tank top edge highlight (depth) -->
    <line x1="-20" y1="-3" x2="20" y2="-3" stroke="#283044" stroke-width="0.5"/>

    <!-- Cooling radiator fins (right side of tank) -->
    <g opacity="0.45" stroke="#4a5580" stroke-width="0.5" fill="${SCADA_COLORS.ENERGIZED}">
      <rect x="16" y="-1" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="16" y="2.5" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="16" y="6" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="16" y="9.5" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
    </g>
    <!-- Cooling radiator fins (left side of tank, mirrors the right) -->
    <g opacity="0.45" stroke="#4a5580" stroke-width="0.5" fill="${SCADA_COLORS.ENERGIZED}">
      <rect x="-19" y="-1" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="-19" y="2.5" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="-19" y="6" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
      <rect x="-19" y="9.5" width="3" height="2.5" rx="0.3" fill-opacity="0.35"/>
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

// ── Grid Switchyard Icon (IEC 60617 single-line) ────────────────
// Shows the 400 kV interface to PSE: 3-phase busbar + circuit breaker +
// disconnector + grounding switch + voltage transformer. Per IEC 60617:2015.
function createGridSwitchyardIcon(breakerClosed: boolean = true): L.DivIcon {
  const liveColor = breakerClosed ? SCADA_COLORS.VOLTAGE_400KV : "#475569";
  const cbFill = breakerClosed ? SCADA_COLORS.VOLTAGE_400KV : "#0d1017";
  const svg = `<svg width="80" height="62" viewBox="-40 -22 80 62" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="-12" text-anchor="middle" fill="#94a3b8" font-size="6.5" font-weight="600" font-family="Inter, sans-serif">SWITCHYARD</text>

    <!-- 3-phase busbar (3 horizontal lines) -->
    ${[-3, 0, 3].map((dy) => `<line x1="-30" y1="${dy}" x2="30" y2="${dy}" stroke="${liveColor}" stroke-width="1.2" opacity="0.9"/>`).join("")}

    <!-- Voltage transformer (VT) — circle with H winding inside -->
    <circle cx="-22" cy="0" r="3.5" fill="#0d1017" stroke="${liveColor}" stroke-width="0.8"/>
    <text x="-22" y="2.2" text-anchor="middle" fill="${liveColor}" font-size="4" font-family="monospace">VT</text>

    <!-- Circuit breaker — filled square (closed) or open square -->
    <rect x="-12" y="-2.5" width="5" height="5" fill="${cbFill}" stroke="${liveColor}" stroke-width="0.8"/>
    <text x="-9.5" y="9" text-anchor="middle" fill="#94a3b8" font-size="3.5" font-family="monospace">CB</text>

    <!-- Disconnector blade — knife switch (line at angle) -->
    <line x1="0" y1="2.5" x2="6" y2="-2.5" stroke="${liveColor}" stroke-width="1.1"/>
    <circle cx="0" cy="2.5" r="1" fill="${liveColor}"/>
    <text x="3" y="9" text-anchor="middle" fill="#94a3b8" font-size="3.5" font-family="monospace">DS</text>

    <!-- Grounding switch — line down + earth symbol -->
    <line x1="14" y1="-2.5" x2="14" y2="6" stroke="#94a3b8" stroke-width="0.8"/>
    <line x1="11" y1="6" x2="17" y2="6" stroke="#94a3b8" stroke-width="0.8"/>
    <line x1="12.5" y1="7.5" x2="15.5" y2="7.5" stroke="#94a3b8" stroke-width="0.8"/>
    <line x1="13.5" y1="9" x2="14.5" y2="9" stroke="#94a3b8" stroke-width="0.8"/>
    <text x="20" y="9" text-anchor="middle" fill="#94a3b8" font-size="3.5" font-family="monospace">GS</text>

    <!-- Voltage label -->
    <text x="0" y="20" text-anchor="middle" fill="${liveColor}" font-size="6.5" font-family="JetBrains Mono, monospace" font-weight="600">400 kV · ${breakerClosed ? "ENERGISED" : "OPEN"}</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "leaflet-switchyard-marker",
    iconSize: [80, 62],
    iconAnchor: [40, 22],
  });
}

// ── STATCOM Marker Icon — containerised industrial design ───────
// Real ABB SVC Light / Siemens SVC Plus units: a row of valve containers
// (IGBT MMC modules), a paralleled capacitor bank, and a coupling
// transformer to the busbar. This icon lays them out as a single-line:
//
//   [bus 220 kV] ─┬─ [coupling tx] ─┬─ [filter L] ─┬─ [valves] ─┬─ [cap bank]
//
// Q sign convention: positive = injecting (capacitive, leading), negative
// = absorbing (inductive, lagging). |Q| ≤ 5 reads as idle.
function createSTATCOMIcon(qMVAR: number): L.DivIcon {
  const isInjecting = qMVAR > 5;
  const isAbsorbing = qMVAR < -5;
  const liveColor = isInjecting
    ? "#f59e0b"
    : isAbsorbing
      ? "#06b6d4"
      : "#64748b";
  const dimColor = "#475569";
  const fillBg = "#0d1017";
  const qLabel = `${qMVAR >= 0 ? "+" : ""}${qMVAR.toFixed(0)} MVAr`;
  const modeLabel = isInjecting ? "INJECT" : isAbsorbing ? "ABSORB" : "STANDBY";

  // Q-bar fill: |Q|/120 of the rated capacity, rendered as a horizontal bar
  // under the readout. Always ±120 MVAr is full scale.
  const qFrac = Math.min(Math.abs(qMVAR) / 120, 1);
  const barColor = liveColor;

  const svg = `<svg width="120" height="78" viewBox="-60 -28 120 78" xmlns="http://www.w3.org/2000/svg">
    <!-- Title strip -->
    <text x="0" y="-18" text-anchor="middle" fill="#cbd5e1" font-size="7" font-weight="700" font-family="Inter, sans-serif" letter-spacing="1">STATCOM · ±120 MVAr</text>

    <!-- Container outline (steel skid frame) -->
    <rect x="-55" y="-12" width="110" height="22" rx="2" fill="${fillBg}" stroke="#3d4560" stroke-width="0.8"/>

    <!-- 220 kV busbar tap (left edge) -->
    <line x1="-55" y1="-1" x2="-50" y2="-1" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="1.4"/>
    <text x="-58" y="-13" fill="${SCADA_COLORS.VOLTAGE_220KV}" font-size="3.5" font-family="monospace">220kV</text>

    <!-- Coupling transformer — 2-circle Δ/Y -->
    <circle cx="-44" cy="-1" r="3.5" fill="none" stroke="${SCADA_COLORS.VOLTAGE_220KV}" stroke-width="0.8"/>
    <circle cx="-39" cy="-1" r="3.5" fill="none" stroke="#94a3b8" stroke-width="0.8"/>

    <!-- Filter reactor coil (3 humps) -->
    <path d="M -32 -1 q 1.5 -3 3 0 q 1.5 3 3 0 q 1.5 -3 3 0" fill="none" stroke="${liveColor}" stroke-width="0.9"/>

    <!-- IGBT valve container — 4 modules (MMC SM half-bridges) -->
    <rect x="-18" y="-7" width="20" height="12" rx="1" fill="#0a1018" stroke="${liveColor}" stroke-width="0.7"/>
    ${[-14, -10, -6, -2]
      .map(
        (cx, i) => `
      <rect x="${cx - 1.5}" y="${-5}" width="3" height="8" fill="${liveColor}" fill-opacity="${isInjecting || isAbsorbing ? 0.55 + i * 0.08 : 0.18}" stroke="${dimColor}" stroke-width="0.3"/>
    `,
      )
      .join("")}

    <!-- Capacitor bank — 4 stacked plates, IEC capacitor pairs -->
    <g transform="translate(8 -1)">
      ${[-5, 0, 5]
        .map(
          (cy) => `
        <line x1="-3" y1="${cy - 0.6}" x2="3" y2="${cy - 0.6}" stroke="${liveColor}" stroke-width="0.9"/>
        <line x1="-3" y1="${cy + 0.6}" x2="3" y2="${cy + 0.6}" stroke="${liveColor}" stroke-width="0.9"/>
      `,
        )
        .join("")}
      <!-- vertical bus connecting the cap stack -->
      <line x1="0" y1="-7" x2="0" y2="7" stroke="${liveColor}" stroke-width="0.6" opacity="0.7"/>
    </g>

    <!-- Shunt reactor (50 MVAr inductor) — small coil at right -->
    <g transform="translate(20 0)">
      <circle cx="0" cy="-3" r="1.8" fill="none" stroke="${liveColor}" stroke-width="0.6"/>
      <circle cx="0" cy="0" r="1.8" fill="none" stroke="${liveColor}" stroke-width="0.6"/>
      <circle cx="0" cy="3" r="1.8" fill="none" stroke="${liveColor}" stroke-width="0.6"/>
      <text x="0" y="11" text-anchor="middle" fill="#64748b" font-size="3" font-family="monospace">50 MVAr L</text>
    </g>

    <!-- Status LED (solid pulse only when active) -->
    ${
      isInjecting || isAbsorbing
        ? `<circle cx="32" cy="-9" r="1.6" fill="${liveColor}"><animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/></circle>`
        : `<circle cx="32" cy="-9" r="1.6" fill="${dimColor}" opacity="0.6"/>`
    }

    <!-- Mode badge -->
    <rect x="36" y="-12" width="20" height="6" rx="1" fill="${fillBg}" stroke="${liveColor}" stroke-width="0.5"/>
    <text x="46" y="-7.5" text-anchor="middle" fill="${liveColor}" font-size="4.2" font-weight="700" font-family="Inter, sans-serif" letter-spacing="0.5">${modeLabel}</text>

    <!-- Q readout + capability bar -->
    <text x="-55" y="22" fill="${liveColor}" font-size="8" font-weight="700" font-family="JetBrains Mono, monospace">${qLabel}</text>
    <!-- Bar background (full ±120 scale, divided at zero) -->
    <rect x="14" y="16" width="42" height="6" fill="#0a1018" stroke="#3d4560" stroke-width="0.5"/>
    <line x1="35" y1="16" x2="35" y2="22" stroke="#3d4560" stroke-width="0.4"/>
    <!-- Q fill: from centre toward injection (right) or absorption (left) -->
    ${
      qMVAR > 0
        ? `<rect x="35" y="16.8" width="${(qFrac * 21).toFixed(1)}" height="4.4" fill="${barColor}" opacity="0.85"/>`
        : qMVAR < 0
          ? `<rect x="${(35 - qFrac * 21).toFixed(1)}" y="16.8" width="${(qFrac * 21).toFixed(1)}" height="4.4" fill="${barColor}" opacity="0.85"/>`
          : ""
    }
    <text x="14" y="29" fill="#64748b" font-size="3" font-family="monospace">−120</text>
    <text x="35" y="29" text-anchor="middle" fill="#64748b" font-size="3" font-family="monospace">0</text>
    <text x="56" y="29" text-anchor="end" fill="#64748b" font-size="3" font-family="monospace">+120</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "leaflet-statcom-marker",
    iconSize: [120, 78],
    iconAnchor: [60, 0],
  });
}

// ── Met Mast / LIDAR Buoy Marker Icon ─────────────────────────
// Floating LIDAR (e.g. ZX 300M / Vaisala WindCube) — used for wind resource
// validation and turbulence intensity reference, independent of WTG SCADA.
// Compact map marker — only the buoy + mast + scan head + small label.
// Detailed measurements (vertical profile, TI, sensor health, etc) live in
// the LIDARDetailPanel that opens on click. Keeping the marker small lets
// it sit in the seascape without dwarfing the turbine icons.
function createMetMastIcon(windMs: number, _windDir: number): L.DivIcon {
  const speedColor =
    windMs > 25 ? "#ef4444" : windMs > 15 ? "#f5a623" : "#3ecf6e";

  // 64 × 88 px — sits comfortably between turbine markers (40×56) and the
  // OSS/onshore substation (~80 px). Pulsing halo draws the eye to clear
  // water NW of the cluster. Detail (vertical profile, TI, sensor health)
  // lives in LIDARDetailPanel on click.
  const svg = `<svg width="64" height="88" viewBox="-32 -32 64 88" xmlns="http://www.w3.org/2000/svg">
    <!-- Outer attention-getter halo — wide, faint, slow pulse. Pointer events
         disabled in CSS so it doesn't block clicks on neighbouring markers. -->
    <circle cx="0" cy="10" r="20" fill="${speedColor}" opacity="0.10" pointer-events="none">
      <animate attributeName="r" values="16;22;16" dur="3.5s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.18;0.04;0.18" dur="3.5s" repeatCount="indefinite"/>
    </circle>

    <!-- Inner halo, slightly tighter for a layered ripple feel -->
    <circle cx="0" cy="10" r="13" fill="${speedColor}" opacity="0.18" pointer-events="none">
      <animate attributeName="r" values="11;15;11" dur="2.4s" repeatCount="indefinite"/>
    </circle>

    <!-- Floating buoy hull — yellow safety paint, with shadow line -->
    <ellipse cx="0" cy="10" rx="11" ry="3.5" fill="#eab308" stroke="#a16207" stroke-width="1"/>
    <line x1="-11" y1="10.8" x2="11" y2="10.8" stroke="#7c2d12" stroke-width="0.7"/>

    <!-- Mast riser -->
    <line x1="0" y1="6.5" x2="0" y2="-14" stroke="#cbd5e1" stroke-width="1.6"/>

    <!-- LIDAR scan head — small instrument box -->
    <rect x="-4.5" y="-19" width="9" height="5" rx="0.6" fill="#0d1017"
          stroke="${speedColor}" stroke-width="1"/>
    <circle cx="0" cy="-16.5" r="1.2" fill="${speedColor}" opacity="0.85">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite"/>
    </circle>

    <!-- 4 scan beams (VAD conical scan, IEC 61400-12-1) -->
    <line x1="0" y1="-19" x2="-7" y2="-26" stroke="${speedColor}" stroke-width="1"
          stroke-dasharray="3 2" opacity="0.85">
      <animate attributeName="stroke-dashoffset" values="0;-5" dur="1.4s" repeatCount="indefinite"/>
    </line>
    <line x1="0" y1="-19" x2="7" y2="-26" stroke="${speedColor}" stroke-width="1"
          stroke-dasharray="3 2" opacity="0.85">
      <animate attributeName="stroke-dashoffset" values="0;-5" dur="1.4s" repeatCount="indefinite"/>
    </line>
    <line x1="0" y1="-19" x2="-3.5" y2="-29" stroke="${speedColor}" stroke-width="0.7"
          stroke-dasharray="2 2" opacity="0.6"/>
    <line x1="0" y1="-19" x2="3.5" y2="-29" stroke="${speedColor}" stroke-width="0.7"
          stroke-dasharray="2 2" opacity="0.6"/>

    <!-- Wind readout pill below the buoy -->
    <rect x="-15" y="18" width="30" height="11" rx="1.5" fill="#0a0d14"
          stroke="${speedColor}" stroke-width="0.7" opacity="0.92"/>
    <text x="0" y="26" text-anchor="middle" fill="${speedColor}" font-size="7.5" font-weight="700"
          font-family="JetBrains Mono, monospace">${windMs.toFixed(1)} m/s</text>

    <!-- Tag label -->
    <text x="0" y="36" text-anchor="middle" fill="#94a3b8" font-size="5.5" font-weight="700"
          font-family="Inter, sans-serif" letter-spacing="0.8">LIDAR · MM-1</text>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: "leaflet-metmast-marker",
    iconSize: [64, 88],
    iconAnchor: [32, 22], // anchor at the buoy waterline (y=10 + 12 viewBox offset)
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

    <!-- Conservator tank (oil expansion) — small horizontal cylinder on top -->
    <ellipse cx="0" cy="-7" rx="8" ry="2" fill="#1a2030" stroke="${SCADA_COLORS.ENERGIZED}" stroke-width="0.5" opacity="0.7"/>
    <!-- Buchholz relay -->
    <rect x="-1.4" y="-5.2" width="2.8" height="1.8" fill="${SCADA_COLORS.ENERGIZED}" opacity="0.5"/>
    <!-- Connecting pipe -->
    <line x1="0" y1="-5.2" x2="0" y2="-2" stroke="#475569" stroke-width="0.6"/>
    <!-- LTC motor drive box -->
    <rect x="-16" y="-5" width="4.5" height="3" fill="#0d1421" stroke="#94a3b8" stroke-width="0.4"/>
    <text x="-13.7" y="-2.5" text-anchor="middle" fill="#cbd5e1" font-size="2.4" font-family="monospace">T9</text>

    <!-- Transformer tank body -->
    <rect x="-19" y="-2" width="38" height="18" rx="1.5" fill="#151b28" stroke="#3d4560" stroke-width="0.8"/>
    <!-- Tank top edge highlight (depth) -->
    <line x1="-18" y1="-1" x2="18" y2="-1" stroke="#283044" stroke-width="0.5"/>

    <!-- Cooling radiator fins (right side of tank) -->
    <g opacity="0.45" stroke="#4a5580" stroke-width="0.5">
      <rect x="14" y="1" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
      <rect x="14" y="4.5" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
      <rect x="14" y="8" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
    </g>
    <!-- Cooling radiator fins (left side of tank — mirror) -->
    <g opacity="0.45" stroke="#4a5580" stroke-width="0.5">
      <rect x="-17" y="1" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
      <rect x="-17" y="4.5" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
      <rect x="-17" y="8" width="3" height="2.5" rx="0.3" fill="${SCADA_COLORS.ENERGIZED}" fill-opacity="0.35"/>
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
  // STATCOM Q derived from instantaneous total power as a deterministic stub:
  // at low generation, the unit is in capacitive (boosting) mode to support
  // voltage; near full output, it absorbs the natural Q overshoot. Quantised
  // to 5 MVAr so the icon doesn't recreate on every tick.
  const statcomQRaw =
    ((255 - totalPowerMW) / 510) * 90 + (Math.random() < 0.001 ? 0 : 0);
  const statcomQ =
    Math.round(Math.max(-120, Math.min(120, statcomQRaw)) / 5) * 5;
  const statcomIcon = useMemo(() => createSTATCOMIcon(statcomQ), [statcomQ]);
  // Grid switchyard breaker is closed whenever the farm is exporting power.
  const switchyardIcon = useMemo(
    () => createGridSwitchyardIcon(totalPowerMW > 0.5),
    [totalPowerMW > 0.5],
  );
  // Floating LIDAR met mast — independent wind reference for resource validation.
  // Reads farm-level wind from the KPI stream (quantised so the icon is stable).
  const farmKpis = useLandingStore(selectKPIs);
  const lidarWindMs = Math.round(farmKpis.averageWindSpeedMs * 2) / 2;
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

        {/* STATCOM marker — ±120 MVAR + 50 MVAr shunt reactor at the OSS.
            Placed northeast of OSS so the wide single-line container icon has
            clear water around it instead of overlapping the substation. */}
        <Marker
          position={[OSS_GEO.lat + 0.025, OSS_GEO.lon + 0.04]}
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
