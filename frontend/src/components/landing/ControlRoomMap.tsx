/**
 * Control Room map — MapLibre GL base + deck.gl data layers (redesign phase 3).
 *
 * The base is drawn from our own geometry, no tile server: land is the map
 * background, the sea is the coastline polygon (constants/windFarmLayout), and
 * the site boundary is a dashed line. deck.gl draws what changes: the 66 kV
 * array cables coloured by load, the export cables with energy particles that
 * run faster as the farm exports more, the turbines by state, the equipment
 * marks and labels that appear as you zoom in.
 *
 * Colour follows ISA-101: running turbines and normal cable loads are neutral;
 * amber / red mark only what needs attention; cyan is live energy.
 *
 * Same props as the classic Leaflet map (LeafletWindFarmMap), so the Control
 * Room's detail panels work unchanged. Turbines are also offered as a
 * keyboard / screen-reader list (the WebGL canvas is not focusable).
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibre } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { WebMercatorViewport, type MapViewState, type PickingInfo } from "@deck.gl/core";
import { IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Layers, Minus, Plus } from "lucide-react";

import {
  EXPORT_CABLE_LAND_GEO,
  EXPORT_CABLE_SUBSEA_GEO,
  FARM_VIEW_BOUNDS,
  LANDFALL_GEO,
  LIDAR_GEO,
  ONSHORE_GEO,
  PSE_GRID_LINE_GEO,
  PSE_SUBSTATION_GEO,
  PSE_SUBSTATION_NAME,
  SEA_POLYGON_GEO,
} from "../../constants/windFarmLayout";
import { cableTree, distanceM, type CableFocus } from "../../lib/arrayCables";
import { useFleet, type Fleet } from "../../lib/fleet";
import { selectKPIs, useLandingStore } from "../../store/landingStore";
import { useLayerStore } from "../../store/layerStore";
import { useStatcomQ } from "../../store/liveGridStore";
import type { TurbineStatus } from "../../types/landing";
import { arrayCableCurrentA, arrayCableGrade, farmWakeDeficits, wakePowerLossPct } from "../../utils/landingPhysics";
import { wakeConePoly } from "../../utils/wakeModel";

import AlarmTicker from "./AlarmTicker";
import ArrayCableCard from "./ArrayCableCard";
import EnvironmentPanel from "./EnvironmentPanel";
import MapLayersMenu from "./MapLayersMenu";
import ScenarioCenter from "./ScenarioCenter";

export interface FarmMapProps {
  totalPowerMW: number;
  selectedTurbineId: string | null;
  onTurbineClick: (id: string) => void;
  onOSSClick: () => void;
  onOnshoreClick: () => void;
  onCableClick: () => void;
  onSTATCOMClick?: () => void;
  onLIDARClick?: () => void;
}

type RGBA = [number, number, number, number];

/** Map palettes: Baltic Night (control room) and storybook paper. */
const PALETTES = {
  hmi: {
    land: "#101c27",
    sea: "#0a1622",
    coast: "#22384d",
    boundary: "#2c4760",
    turbine: [213, 225, 236, 255] as RGBA,
    hollow: [10, 21, 32, 255] as RGBA,
    offline: [86, 112, 138, 255] as RGBA,
    warn: [240, 177, 62, 255] as RGBA,
    alarm: [242, 92, 84, 255] as RGBA,
    accent: [69, 200, 217, 255] as RGBA,
    v66: [229, 181, 103, 255] as RGBA,
    v220: [143, 180, 245, 255] as RGBA,
    v400: [232, 131, 122, 255] as RGBA,
    text: [163, 182, 200, 255] as RGBA,
    label: [228, 236, 243, 255] as RGBA,
    labelBg: [15, 29, 43, 230] as RGBA,
    ink: "#e4ecf3",
  },
  storybook: {
    land: "#e8d8b0",
    sea: "#3f8d86",
    coast: "#2b2118",
    boundary: "#2b2118",
    turbine: [43, 33, 24, 255] as RGBA,
    hollow: [241, 228, 195, 255] as RGBA,
    offline: [107, 98, 87, 255] as RGBA,
    warn: [154, 90, 0, 255] as RGBA,
    alarm: [180, 35, 24, 255] as RGBA,
    accent: [246, 238, 219, 255] as RGBA,
    v66: [154, 90, 0, 255] as RGBA,
    v220: [29, 78, 216, 255] as RGBA,
    v400: [180, 35, 24, 255] as RGBA,
    text: [43, 33, 24, 255] as RGBA,
    label: [43, 33, 24, 255] as RGBA,
    labelBg: [247, 237, 212, 235] as RGBA,
    ink: "#2b2118",
  },
};
type Palette = (typeof PALETTES)["hmi"];

