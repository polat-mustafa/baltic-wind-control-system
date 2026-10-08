/**
 * Leaflet-based interactive wind farm map — replaces the SVG WindFarmMap.
 *
 * Uses react-leaflet with OpenStreetMap tiles, CSS-darkened to match the ISA-101 dark theme.
 * Turbines are DivIcon markers with inline SVG, connected by 66 kV array cable
 * polylines. Export cable (220 kV) runs from OSS to onshore substation with
 * animated dash pattern. KPI ribbon overlays at top, alarm ticker at bottom.
 *
 * Geographic coordinates: SB-510 array ~55.06°N, 16.54°E (Polish Baltic EEZ, PZP_44).
 *
 * Detail panels are rendered by the parent (LandingPage) — OUTSIDE Leaflet's
 * DOM tree — so they are never hidden behind GPU-composited translate3d layers.
 */

import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

import { SCADA_COLORS } from "../../constants/scadaColors";
import {
  EXPORT_CABLE_LAND_GEO,
  EXPORT_CABLE_SUBSEA_GEO,
  FARM_VIEW_BOUNDS,
  LANDFALL_GEO,
  LIDAR_GEO,
  ONSHORE_GEO as SB510_ONSHORE_GEO,
  PSE_GRID_LINE_GEO,
  PSE_SUBSTATION_GEO,
  SEA_POLYGON_GEO,
  turbineIconScale,
} from "../../constants/windFarmLayout";
import { arraySegments, sectionOf, useFleet, type ArraySegment, type Fleet } from "../../lib/fleet";
import { bayName } from "../../lib/lifecycle/farm";
import {
  ARRAY_FAULT_ISOLATION_MS,
  selectKPIs,
  selectTurbine,
  useLandingStore,
} from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";
import { cn } from "../../lib/utils";
import type { TurbineStatus } from "../../types/landing";
import { arrayCableCurrentA, arrayCableGrade } from "../../utils/landingPhysics";
import { useStatcomQ } from "../../store/liveGridStore";

import AlarmTicker from "./AlarmTicker";
import BathymetryLayer from "./BathymetryLayer";
import DayNightOverlay from "./DayNightOverlay";
import EnvironmentPanel from "./EnvironmentPanel";
import LayerControlPanel from "./LayerControlPanel";
import MapLegend from "./MapLegend";
import { GridContext, NavAids, RepairCrews, SafetyZones, Vessels } from "./MaritimeLayers";
import AisTraffic from "./AisTraffic";
import CableDtsLayer from "./CableDtsLayer";
import ScenarioCenter from "./ScenarioCenter";
import { useTrainingStore } from "../../store/trainingStore";
import OceanWaveOverlay from "./OceanWaveOverlay";
import TurbineDetailOverlay from "./TurbineDetailOverlay";
import WakeEffectLayer from "./WakeEffectLayer";
import WindParticleOverlay from "./WindParticleOverlay";

// ── Atmospheric Pane (z-index between tiles and markers) ──────
// Creates a custom Leaflet pane at z-index 250 (tile-pane = 200,
// overlay-pane = 400). Overlays portaled here render ABOVE tiles
// but BELOW markers/polylines. Counter-transform keeps the pane
// viewport-fixed despite Leaflet's translate3d on map-pane.
/**
 * Storybook theme: teal sea over parchment land (OSM coastline polygon in
 * its own pane just above the tiles, inked coastline) + paper grain.
 */
function StorybookSurface() {
  const map = useMap();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!map.getPane("sbSeaPane")) {
      const pane = map.createPane("sbSeaPane");
      pane.style.zIndex = "210";
      pane.style.pointerEvents = "none";
    }
    const atmos = map.getPane("atmosphericPane");
    const paper = document.createElement("div");
    paper.className = "sb-paper-overlay";
    atmos?.appendChild(paper);
    setReady(true);
    return () => paper.remove();
  }, [map]);
  if (!ready) return null;
  return (
    <Polygon
      positions={SEA_POLYGON_GEO}
      pane="sbSeaPane"
      interactive={false}
      pathOptions={{ color: "#2b2118", weight: 2.2, fillColor: "#3f8d86", fillOpacity: 0.78, lineJoin: "round" }}
    />
  );
}

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

// ── Turbine marker ─────────────────────────────────────────────
// The original icon (translucent tower, nacelle, spinning 3-blade rotor,
// pitch arc, dashed yaw compass, output bar, ID), made easier to read:
// scaled per zoom (--wtg-scale, TurbineZoomScaler), higher opacities, a thin
// dark halo, a larger yaw arrow, and the output bar shows live power.
//
// Smooth rendering: the SVG is built once per status. Yaw, nacelle side,
// rotor speed, pitch and output are then written onto the live DOM each
// 5 s tick and eased by CSS transitions / the Web Animations playback rate,
// so a wind change never rebuilds 34 icons (which restarted every rotor).
const STATUS_COLOR: Record<TurbineStatus, string> = {
  operating: "#3ecf6e",
  curtailed: "#f5a623",
  fault: "#ef4444",
  offline: "#8b93a7",
};

/** V236 rated rotor speed [rpm]; the CSS spin runs at this rate (7.2 s/rev). */
const RATED_RPM = 8.33;

const BLADE =
  "M 0,0 C -1.2,-3 -1.8,-8 -1,-13 L 0,-15 L 1,-13 C 1.4,-8 0.8,-3 0,0 Z";
/** Output bar geometry (px in icon units): full width = rated 15 MW. */
const BAR_W = 12;

function createTurbineIcon(status: TurbineStatus, shortId: string): L.DivIcon {
  const color = STATUS_COLOR[status];
  const glow =
    status === "fault"
      ? `<circle r="8" fill="${color}" opacity="0.2"><animate attributeName="opacity" values="0.15;0.35;0.15" dur="1.5s" repeatCount="indefinite"/></circle>`
      : status === "operating"
        ? `<circle r="6" fill="${color}" opacity="0.1"><animate attributeName="opacity" values="0.06;0.2;0.06" dur="3s" repeatCount="indefinite"/></circle>`
        : "";

  // Side elevation: tower under the nacelle, rotor (front view) at the hub.
  // The nacelle is flipped left/right toward the downwind side and the yaw
  // compass arrow shows the true heading (both set live in TurbineMarker).
  const svg = `<svg class="wtg-svg" width="40" height="56" viewBox="-20 -20 40 56" xmlns="http://www.w3.org/2000/svg">
    ${glow}
    <g opacity="0.75">
      <circle r="13" fill="none" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="1.2 2"/>
      <g class="wtg-yaw"><path d="M 0,-17 L -2.8,-11.2 L 2.8,-11.2 Z" fill="#e2e8f0"/></g>
    </g>
    <path d="M -1.9,2 L -3.4,22 L 3.4,22 L 1.9,2 Z" fill="${color}" opacity="0.75"/>
    <line x1="-6" y1="22" x2="6" y2="22" stroke="${color}" stroke-width="2" opacity="0.65"/>
    <line x1="-4.5" y1="24" x2="4.5" y2="24" stroke="${color}" stroke-width="1" opacity="0.4"/>
    <g class="wtg-nacelle">
      <rect x="-2.5" y="-2.4" width="10.5" height="4.8" rx="2.2" fill="${color}" opacity="0.95"/>
      <circle class="wtg-avlight" cx="5.8" cy="-3" r="0.9" fill="#ef4444" style="--av-delay:-${((Date.now() % 2000) / 1000).toFixed(2)}s"/>
    </g>
    <path class="wtg-pitch" d="" fill="none" stroke="#fbbf24" stroke-width="1" opacity="0.9"/>
    <g class="wtg-rotor">
      <path d="${BLADE}" fill="${color}" opacity="0.9"/>
      <path d="${BLADE}" fill="${color}" opacity="0.9" transform="rotate(120)"/>
      <path d="${BLADE}" fill="${color}" opacity="0.9" transform="rotate(240)"/>
    </g>
    <circle r="2.1" fill="${color}"/>
    <rect x="${-BAR_W / 2}" y="26" width="${BAR_W}" height="2.2" rx="0.6" fill="#1e2231" stroke="${color}" stroke-width="0.35" opacity="0.8"/>
    <rect class="wtg-power" x="${-BAR_W / 2}" y="26" width="${BAR_W}" height="2.2" rx="0.6" fill="${color}" opacity="0.85"/>
    <text class="wtg-id" x="0" y="34.5" fill="#aab4c8" font-size="6.5" font-weight="600" font-family="JetBrains Mono, monospace" text-anchor="middle">${shortId}</text>
  </svg>
  <span class="sr-only">Turbine WTG-${shortId}, ${status}</span>`;

  return L.divIcon({
    html: svg,
    className: "leaflet-turbine-marker",
    iconSize: [40, 56],
    iconAnchor: [20, 20], // hub
  });
}

// ── Storybook (demo) turbine: same parts and live-update hooks, inked ──
// Monopile with the yellow transition piece real offshore turbines carry
// (IALA / marking practice), off-white tower and blades, ink outlines,
// status as a coloured pennant; a red flag + smoke curls on a fault.
const SB_INK = "#2b2118";
const SB_STATUS: Record<TurbineStatus, string> = {
  operating: "#5c8a2e",
  curtailed: "#c8841e",
  fault: "#b3261e",
  offline: "#7a6650",
};
const SB_BLADE = "M 0,0 C -1.5,-3 -2.2,-8.5 -1.1,-13.6 L 0,-15.4 L 1.1,-13.4 C 1.7,-8 1,-3 0,0 Z";

function createStorybookTurbineIcon(status: TurbineStatus, shortId: string): L.DivIcon {
  const c = SB_STATUS[status];
  const ink = `stroke="${SB_INK}" stroke-width="1.1" stroke-linejoin="round"`;
  const fault =
    status === "fault"
      ? `<path d="M 3.2,16 L 3.2,9.5 L 8.5,11 L 3.2,12.6" fill="${c}" ${ink}/>
         <path d="M -3,-4 q -3,-3 0,-6 q 3,-3 0,-6" fill="none" stroke="${SB_INK}" stroke-width="0.8" opacity="0.6"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/></path>`
      : "";
  const svg = `<svg class="wtg-svg" width="40" height="56" viewBox="-20 -20 40 56" xmlns="http://www.w3.org/2000/svg">
    <g opacity="0.85">
      <circle r="13" fill="none" stroke="${SB_INK}" stroke-width="0.7" stroke-dasharray="1.6 2.4"/>
      <g class="wtg-yaw"><path d="M 0,-17.5 L -3,-11 Q 0,-12.4 3,-11 Z" fill="${SB_INK}"/></g>
    </g>
    <ellipse cx="0" cy="23.6" rx="7.5" ry="1.8" fill="#f6eedb" stroke="${SB_INK}" stroke-width="0.6" opacity="0.9"/>
    <path d="M -2.6,16.5 L -2.9,23.4 L 2.9,23.4 L 2.6,16.5 Z" fill="#e3b33a" ${ink}/>
    <path d="M -1.8,2 L -2.5,16.6 L 2.5,16.6 L 1.8,2 Z" fill="#efe6d2" ${ink}/>
    <path d="M -2.5,13.2 L 2.5,13.2" stroke="${SB_INK}" stroke-width="0.5" opacity="0.5"/>
    <g class="wtg-nacelle">
      <rect x="-2.6" y="-2.5" width="10.8" height="5" rx="2.4" fill="#efe6d2" ${ink}/>
      <circle class="wtg-avlight" cx="5.8" cy="-3.1" r="1" fill="#d63a2f" style="--av-delay:-${((Date.now() % 2000) / 1000).toFixed(2)}s"/>
    </g>
    <path d="M 2.3,13 L 2.3,6" stroke="${SB_INK}" stroke-width="0.6"/>
    <path d="M 2.3,6 L 7.4,7.6 L 2.3,9.2 Z" fill="${c}" ${ink}/>
    ${fault}
    <path class="wtg-pitch" d="" fill="none" stroke="#c8841e" stroke-width="1.2" stroke-linecap="round"/>
    <g class="wtg-rotor">
      <path d="${SB_BLADE}" fill="#f6efdf" ${ink}/>
      <path d="${SB_BLADE}" fill="#f6efdf" ${ink} transform="rotate(120)"/>
      <path d="${SB_BLADE}" fill="#f6efdf" ${ink} transform="rotate(240)"/>
    </g>
    <circle r="2.2" fill="${c}" ${ink}/>
    <rect x="${-BAR_W / 2}" y="26.4" width="${BAR_W}" height="2.4" rx="1" fill="#f1e4c3" stroke="${SB_INK}" stroke-width="0.6"/>
    <rect class="wtg-power" x="${-BAR_W / 2}" y="26.4" width="${BAR_W}" height="2.4" rx="1" fill="${c}"/>
    <text class="wtg-id" x="0" y="35.2" fill="${SB_INK}" font-size="7.5" text-anchor="middle">${shortId}</text>
  </svg>
  <span class="sr-only">Turbine WTG-${shortId}, ${status}</span>`;
  return L.divIcon({ html: svg, className: "leaflet-turbine-marker", iconSize: [40, 56], iconAnchor: [20, 20] });
}