const alpha = (c: RGBA, a: number): RGBA => [c[0], c[1], c[2], a];
const ll = (p: { lat: number; lon: number }): [number, number] => [p.lon, p.lat];
const swap = (p: [number, number]): [number, number] => [p[1], p[0]];

/** Equipment marks as small SVG icons (deck.gl IconLayer). */
function svgIcon(svg: string) {
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, width: 48, height: 48, anchorY: 24 };
}
function equipmentIcons(ink: string, fill: string) {
  return {
    oss: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect x="6" y="6" width="36" height="36" fill="${fill}" stroke="${ink}" stroke-width="4"/><path d="M14 24h20M24 14v20" stroke="${ink}" stroke-width="4"/></svg>`),
    onshore: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect x="6" y="6" width="36" height="36" fill="${fill}" stroke="${ink}" stroke-width="4"/><circle cx="19" cy="24" r="7" fill="none" stroke="${ink}" stroke-width="3"/><circle cx="29" cy="24" r="7" fill="none" stroke="${ink}" stroke-width="3"/></svg>`),
    grid: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect x="6" y="6" width="36" height="36" fill="${fill}" stroke="${ink}" stroke-width="4"/><path d="M14 18h20M14 24h20M14 30h20" stroke="${ink}" stroke-width="3"/></svg>`),
    lidar: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path d="M24 4 44 24 24 44 4 24z" fill="${fill}" stroke="${ink}" stroke-width="4"/><circle cx="24" cy="24" r="5" fill="${ink}"/></svg>`),
    landfall: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="14" fill="${fill}" stroke="${ink}" stroke-width="5"/></svg>`),
  };
}

/** Base map style from our own geometry: land background, sea polygon, coastline, site boundary. */
function baseStyle(pal: Palette, fleet: Fleet, showBoundary: boolean): StyleSpecification {
  const ring = (pts: [number, number][]) => [...pts.map(swap), swap(pts[0])];
  return {
    version: 8,
    sources: {
      sea: { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring(SEA_POLYGON_GEO)] } } },
      site: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: fleet.boundary.length > 2 ? [ring(fleet.boundary)] : [] },
        },
      },
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": pal.land } },
      { id: "sea", type: "fill", source: "sea", paint: { "fill-color": pal.sea } },
      { id: "coast", type: "line", source: "sea", paint: { "line-color": pal.coast, "line-width": 1.2 } },
      {
        id: "site",
        type: "line",
        source: "site",
        layout: { visibility: showBoundary ? "visible" : "none" },
        paint: { "line-color": pal.boundary, "line-width": 1.2, "line-dasharray": [4, 3] },
      },
    ],
  };
}

/** Points along a polyline at fractions 0…1 of its length. */
function along(path: [number, number][]) {
  const seg = path.slice(1).map((p, i) => distanceM(swap(path[i]), swap(p)));
  const total = seg.reduce((a, b) => a + b, 0);
  return (frac: number): [number, number] => {
    let d = frac * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i]) {
        const t = seg[i] ? d / seg[i] : 0;
        return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
      }
      d -= seg[i];
    }
    return path[path.length - 1];
  };
}

/** A clock that ticks ~30 times a second while `on` (energy particles); still when reduced motion is asked for. */
function usePhase(on: boolean) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (now - last > 33) {
        setPhase((p) => p + (now - last) / 1000);
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return phase;
}

const STATUS_WORD: Record<TurbineStatus, string> = {
  operating: "operating",
  curtailed: "curtailed",
  fault: "fault",
  offline: "stopped",
};

function ControlRoomMapInner({
  totalPowerMW,
  selectedTurbineId,
  onTurbineClick,
  onOSSClick,
  onOnshoreClick,
  onCableClick,
  onSTATCOMClick,
  onLIDARClick,
}: FarmMapProps) {
  const fleet = useFleet();
  const sb510 = fleet.source === "sb510";
  const theme = useLayerStore((s) => s.mapTheme);
  const layers = useLayerStore((s) => s.layers);
  const pal = PALETTES[theme];
  const turbineMap = useLandingStore((s) => s.turbineMap);
  const fault = useLandingStore((s) => s.arrayFault);
  const kpis = useLandingStore(selectKPIs);
  const statcomQ = Math.round(useStatcomQ(totalPowerMW).q);
  const exporting = totalPowerMW > 0.5;
  const boxRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<MapViewState | null>(null);
  const zoom = viewState?.zoom ?? 11;
  const [focus, setFocus] = useState<CableFocus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setFocus(null), [fleet]);

  const style = useMemo(() => baseStyle(pal, fleet, layers.exclusionZone), [pal, fleet, layers.exclusionZone]);
  const icons = useMemo(() => equipmentIcons(pal.ink, theme === "hmi" ? "#0f1d2b" : "#f7edd4"), [pal, theme]);

  // Initial view: the array (SB-510's framing) or the own project's turbines
  const bounds = useMemo((): [[number, number], [number, number]] => {
    if (sb510) return [swap(FARM_VIEW_BOUNDS[0]), swap(FARM_VIEW_BOUNDS[1])];
    const lats = fleet.turbines.map((t) => t.lat).concat(fleet.oss.lat);
    const lons = fleet.turbines.map((t) => t.lon).concat(fleet.oss.lon);
    return [
      [Math.min(...lons) - 0.02, Math.min(...lats) - 0.02],
      [Math.max(...lons) + 0.02, Math.max(...lats) + 0.02],
    ];
  }, [fleet, sb510]);
  // Fit the view to the farm once the box has a size, and again when the farm changes
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return false;
      const v = new WebMercatorViewport({ width, height }).fitBounds(bounds, { padding: 32 });
      setViewState({ longitude: v.longitude, latitude: v.latitude, zoom: v.zoom, pitch: 0, bearing: 0 });
      return true;
    };
    if (fit()) return;
    const ro = new ResizeObserver(() => fit() && ro.disconnect());
    ro.observe(el);
    return () => ro.disconnect();
  }, [bounds]);
  const zoomBy = (dz: number) =>
    setViewState((v) => v && { ...v, zoom: Math.max(7, Math.min(16, v.zoom + dz)), transitionDuration: 250 });

  // ── Export route (SB-510's surveyed route; an own project: a straight line to its grid node)
  const exportSubsea = useMemo(
    () => (sb510 ? EXPORT_CABLE_SUBSEA_GEO.map(ll) : fleet.grid ? [ll(fleet.oss), ll(fleet.grid)] : []),
    [fleet, sb510],
  );
  const exportLand = useMemo(() => (sb510 ? EXPORT_CABLE_LAND_GEO.map(ll) : []), [sb510]);
  const flowPath = useMemo(() => [...exportSubsea, ...exportLand.slice(1)], [exportSubsea, exportLand]);
  const flowAt = useMemo(() => (flowPath.length > 1 ? along(flowPath) : null), [flowPath]);

  // Particles run 4–12 % of the route per second, faster as the farm exports more
  const phase = usePhase(exporting && !!flowAt);
  const loadShare = Math.min(1, totalPowerMW / fleet.net.total_capacity_mw);
  const particles = useMemo(() => {
    if (!flowAt || !exporting) return [];
    const n = 28;
    const run = phase * (0.04 + 0.08 * loadShare);
    return Array.from({ length: n }, (_, i) => ({ position: flowAt((i / n + run) % 1) }));
  }, [flowAt, exporting, phase, loadShare]);

  // ── Array cables: neutral 66 kV colour, red above 100 % of the rating or faulted, slate when dead
  const tree = useMemo(() => cableTree(fleet), [fleet]);
  const cables = useMemo(
    () =>
      tree.segments.map((seg) => {
        const located = !fault?.manual || fault.stage !== "tripped";
        const faulted = located && fault?.segmentKey === seg.key;
        const dead =
          !!fault &&
          fault.stringNumber === seg.stringNumber &&
          (fault.stage === "tripped" || seg.feedIds.every((id) => fault.beyondIds.includes(id)));
        const mw = seg.feedIds.reduce((sum, id) => sum + (turbineMap[id]?.powerOutputMW ?? 0), 0);
        const grade = arrayCableGrade(seg.segmentFromOss, tree.stringSize(seg.stringNumber));
        const amps = arrayCableCurrentA(mw);
        return { seg, path: tree.path(seg).map(swap), mw, amps, grade, load: amps / grade.ratedA, faulted, dead };
      }),
    [tree, fault, turbineMap],
  );

  // ── Turbines
  const turbines = useMemo(
    () =>
      fleet.turbines.map((t) => {
        const d = turbineMap[t.id];
        return {
          id: t.id,
          short: t.id.replace("WTG-", ""),
          position: ll(t) as [number, number],
          status: (d?.status ?? "operating") as TurbineStatus,
          mw: d?.powerOutputMW ?? 0,
          wind: d?.windSpeedMs ?? 0,
        };
      }),
    [fleet, turbineMap],
  );
  const attention = turbines.filter((t) => t.status === "curtailed" || t.status === "fault");

  // ── Wakes (Bastankhah, Ct(v)) — envelopes plus the worst few losses
  const windDir = Math.round(kpis.windDirectionDeg);
  const freeMs = Math.round(kpis.freestreamWindMs * 2) / 2;
  const wakes = useMemo(() => {
    if (!layers.wakeEffects) return { cones: [], badges: [] };
    const cones = fleet.turbines.map((t) => ({ polygon: wakeConePoly(t.lat, t.lon, windDir).map(swap) }));
    const pos = new Map(turbines.map((t) => [t.id, t.position]));
    const badges = [...farmWakeDeficits(windDir, fleet, freeMs)]
      .map(([id, deficit]) => ({ id, loss: Math.round(wakePowerLossPct(freeMs, deficit)), position: pos.get(id)! }))
      .filter((b) => b.loss >= 10 && b.position)
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 6);
    return { cones, badges };
  }, [layers.wakeEffects, fleet, windDir, freeMs, turbines]);

  // ── Equipment
  const ossAt = ll(fleet.oss);
  const equipment = useMemo(() => {
    const items: { kind: keyof typeof icons; position: [number, number]; name: string }[] = [
      { kind: "oss", position: ossAt, name: "OSS" },
    ];
    if (sb510) {
      items.push(
        { kind: "onshore", position: ll(ONSHORE_GEO), name: "Onshore substation" },
        { kind: "grid", position: ll(PSE_SUBSTATION_GEO), name: PSE_SUBSTATION_NAME },
        { kind: "lidar", position: ll(LIDAR_GEO), name: "LIDAR" },
        { kind: "landfall", position: ll(LANDFALL_GEO), name: "Landfall" },
      );
    } else if (fleet.grid) {
      items.push({ kind: "grid", position: ll(fleet.grid), name: fleet.grid.name });
    }
    return items;
  }, [ossAt, sb510, fleet]);

  const labels = useMemo(() => {
    const out: { position: [number, number]; text: string; kind: string; color: RGBA }[] = [
      { position: ossAt, text: `OSS 66/220 kV · ${totalPowerMW.toFixed(0)} MW`, kind: "oss", color: pal.label },
      { position: ossAt, text: `STATCOM ${statcomQ >= 0 ? "+" : ""}${statcomQ} Mvar`, kind: "statcom", color: pal.text },
    ];
    if (sb510) {
      out.push({ position: ll(LANDFALL_GEO), text: "Landfall · Darłówko", kind: "landfall", color: pal.text });
      out.push({ position: ll(PSE_SUBSTATION_GEO), text: `${PSE_SUBSTATION_NAME} 400 kV`, kind: "grid", color: pal.text });
      if (zoom >= 11.5) out.push({ position: ll(LIDAR_GEO), text: `LIDAR ${kpis.freestreamWindMs.toFixed(1)} m/s`, kind: "lidar", color: pal.text });
    }
    for (const t of attention) {
      out.push({ position: t.position, text: `${t.id} · ${t.mw.toFixed(1)} MW`, kind: "turbine", color: t.status === "fault" ? pal.alarm : pal.warn });
    }
    return out;
  }, [ossAt, totalPowerMW, statcomQ, sb510, zoom, kpis.freestreamWindMs, attention, pal]);

  const onLayerClick = useCallback(
    (info: PickingInfo) => {
      const o = info.object as { kind?: string; id?: string; seg?: CableFocus } | undefined;
      if (!o) return false;
      if (o.seg) setFocus(o.seg);
      else if (o.id && info.layer?.id === "turbines") onTurbineClick(o.id);
      else if (o.kind === "oss") onOSSClick();
      else if (o.kind === "statcom") (onSTATCOMClick ?? onOSSClick)();
      else if (o.kind === "lidar") onLIDARClick?.();
      else if (o.kind === "onshore" || o.kind === "grid") onOnshoreClick();
      else if (o.kind === "export") onCableClick();
      return true;
    },
    [onTurbineClick, onOSSClick, onSTATCOMClick, onLIDARClick, onOnshoreClick, onCableClick],
  );

  const deckLayers = [
    layers.wakeEffects &&
      new PolygonLayer({
        id: "wakes",
        data: wakes.cones,
        getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
        getFillColor: alpha(pal.accent, theme === "hmi" ? 14 : 40),
        stroked: false,
        updateTriggers: { getFillColor: theme },
      }),
    // 400 kV line to the PSE substation, and the export cables (glow while exporting)
    sb510 &&
      new PathLayer({
        id: "grid-line",
        data: [{ path: PSE_GRID_LINE_GEO.map(ll) }],
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: alpha(pal.v400, 200),
        widthUnits: "pixels",
        getWidth: 2.5,
      }),
    exporting &&
      new PathLayer({
        id: "export-glow",
        data: [{ path: exportSubsea }, { path: exportLand }],
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: alpha(pal.accent, 45),
        widthUnits: "pixels",
        getWidth: 9,
        capRounded: true,
        jointRounded: true,
      }),
    new PathLayer({
      id: "export",
      data: [
        { path: exportSubsea, kind: "export" },
        { path: exportLand, kind: "export" },
      ],
      getPath: (d: { path: [number, number][] }) => d.path,
      getColor: alpha(pal.v220, 210),
      widthUnits: "pixels",
      getWidth: 3,
      widthMinPixels: 3,
      pickable: true,
      capRounded: true,
      jointRounded: true,
    }),
    layers.arrayCables &&
      new PathLayer({
        id: "array-cables",
        data: cables,
        getPath: (d: (typeof cables)[number]) => d.path,
        getColor: (d: (typeof cables)[number]) => {
          const dim = focus && focus.stringNumber !== d.seg.stringNumber && !d.faulted;
          // red only for a fault or an overload: 95 % at rated output is the graded design point, not an alarm
          const c = d.faulted || d.load > 1 ? pal.alarm : d.dead ? pal.offline : pal.v66;
          return alpha(c, dim ? 50 : focus?.key === d.seg.key || d.faulted ? 255 : 170);
        },
        getWidth: (d: (typeof cables)[number]) =>
          (d.seg.toId === "OSS" ? 2.4 : 1.6) + (focus?.key === d.seg.key || d.faulted ? 2.4 : focus?.stringNumber === d.seg.stringNumber ? 1 : 0),
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: [focus, pal], getWidth: focus },
      }),
    particles.length > 0 &&
      new ScatterplotLayer({
        id: "energy",
        data: particles,
        getPosition: (d: { position: [number, number] }) => d.position,
        getFillColor: pal.accent,
        radiusUnits: "pixels",
        getRadius: 2.6,
        updateTriggers: { getPosition: phase },
      }),
    // Turbines: neutral when running; amber / red only when they need attention
    new ScatterplotLayer({
      id: "turbines",
      data: turbines,
      getPosition: (d: (typeof turbines)[number]) => d.position,
      getFillColor: (d: (typeof turbines)[number]) =>
        d.status === "fault" ? pal.alarm : d.status === "curtailed" ? pal.warn : d.status === "offline" ? pal.hollow : pal.turbine,
      getLineColor: pal.offline,
      getLineWidth: (d: (typeof turbines)[number]) => (d.status === "offline" ? 1.5 : 0),
      lineWidthUnits: "pixels",
      stroked: true,
      radiusUnits: "meters",
      getRadius: 75,
      radiusMinPixels: 3.5,
      radiusMaxPixels: 9,
      pickable: true,
      updateTriggers: { getFillColor: [turbineMap, pal], getLineWidth: turbineMap },
    }),
    new ScatterplotLayer({
      id: "turbine-rings",
      data: [...attention, ...turbines.filter((t) => t.id === selectedTurbineId)],
      getPosition: (d: (typeof turbines)[number]) => d.position,
      getLineColor: (d: (typeof turbines)[number]) =>
        d.id === selectedTurbineId ? pal.accent : d.status === "fault" ? pal.alarm : pal.warn,
      filled: false,
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      radiusUnits: "pixels",
      getRadius: 10,
      updateTriggers: { getLineColor: [selectedTurbineId, pal] },
    }),
    new IconLayer({
      id: "equipment",
      data: equipment,
      getPosition: (d: (typeof equipment)[number]) => d.position,
      getIcon: (d: (typeof equipment)[number]) => icons[d.kind],
      getSize: (d: (typeof equipment)[number]) => (d.kind === "landfall" ? 12 : 18),
      sizeUnits: "pixels",
      pickable: true,
      updateTriggers: { getIcon: icons },
    }),
    new TextLayer({
      id: "labels",
      data: labels,
      getPosition: (d: (typeof labels)[number]) => d.position,
      getText: (d: (typeof labels)[number]) => d.text,
      getColor: (d: (typeof labels)[number]) => d.color,
      getSize: 12,
      sizeUnits: "pixels",
      fontFamily: "IBM Plex Mono, monospace",
      characterSet: "auto",
      getTextAnchor: "start",
      getAlignmentBaseline: "center",
      getPixelOffset: (d: (typeof labels)[number]) => (d.kind === "statcom" ? [16, 16] : d.kind === "turbine" ? [14, 0] : [16, 0]),
      background: true,
      getBackgroundColor: (d: (typeof labels)[number]) => (d.kind === "statcom" ? [0, 0, 0, 0] : pal.labelBg),
      backgroundPadding: [5, 3],
      pickable: true,
      updateTriggers: { getColor: pal, getBackgroundColor: pal },
    }),
    layers.wakeEffects &&
      wakes.badges.length > 0 &&
      new TextLayer({
        id: "wake-badges",
        data: wakes.badges,
        getPosition: (d: (typeof wakes.badges)[number]) => d.position,
        getText: (d: (typeof wakes.badges)[number]) => `−${d.loss} %`,
        characterSet: "auto",
        getColor: pal.text,
        getSize: 12,
        sizeUnits: "pixels",
        fontFamily: "IBM Plex Mono, monospace",
        getTextAnchor: "start",
        getPixelOffset: [12, 10],
      }),
    layers.turbineLabels &&
      zoom >= 12.5 &&
      new TextLayer({
        id: "turbine-ids",
        data: turbines,
        getPosition: (d: (typeof turbines)[number]) => d.position,
        getText: (d: (typeof turbines)[number]) => d.short,
        getColor: pal.text,
        getSize: 12,
        sizeUnits: "pixels",
        fontFamily: "IBM Plex Mono, monospace",
        getPixelOffset: [0, 16],
      }),
  ].filter(Boolean);

  const tooltip = useCallback(
    (info: PickingInfo) => {
      const o = info.object as Record<string, unknown> | undefined;
      if (!o) return null;
      const box = {
        background: theme === "hmi" ? "#172a3d" : "#f7edd4",
        color: pal.ink,
        border: `1px solid ${theme === "hmi" ? "#2c4760" : "#2b2118"}`,
        borderRadius: "4px",
        padding: "6px 8px",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: "12px",
      };
      if (info.layer?.id === "turbines") {
        const t = o as unknown as (typeof turbines)[number];
        return { text: `${t.id} · ${STATUS_WORD[t.status]}\n${t.mw.toFixed(1)} MW · ${t.wind.toFixed(1)} m/s`, style: box };
      }
      if (info.layer?.id === "array-cables") {
        const c = o as unknown as (typeof cables)[number];
        return {
          text: `S${c.seg.stringNumber} · ${c.seg.fromId} → ${c.seg.toId} · ${c.seg.lengthKm.toFixed(2)} km\n${c.mw.toFixed(1)} MW · ${c.amps.toFixed(0)} A · ${(c.load * 100).toFixed(0)} % of ${c.grade.ratedA} A (${c.grade.mm2} mm²)\nclick: the turbines on this cable`,
          style: box,
        };
      }
      if (info.layer?.id === "export") {
        return {
          text: `${fleet.net.num_export_cables} × 220 kV export · ${fleet.net.export_length_km.toFixed(0)} km${sb510 ? "" : " (straight line: route not surveyed)"}`,
          style: box,
        };
      }
      if (info.layer?.id === "equipment") {
        return { text: String((o as { name: string }).name), style: box };
      }
      return null;
    },
    [theme, pal, fleet, sb510],
  );

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden rounded border border-border-primary" style={{ minHeight: 450, background: pal.land }}>
      {viewState && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
          controller={{ dragRotate: false, touchRotate: false, keyboard: false }}
          layers={deckLayers}
          onClick={(info: PickingInfo) => {
            if (!onLayerClick(info)) setFocus(null);
          }}
          getTooltip={tooltip}
          getCursor={({ isHovering }: { isHovering: boolean }) => (isHovering ? "pointer" : "grab")}
        >
          <MapLibre mapStyle={style} attributionControl={false} />
        </DeckGL>
      )}

      {/* Top-left: layers and zoom */}
      <div className="absolute left-3 top-3 z-10 flex gap-1.5">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Map layers"
          title="Map layers"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary bg-bg-secondary text-text-secondary hover:text-text-primary"
        >
          <Layers size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1)}
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary bg-bg-secondary text-text-secondary hover:text-text-primary"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary bg-bg-secondary text-text-secondary hover:text-text-primary"
        >
          <Minus size={15} />
        </button>
      </div>
      {menuOpen && <MapLayersMenu onClose={() => setMenuOpen(false)} />}

      {/* Top-right: the wind */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2.5 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
          <circle cx="13" cy="13" r="12" fill="none" stroke="var(--color-border-secondary)" />
          <g transform={`rotate(${kpis.windDirectionDeg + 180} 13 13)`}>
            <path d="M13 21V6" stroke="var(--color-accent)" strokeWidth="2" />
            <path d="M9 10l4-5 4 5" stroke="var(--color-accent)" strokeWidth="2" fill="none" />
          </g>
        </svg>
        <div className="font-mono text-xs leading-tight">
          <div className="text-text-primary">{kpis.averageWindSpeedMs.toFixed(1)} m/s</div>
          <div className="text-text-muted">from {Math.round(kpis.windDirectionDeg)}°</div>
        </div>
      </div>

      {/* Bottom-left: environment and alarms */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-2">
        <EnvironmentPanel />
        <AlarmTicker />
      </div>

      {/* Bottom-right: legend */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-md border border-border-primary bg-bg-secondary/90 px-2.5 py-1.5 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: `rgb(${pal.turbine.slice(0, 3).join(",")})` }} />running</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-[1.5px] border-status-offline" />stopped</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-status-warning" />attention</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5" style={{ background: `rgb(${pal.v66.slice(0, 3).join(",")})` }} />66 kV</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-accent" />220 kV live</span>
      </div>

      {focus && layers.arrayCables && <ArrayCableCard seg={focus} onClose={() => setFocus(null)} onSelect={setFocus} />}
      <ScenarioCenter />

      {/* The WebGL canvas cannot take focus: the turbines as buttons for keyboards and screen readers */}
      <ul className="sr-only" aria-label="Turbines">
        {turbines.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => onTurbineClick(t.id)}>
              {t.id} · {STATUS_WORD[t.status]} · {t.mw.toFixed(1)} MW
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default memo(ControlRoomMapInner);