/** Pitch arc path: clockwise from 12 o'clock by the pitch angle (r = 8). */
function pitchArcPath(pitchDeg: number, spinning: boolean): string {
  const p = Math.max(0, Math.min(90, pitchDeg));
  if (!spinning || p <= 0.5) return "";
  const a = ((p - 90) * Math.PI) / 180;
  return `M 0,-8 A 8,8 0 0 1 ${(8 * Math.cos(a)).toFixed(2)},${(8 * Math.sin(a)).toFixed(2)}`;
}

/** Shortest-path unwrap so a 359° → 1° step rotates 2°, not −358°. */
function unwrapDeg(prev: number | null, next: number): number {
  if (prev === null) return next;
  return prev + ((((next - prev) % 360) + 540) % 360) - 180;
}

// ── Single Turbine Marker (connected to store) ─────────────────
const TurbineMarker = memo(function TurbineMarker({
  turbineId,
  lat,
  lon,
  isSelected,
  focus,
  onHover,
  onLeave,
  onClick,
}: {
  turbineId: string;
  lat: number;
  lon: number;
  isSelected: boolean;
  /** Array-cable focus: "feed" = feeds the clicked cable, "dim" = other string. */
  focus?: "feed" | "dim";
  onHover: (id: string) => void;
  onLeave: () => void;
  onClick: (id: string) => void;
}) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const shortId = turbineId.replace(/^WTG-/, "");
  const markerRef = useRef<L.Marker | null>(null);
  const yawRef = useRef<number | null>(null);
  const builtIconRef = useRef<L.DivIcon | null>(null);
  const status = turbine?.status ?? "offline";
  const storybook = useLayerStore((s) => s.mapTheme) === "storybook";

  // Rebuilt only when the status (colour) or the map theme changes.
  const icon = useMemo(
    () => (storybook ? createStorybookTurbineIcon(status, shortId) : createTurbineIcon(status, shortId)),
    [status, shortId, storybook],
  );

  // Live state → DOM. Runs after react-leaflet's setIcon (child effects run
  // first), and again whenever the icon is rebuilt.
  const yaw = turbine?.nacellePositionDeg ?? 225;
  const rpm = turbine?.rotorSpeedRpm ?? 0;
  const pitch = turbine?.pitchAngleDeg ?? 90;
  const powerFrac = Math.min(
    Math.max((turbine?.powerOutputMW ?? 0) / 15, 0),
    1,
  );
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    const q = (sel: string) => el.querySelector<SVGElement>(sel);
    // Fresh SVG (mount / status change): jump to the current state instead
    // of easing in from zero.
    const fresh = builtIconRef.current !== icon;
    builtIconRef.current = icon;
    if (fresh) el.classList.add("wtg-no-ease");

    const unwrapped = unwrapDeg(yawRef.current, yaw);
    yawRef.current = unwrapped;
    q(".wtg-yaw")?.style.setProperty("transform", `rotate(${unwrapped}deg)`);
    // Nacelle body points downwind: east component of downwind = −sin(yaw)
    const east = -Math.sin((yaw * Math.PI) / 180);
    const sx = (east >= 0 ? 1 : -1) * (0.55 + 0.45 * Math.abs(east));
    q(".wtg-nacelle")?.style.setProperty(
      "transform",
      `scaleX(${sx.toFixed(3)})`,
    );
    q(".wtg-pitch")?.setAttribute("d", pitchArcPath(pitch, rpm > 0.1));
    q(".wtg-power")?.style.setProperty(
      "transform",
      `scaleX(${powerFrac.toFixed(3)})`,
    );
    // Rotor: CSS spin at rated rpm, scaled by the playback rate (keeps phase)
    for (const anim of q(".wtg-rotor")?.getAnimations?.() ?? []) {
      anim.updatePlaybackRate(rpm / RATED_RPM);
    }
    el.classList.toggle("turbine-selected", isSelected);
    el.classList.toggle("wtg-feed", focus === "feed");
    el.classList.toggle("wtg-dim", focus === "dim");
    if (fresh) {
      void el.getBoundingClientRect(); // commit the un-eased values first
      el.classList.remove("wtg-no-ease");
    }
  }, [icon, yaw, rpm, pitch, powerFrac, isSelected, focus]);

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
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={icon}
      eventHandlers={eventHandlers}
    >
      <Tooltip
        direction="right"
        offset={[24, 0]}
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
  /** Pixel offset of the glyph from the geographic point (e.g. STATCOM on the OSS). */
  offset?: [number, number];
  /** Put the label left of the glyph (avoids clashing with a neighbour to the east). */
  labelLeft?: boolean;
}): L.DivIcon {
  const [dx, dy] = opts.offset ?? [0, 0];
  const html = `<div class="eq-marker${opts.labelLeft ? " eq-marker--left" : ""}" style="--eq-color:${opts.color}">
    <span class="eq-marker__glyph${opts.live ? " is-live" : ""}">${opts.glyph}</span>
    <span class="eq-marker__body">
      <span class="eq-marker__tag">${opts.tag}</span>
      <span class="eq-marker__value">${opts.value}${opts.sub ? `<span class="eq-marker__sub">${opts.sub}</span>` : ""}</span>
    </span>
  </div>`;
  return L.divIcon({
    html,
    className: "leaflet-eq-marker",
    iconSize: [24, 24],
    iconAnchor: [12 - dx, 12 - dy],
  });
}

function createOSSIcon(powerMW: number, mva: number, labelLeft: boolean): L.DivIcon {
  return createEquipmentIcon({
    glyph: transformerGlyph(
      SCADA_COLORS.VOLTAGE_66KV,
      SCADA_COLORS.VOLTAGE_220KV,
    ),
    tag: "OSS · 66/220 kV",
    value: `${powerMW.toFixed(0)} MW`,
    sub: `2 × ${mva} MVA`,
    color: EQ_GREEN,
    labelLeft,
  });
}

function createOnshoreIcon(mva: number): L.DivIcon {
  return createEquipmentIcon({
    glyph: transformerGlyph(
      SCADA_COLORS.VOLTAGE_220KV,
      SCADA_COLORS.VOLTAGE_400KV,
    ),
    tag: "Onshore SS · 220/400 kV",
    value: `2 × ${mva} MVA`,
    color: EQ_GREEN,
    labelLeft: true,
  });
}

function createGridSwitchyardIcon(breakerClosed: boolean): L.DivIcon {
  const color = breakerClosed ? EQ_GREEN : EQ_IDLE;
  return createEquipmentIcon({
    glyph: breakerGlyph(color, breakerClosed),
    tag: "PSE Słupsk Wierzbięcino",
    value: `400 kV · ${breakerClosed ? "CB closed" : "CB open"}`,
    color,
  });
}

/** Q sign convention (rule 4): + injecting (capacitive), − absorbing (inductive). */
function createSTATCOMIcon(qMVAR: number, labelLeft: boolean): L.DivIcon {
  const color = qMVAR > 5 ? EQ_INJECT : qMVAR < -5 ? EQ_ABSORB : EQ_IDLE;
  const sign = qMVAR > 0 ? "+" : qMVAR < 0 ? "−" : "";
  return createEquipmentIcon({
    glyph: converterGlyph(color),
    tag: "STATCOM · OSS 220 kV",
    value: `${sign}${Math.abs(qMVAR).toFixed(0)} MVAr`,
    sub: qMVAR > 5 ? "inject" : qMVAR < -5 ? "absorb" : "float",
    color,
    offset: [0, -34],
    labelLeft,
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
    <div className="absolute top-14 right-3 z-1000 pointer-events-none max-md:hidden">
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

// ── Array cable polylines (66 kV, live) ─────────────────────────
// Each segment carries the LIVE output of every turbine beyond it on the
// string (store power), on the backend's graded cable (500/630/800 mm²,
// utils/landingPhysics arrayCableGrade). Colour by current vs rating
// (IEC 60287): < 70 % green · 70–95 % amber · ≥ 95 % red. The cable
// tree is the live fleet's (lib/fleet arraySegments): SB-510's strings end at
// their southern turbine, which connects to the OSS.
function loadColor(loadFrac: number): string {
  if (loadFrac < 0.7) return "#3ecf6e";
  if (loadFrac < 0.95) return "#f5a623";
  return "#ef4444";
}

/** A clicked array-cable segment: its string and the turbines it carries. */
interface CableFocus extends ArraySegment {
  lengthKm: number;
}

interface CableTree {
  segments: CableFocus[];
  pos: Map<string, { lat: number; lon: number }>;
  path: (s: CableFocus) => [number, number][];
  stringSize: (n: number) => number;
}

const treeCache = new WeakMap<Fleet, CableTree>();

/** Array cable sections of a fleet with their map geometry (cached per fleet). */
function cableTree(f: Fleet): CableTree {
  const hit = treeCache.get(f);
  if (hit) return hit;
  const pos = new Map<string, { lat: number; lon: number }>(f.turbines.map((t) => [t.id, t]));
  pos.set("OSS", f.oss);
  const at = (id: string) => pos.get(id)!;
  const segments = arraySegments(f).map((s) => ({
    ...s,
    lengthKm: L.latLng(at(s.fromId).lat, at(s.fromId).lon).distanceTo([at(s.toId).lat, at(s.toId).lon]) / 1000,
  }));
  const tree = {
    segments,
    pos,
    path: (s: CableFocus): [number, number][] => [
      [at(s.fromId).lat, at(s.fromId).lon],
      [at(s.toId).lat, at(s.toId).lon],
    ],
    stringSize: (n: number) => f.strings[n - 1]?.length ?? 1,
  };
  treeCache.set(f, tree);
  return tree;
}

function ArrayCables({
  focus,
  onSelect,
}: {
  focus: CableFocus | null;
  onSelect: (s: CableFocus) => void;
}) {
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const fault = useLandingStore((s) => s.arrayFault);
  const { segments, path: segmentPath, stringSize } = cableTree(useFleet());
  // De-energised cable: ink on the storybook sea, light grey on the dark HMI map
  const deadColor = useLayerStore((s) => s.mapTheme) === "storybook" ? "#2b2118" : "#9ca3af";

  return (
    <>
      {segments.map((seg) => {
        // Fault scenario: the whole string is dead until isolation, then only
        // the faulted section and everything beyond it.
        // In a manual drill the location is only known after isolation
        const located = !fault?.manual || fault.stage !== "tripped";
        const isFaulted = located && fault?.segmentKey === seg.key;
        const dead =
          !!fault &&
          fault.stringNumber === seg.stringNumber &&
          (fault.stage === "tripped" ||
            seg.feedIds.every((id) => fault.beyondIds.includes(id)));
        const carriedMW = seg.feedIds.reduce(
          (sum, id) => sum + (turbineMap[id]?.powerOutputMW ?? 0),
          0,
        );
        const grade = arrayCableGrade(
          seg.segmentFromOss,
          stringSize(seg.stringNumber),
        );
        const currentA = arrayCableCurrentA(carriedMW);
        const loadFrac = currentA / grade.ratedA;
        const isCollector = seg.toId === "OSS";
        const inString = focus?.stringNumber === seg.stringNumber;
        const isFocus = focus?.key === seg.key;
        const base = 0.55 + Math.min(loadFrac, 1) * 0.35;
        const path = segmentPath(seg);
        return (
          <Fragment key={seg.key}>
            <Polyline
              positions={path}
              pathOptions={{
                color: isFaulted
                  ? "#ef4444"
                  : dead
                    ? deadColor
                    : loadColor(loadFrac),
                weight:
                  (isCollector ? 2.4 : 1.6) +
                  (isFocus || isFaulted ? 2.4 : inString ? 1 : 0),
                opacity:
                  !focus || inString || isFaulted
                    ? isFocus || isFaulted || dead
                      ? 1
                      : base
                    : 0.18,
                dashArray: isFaulted
                  ? undefined
                  : dead
                    ? "3 5"
                    : isCollector
                      ? "6 6"
                      : undefined,
                className: isFaulted
                  ? "array-cable-fault"
                  : isFocus
                    ? "array-cable-focus"
                    : undefined,
                interactive: false,
              }}
            />
            {/* Invisible 14 px hit line — the visible cable is too thin to click */}
            <Polyline
              positions={path}
              pathOptions={{ color: "#000", weight: 14, opacity: 0 }}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e); // keep the map click from clearing it
                  onSelect(seg);
                },
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
                    style={{ color: loadColor(loadFrac) }}
                  >
                    {carriedMW.toFixed(1)} MW · {currentA.toFixed(0)} A ·{" "}
                    {(loadFrac * 100).toFixed(0)}%
                  </div>
                  <div className="text-text-muted">
                    S{seg.stringNumber} · {seg.fromId} → {seg.toId} ·{" "}
                    {seg.lengthKm.toFixed(2)} km
                  </div>
                  <div className="text-text-muted">
                    3-core {grade.mm2} mm² Cu XLPE · 66 kV · {grade.ratedA} A
                  </div>
                  <div className="text-text-muted">
                    Click: show the turbines on this cable
                  </div>
                </div>
              </Tooltip>
            </Polyline>
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * OT fibre network (backend services/p3/network.py, M15): each 66 kV array
 * cable carries a fibre element that daisy-chains the WTG IEDs back to the
 * OSS; the export cable carries the OSS ↔ onshore fibre, backed up by a
 * licensed microwave link.
 */
const FIBRE_STYLE = {
  color: "#22d3ee",
  weight: 1.3,
  opacity: 0.9,
  dashArray: "1 5",
  interactive: false,
};

function FibreComms() {
  const fleet = useFleet();
  const { segments, path: segmentPath } = cableTree(fleet);
  return (
    <>
      {segments.map((seg) => (
        <Polyline
          key={`fo-${seg.key}`}
          positions={segmentPath(seg)}
          pathOptions={FIBRE_STYLE}
        />
      ))}
      {fleet.source === "sb510" && (
      <>
      <Polyline
        positions={[...EXPORT_SUBSEA_PATH, ...EXPORT_LAND_PATH.slice(1)]}
        pathOptions={{ ...FIBRE_STYLE, interactive: true }}
      >
        <Tooltip sticky>
          Fibre in the export cable (OT only) · 10 Gbps · MPLS over fibre +
          IPsec · OSS ↔ onshore
        </Tooltip>
      </Polyline>
      <Polyline
        positions={[
          [fleet.oss.lat, fleet.oss.lon],
          [SB510_ONSHORE_GEO.lat, SB510_ONSHORE_GEO.lon],
        ]}
        pathOptions={{
          color: "#22d3ee",
          weight: 1,
          opacity: 0.55,
          dashArray: "8 8",
        }}
      >
        <Tooltip sticky>
          Licensed microwave backup link · 100 Mbps · OSS ↔ onshore
        </Tooltip>
      </Polyline>
      </>
      )}
    </>
  );
}

/**
 * Fault passage indicators: the WTG switchgear the fault current flowed
 * through (OSS side of the fault) shows a yellow flag — the operator finds
 * the faulted section just beyond the last lit one.
 */
const FPI_ICON = L.divIcon({
  html: `<svg width="16" height="18" viewBox="0 0 16 18"><path d="M3 17V2" stroke="#2b2118" stroke-width="1.4"/><path d="M3 2 14 5 3 8Z" fill="#facc15" stroke="#2b2118" stroke-width="1"/></svg>`,
  className: "leaflet-fpi",
  iconSize: [16, 18],
  iconAnchor: [-10, 30],
});

function FaultPassageIndicators() {
  const fault = useLandingStore((s) => s.arrayFault);
  const { pos } = cableTree(useFleet());
  if (!fault) return null;
  return (
    <>
      {fault.litIds.map((id) => {
        const t = pos.get(id);
        if (!t) return null;
        return (
          <Marker key={`fpi-${id}`} position={[t.lat, t.lon]} icon={FPI_ICON} zIndexOffset={1300}>
            <Tooltip direction="right">
              {id} · fault passage indicator lit — fault current flowed through this switchgear
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** Clears the cable focus on a map click or Escape. */
function CableFocusClearer({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  useEffect(() => {
    const onKey = ({ code }: KeyboardEvent) => {
      if (code === "Escape") onClear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClear]);
  return null;
}

/** Card for the clicked array cable: live load and the turbines it carries. */
function ArrayCableCard({
  seg,
  onClose,
  onSelect,
}: {
  seg: CableFocus;
  onClose: () => void;
  onSelect: (s: CableFocus) => void;
}) {
  // Walk the cable like on the SLD: toward the OSS / toward the far end (first branch)
  const { segments, stringSize } = cableTree(useFleet());
  const towardOss = segments.find((s) => s.fromId === seg.toId);
  const awayFromOss = segments.find((s) => s.toId === seg.fromId);
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const feeds = seg.feedIds
    .map((id) => turbineMap[id])
    .filter((t) => t !== undefined);
  const carriedMW = feeds.reduce((sum, t) => sum + t.powerOutputMW, 0);
  const grade = arrayCableGrade(
    seg.segmentFromOss,
    stringSize(seg.stringNumber),
  );
  const currentA = arrayCableCurrentA(carriedMW);
  const loadFrac = currentA / grade.ratedA;
  const n = stringSize(seg.stringNumber);
  const fleet = useFleet();
  const bay = bayName(seg.stringNumber);
  const section = sectionOf(fleet, seg.stringNumber - 1);
  const fault = useLandingStore((s) => s.arrayFault);
  const injectArrayFault = useLandingStore((s) => s.injectArrayFault);
  const restoreArrayFault = useLandingStore((s) => s.restoreArrayFault);
  const faultHere = fault?.stringNumber === seg.stringNumber ? fault : null;
  const faultSeg = faultHere
    ? segments.find((x) => x.key === faultHere.segmentKey)
    : undefined;
  const report = useTrainingStore((s) => s.report);
  const isolateArrayFault = useLandingStore((s) => s.isolateArrayFault);
  useEffect(() => {
    report({ type: "cable-selected", stringNumber: seg.stringNumber, segmentKey: seg.key });
  }, [report, seg.key, seg.stringNumber]);
  const isolateIn = faultHere
    ? Math.max(
        0,
        Math.ceil(
          (faultHere.trippedAt + ARRAY_FAULT_ISOLATION_MS - Date.now()) / 1000,
        ),
      )
    : 0;

  // During a drill the Scenario panel owns the right edge — sit beside it
  const drill = useTrainingStore((s) => s.active !== null);

  return (
    <div
      className={cn(
        "absolute bottom-8 z-1000 w-80 max-w-[calc(100%-1.5rem)] rounded-lg border border-border-primary bg-bg-primary/95 shadow-lg shadow-black/30 backdrop-blur-sm",
        drill ? "right-[21.5rem]" : "right-3",
      )}
    >
      <div className="flex items-start justify-between border-b border-border-primary/60 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">
            66 kV array cable · String S{seg.stringNumber} ({n} WTG)
          </div>
          <div className="font-mono text-xs font-semibold text-text-primary">
            {seg.fromId} → {seg.toId === "OSS" ? `OSS (${bay})` : seg.toId}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-text-muted hover:bg-bg-secondary hover:text-text-primary"
          aria-label="Close cable details"
        >
          ×
        </button>
      </div>
      <div className="flex justify-between gap-2 border-b border-border-primary/60 px-3 py-1 text-[11px]">
        <button
          type="button"
          disabled={!towardOss}
          onClick={() => towardOss && onSelect(towardOss)}
          className="rounded px-1.5 text-text-secondary hover:bg-bg-secondary disabled:opacity-30"
        >
          ◀ toward OSS
        </button>
        <button
          type="button"
          disabled={!awayFromOss}
          onClick={() => awayFromOss && onSelect(awayFromOss)}
          className="rounded px-1.5 text-text-secondary hover:bg-bg-secondary disabled:opacity-30"
        >
          next section out ▶
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 px-3 py-2 font-mono text-[11px] tabular-nums whitespace-nowrap">
        <span className="text-text-muted">Load</span>
        <span className="text-right" style={{ color: loadColor(loadFrac) }}>
          {carriedMW.toFixed(1)} MW · {currentA.toFixed(0)} A ·{" "}
          {(loadFrac * 100).toFixed(0)} %
        </span>
        <span className="text-text-muted">Cable</span>
        <span className="text-right text-text-primary">
          {grade.mm2} mm² Cu XLPE · {grade.ratedA} A
        </span>
        <span className="text-text-muted">Length (straight)</span>
        <span className="text-right text-text-primary">
          {seg.lengthKm.toFixed(2)} km
        </span>
        <span className="text-text-muted">OSS 66 kV bus</span>
        <span className="text-right text-text-primary">
          section {section} · TX-OSS-0{section === "A" ? 1 : 2}
        </span>
      </div>
      <div className="border-t border-border-primary/60 px-3 py-2">
        <div className="mb-1 text-[10px] uppercase tracking-wider text-text-muted">
          Carries power + fibre (SCADA / IEC 61850) of {feeds.length} WTG
        </div>
        <div className="flex flex-wrap gap-1">
          {feeds.map((t) => (
            <span
              key={t.id}
              className="rounded border px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
              style={{
                borderColor: `${STATUS_COLOR[t.status]}80`,
                color: STATUS_COLOR[t.status],
              }}
            >
              {t.id.replace("WTG-", "")} · {t.powerOutputMW.toFixed(1)}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-text-muted">
          Radial string: each segment carries every turbine beyond it. Feeder CB{" "}
          {bay} at the OSS 66 kV switchboard trips the whole string.
        </p>
      </div>
      <div className="border-t border-border-primary/60 px-3 py-2">
        {!fault && (
          <button
            type="button"
            onClick={() =>
              injectArrayFault({
                segmentKey: seg.key,
                stringNumber: seg.stringNumber,
                stringIds: fleet.strings[seg.stringNumber - 1],
                beyondIds: seg.feedIds,
              })
            }
            className="w-full rounded border border-[#ef4444]/60 px-2 py-1 text-[11px] font-semibold text-[#ef4444] hover:bg-[#ef4444]/10"
          >
            Simulate cable fault on this section
          </button>
        )}
        {fault && !faultHere && (
          <p className="text-[10px] text-text-muted">
            Cable fault active on string S{fault.stringNumber} — open that
            string to follow or restore it.
          </p>
        )}
        {faultHere && faultSeg && (
          <div className="space-y-1 font-mono text-[10px] leading-snug">
            <div className="text-[#ef4444]">
              t+0.1 s ·{" "}
              {faultHere.manual && faultHere.stage === "tripped"
                ? "earth fault on string"
                : `fault ${faultSeg.fromId}→${faultSeg.toId}`}
              : feeder CB {bay}{" "}
              tripped (50/51, 51N) — all {n} WTG of S{seg.stringNumber} lost the
              grid
            </div>
            {faultHere.stage === "tripped" && faultHere.manual ? (
              <button
                type="button"
                onClick={() => {
                  const ok = isolateArrayFault(seg.key);
                  report({ type: "isolate", segmentKey: seg.key, ok });
                }}
                className="w-full rounded border border-[#f5a623]/70 px-2 py-1 font-sans text-[11px] font-semibold text-[#f5a623] hover:bg-[#f5a623]/10"
              >
                Open switch &amp; isolate this section ({seg.fromId}→{seg.toId})
              </button>
            ) : faultHere.stage === "tripped" ? (
              <div className="text-[#f5a623]">
                locating fault · isolating section… (≈ {isolateIn} s,
                time-compressed)
              </div>
            ) : (
              <div className="text-[#3ecf6e]">
                {faultSeg.toId === "OSS"
                  ? "fault is on the feeder cable itself — the string stays off until repair"
                  : `switch at ${faultSeg.toId} opened, CB re-closed: ${faultHere.restorableIds.length} WTG back on line`}
              </div>
            )}
            <div className="text-text-muted">
              {faultHere.beyondIds.length} WTG beyond the fault out until the
              cable is repaired (cable-repair vessel job, weeks offshore).
            </div>
            <button
              type="button"
              onClick={restoreArrayFault}
              className="mt-1 w-full rounded border border-[#3ecf6e]/60 px-2 py-1 font-sans text-[11px] font-semibold text-[#3ecf6e] hover:bg-[#3ecf6e]/10"
            >
              Repair cable & re-energise string
            </button>
          </div>
        )}
      </div>
    </div>
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

// ── Zoom-dependent turbine scale — CSS var on the map container ──
// --wtg-scale drives the icon size (index.css .wtg-svg, scaled about the hub);
// IDs show once the icon is at least base size (≈ zoom 11.5).
function TurbineZoomScaler() {
  const map = useMap();

  useEffect(() => {
    function apply() {
      const scale = turbineIconScale(map.getZoom());
      const el = map.getContainer();
      el.style.setProperty("--wtg-scale", scale.toFixed(3));
      el.classList.toggle("wtg-labels-off", scale < 0.9);
    }
    apply();
    map.on("zoomend", apply);
    return () => {
      map.off("zoomend", apply);
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

  const fleet = useFleet();
  if (zoom < 14) return null;

  return (
    <>
      {fleet.turbines.map((pos) => (
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
const toLatLng = (p: { lat: number; lon: number }): [number, number] => [
  p.lat,
  p.lon,
];
/** Subsea section (OSS → landfall) and land section (landfall → onshore SS). */
const EXPORT_SUBSEA_PATH = EXPORT_CABLE_SUBSEA_GEO.map(toLatLng);
const EXPORT_LAND_PATH = EXPORT_CABLE_LAND_GEO.map(toLatLng);
const PSE_GRID_PATH: [number, number][] = PSE_GRID_LINE_GEO.map((p) => [
  p.lat,
  p.lon,
]);

/** View of an own fleet: turbines and OSS, ≈ 2 km margin (the export line may leave the view). */
function fleetBounds(f: Fleet): [[number, number], [number, number]] {
  const pts = [...f.turbines, f.oss];
  const lats = pts.map((p) => p.lat);
  const lons = pts.map((p) => p.lon);
  return [
    [Math.min(...lats) - 0.02, Math.min(...lons) - 0.03],
    [Math.max(...lats) + 0.02, Math.max(...lons) + 0.03],
  ];
}

/** Re-frame the map when the live fleet changes (own project ↔ SB-510). */
function FitFleet() {
  const map = useMap();
  const fleet = useFleet();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false; // the container's bounds already frame it
      return;
    }
    // top padding clears the KPI strip drawn over the map
    map.fitBounds(fleet.source === "sb510" ? FARM_VIEW_BOUNDS : fleetBounds(fleet), {
      paddingTopLeft: [24, 130],
      paddingBottomRight: [24, 24],
    });
  }, [map, fleet]);
  return null;
}

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
  const fleet = useFleet();
  // labels face away from the array: an OSS on its west side (SB-510) labels to the left
  const ossWest = useMemo(() => fleet.oss.lon < fleet.turbines.reduce((a, t) => a + t.lon, 0) / fleet.turbines.length, [fleet]);
  const ossIcon = useMemo(() => createOSSIcon(totalPowerMW, fleet.net.oss_trafo_mva, ossWest), [totalPowerMW, fleet, ossWest]);
  const onshoreIcon = useMemo(() => createOnshoreIcon(fleet.net.onshore_trafo_mva), [fleet]);
  // STATCOM Q: pandapower when the backend solves, else the reactive-balance
  // estimate (store/liveGridStore) — the same number as the ribbon and panel.
  const statcomQ = Math.round(useStatcomQ(totalPowerMW).q);
  const statcomIcon = useMemo(() => createSTATCOMIcon(statcomQ, ossWest), [statcomQ, ossWest]);
  // Grid switchyard breaker is closed whenever the farm is exporting power.
  const isExporting = totalPowerMW > 0.5;
  const switchyardIcon = useMemo(
    () => createGridSwitchyardIcon(isExporting),
    [isExporting],
  );
  // Floating LIDAR met mast — independent wind reference for resource validation.
  // Reads the freestream (un-waked) wind from the KPI stream, rounded to 0.1 m/s.
  const farmKpis = useLandingStore(selectKPIs);
  const lidarWindMs = Math.round(farmKpis.freestreamWindMs * 10) / 10;
  const lidarWindDir = Math.round(farmKpis.windDirectionDeg / 5) * 5;
  const metMastIcon = useMemo(
    () => createMetMastIcon(lidarWindMs, lidarWindDir),
    [lidarWindMs, lidarWindDir],
  );
  const layers = useLayerStore((s) => s.layers);
  const mapTheme = useLayerStore((s) => s.mapTheme);
  // SB-510's surveyed export route, landfall, onshore yard and met mast; an own project has none yet
  const sb510 = fleet.source === "sb510";
  const ossAt: [number, number] = [fleet.oss.lat, fleet.oss.lon];
  const [cableFocus, setCableFocus] = useState<CableFocus | null>(null);
  const clearCableFocus = useCallback(() => setCableFocus(null), []);
  // a focus belongs to one fleet
  useEffect(() => setCableFocus(null), [fleet]);

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
        bounds={sb510 ? FARM_VIEW_BOUNDS : fleetBounds(fleet)}
        boundsOptions={{ paddingTopLeft: [24, 130], paddingBottomRight: [24, 24] }}
        zoomSnap={0.25}
        zoomDelta={0.5}
        className="w-full h-full"
        style={{ background: mapTheme === "storybook" ? "#3f8d86" : "#0a1628" }}
        zoomControl={false}
      >
        <InvalidateSize />
        <FitFleet />

        {/* Custom pane for atmospheric overlays (z: 250, between tiles and markers) */}
        <AtmosphericPanes />

        {/* Storybook theme demo: teal sea, inked coast, paper grain */}
        {mapTheme === "storybook" && <StorybookSurface />}

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

        {/* OWF site boundary (turbine envelope + ≈ 500 m safety zone; own project: the drawn site) */}
        {layers.exclusionZone && fleet.boundary.length > 2 && (
          <Polygon
            positions={fleet.boundary}
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

        {/* SwePol HVDC + neighbouring planned OWF areas */}
        {layers.gridContext && <GridContext />}

        {/* 500 m safety zones (UNCLOS Art. 60) */}
        {layers.safetyZones && <SafetyZones />}

        {/* Jensen/Park wake effect cones + loss badges */}
        {layers.wakeEffects && <WakeEffectLayer />}

        {/* 66 kV array cables */}
        {layers.arrayCables && (
          <ArrayCables focus={cableFocus} onSelect={setCableFocus} />
        )}
        <CableFocusClearer onClear={clearCableFocus} />

        {/* Fault passage indicators (array cable fault) */}
        <FaultPassageIndicators />

        {/* Live AIS traffic + export cable DTS */}
        {layers.aisTraffic && <AisTraffic />}
        {layers.cableDts && sb510 && <CableDtsLayer />}

        {/* Fibre-optic SCADA network */}
        {layers.fibreComms && <FibreComms />}

        {/* IALA lights on the periphery + cardinal marks */}
        {layers.navAids && sb510 && <NavAids />}

        {/* O&M vessels (SOV / CTV) */}
        {layers.vessels && sb510 && <Vessels />}
        {layers.vessels && <RepairCrews />}

        {/* Own project: straight line to the grid node — the route is not surveyed yet */}
        {!sb510 && fleet.grid && (
          <Polyline
            positions={[ossAt, [fleet.grid.lat, fleet.grid.lon]]}
            pathOptions={{ color: SCADA_COLORS.VOLTAGE_220KV, weight: 3, opacity: 0.85, dashArray: "8 12" }}
            eventHandlers={cableHandlers}
          >
            <Tooltip sticky>
              {fleet.net.num_export_cables} × 220 kV export · {fleet.net.export_length_km.toFixed(0)} km design length ·
              straight line to {fleet.grid.name} (route not yet surveyed)
            </Tooltip>
          </Polyline>
        )}
        {!sb510 && fleet.grid && (
          <Marker position={[fleet.grid.lat, fleet.grid.lon]} icon={onshoreIcon} eventHandlers={onshoreHandlers} zIndexOffset={1000} />
        )}

        {sb510 && (
        <>
        {/* 2 × 220 kV export cables — subsea section (animated dashes) */}
        <Polyline
          positions={EXPORT_SUBSEA_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 4,
            opacity: 0.3,
            interactive: false,
          }}
        />
        <Polyline
          positions={EXPORT_SUBSEA_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 3,
            opacity: 0.9,
            dashArray: "8 12",
            className: "leaflet-export-cable-animated",
            interactive: false,
          }}
        />
        {/* Land section — underground cable, drawn solid-thin */}
        <Polyline
          positions={EXPORT_LAND_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_220KV,
            weight: 2.5,
            opacity: 0.85,
            dashArray: "2 5",
            interactive: false,
          }}
        />
        {/* Invisible 18 px hit areas — the visible lines are too thin to click */}
        {[EXPORT_SUBSEA_PATH, EXPORT_LAND_PATH].map((path, i) => (
          <Polyline
            key={i}
            positions={path}
            pathOptions={{ color: "#000", weight: 18, opacity: 0 }}
            eventHandlers={cableHandlers}
          />
        ))}
        {/* Landfall — transition joint pit behind the beach (HDD under the dunes) */}
        <CircleMarker
          center={[LANDFALL_GEO.lat, LANDFALL_GEO.lon]}
          radius={4}
          pathOptions={{
            color: "#0a0e15",
            weight: 1.5,
            fillColor: SCADA_COLORS.VOLTAGE_220KV,
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="left" offset={[-6, 0]}>
            Landfall · Zaleskie beach (HDD) — 63.5 km subsea + 13 km land
          </Tooltip>
        </CircleMarker>

        {/* PSE grid connection line */}
        <Polyline
          positions={PSE_GRID_PATH}
          pathOptions={{
            color: SCADA_COLORS.VOLTAGE_400KV,
            weight: 3,
            opacity: 0.7,
          }}
        />
        </>
        )}

        {/* Offshore Substation marker (z above turbines) */}
        <Marker
          position={ossAt}
          icon={ossIcon}
          eventHandlers={ossHandlers}
          zIndexOffset={1000}
        />

        {/* STATCOM — ±120 MVAr on the OSS 220 kV busbar (same platform), so
            its chip is anchored on the OSS position, drawn above the OSS chip. */}
        <Marker
          position={ossAt}
          icon={statcomIcon}
          eventHandlers={statcomHandlers}
          zIndexOffset={950}
        />

        {sb510 && (
        <>
        {/* Onshore Substation marker (z above turbines) */}
        <Marker
          position={[SB510_ONSHORE_GEO.lat, SB510_ONSHORE_GEO.lon]}
          icon={onshoreIcon}
          eventHandlers={onshoreHandlers}
          zIndexOffset={1000}
        />

        {/* PSE 400/110 kV substation "Słupsk Wierzbięcino" (real, OSM) */}
        <Marker
          position={[PSE_SUBSTATION_GEO.lat, PSE_SUBSTATION_GEO.lon]}
          icon={switchyardIcon}
          zIndexOffset={950}
        />

        {/* Floating LIDAR — 3 km upwind (SW) of the array for the prevailing
            wind, so it measures freestream, not wakes. */}
        <Marker
          position={[LIDAR_GEO.lat, LIDAR_GEO.lon]}
          icon={metMastIcon}
          eventHandlers={metMastHandlers}
          zIndexOffset={1100}
        />
        </>
        )}

        {/* Turbine label visibility (CSS class toggle) */}
        <TurbineLabelToggler />

        {/* Zoom-dependent turbine scaling (CSS class toggle on container) */}
        <TurbineZoomScaler />

        {/* Monopile foundation circles (zoom ≥ 14) */}
        {layers.foundations && <FoundationLayer />}

        {/* Zoom-dependent turbine detail (power labels, pitch arcs, sway) */}
        <TurbineDetailOverlay />

        {/* Turbine markers */}
        {fleet.turbines.map((pos) => (
          <TurbineMarker
            key={pos.id}
            turbineId={pos.id}
            lat={pos.lat}
            lon={pos.lon}
            isSelected={selectedTurbineId === pos.id}
            focus={
              cableFocus
                ? cableFocus.feedIds.includes(pos.id)
                  ? "feed"
                  : pos.stringNumber === cableFocus.stringNumber
                    ? undefined
                    : "dim"
                : undefined
            }
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

      {/* Clicked array cable: load + the turbines it carries */}
      {cableFocus && layers.arrayCables && (
        <ArrayCableCard seg={cableFocus} onClose={clearCableFocus} onSelect={setCableFocus} />
      )}

      {/* Training drills + grid events */}
      <ScenarioCenter />

      {/* Compass overlay */}
      <WindCompass />
    </div>
  );
}

export default memo(LeafletWindFarmMapInner);
