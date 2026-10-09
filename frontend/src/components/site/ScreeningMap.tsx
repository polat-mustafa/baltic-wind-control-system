/**
 * Screening map: open-data layers, the suitability grid (green = suitable,
 * yellow = marginal; poor and excluded cells stay clear so the layer that
 * excludes them shows through) and the candidate site the user draws.
 *
 * Drawing: "Draw site" → click the map to add corners → Finish (≥ 3).
 * Legend: open by default from the sm breakpoint, collapsible on phones.
 */

import { useMemo, useState } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { PathStyleExtension } from "@deck.gl/extensions";
import { PathLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Layers, PenLine, RotateCcw, Undo2, X, Check, MapPinned } from "lucide-react";

import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { cn } from "../../lib/utils";
import type { LonLat } from "../../services/siteApi";
import { useModeStore } from "../../store/modeStore";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";
import { checkExportRoute } from "../../lib/site/exportRoute";
import { rgba } from "../map/deckUtils";
import PlanningMap, { type Bounds } from "../map/PlanningMap";
import { roleLayer, roleTooltip } from "./mapLayers";
import { ROLE_STYLE, wideScreen } from "./mapStyles";

const SUITABLE = "#16a34a";
// Yellow, not amber: real wind farms are orange and the two must not be confused.
const MARGINAL = "#eab308";
const SITE = "#45c8d9";
const ROUTE_COLOR = "#e39a5b";
const DASH = [new PathStyleExtension({ dash: true })];
const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/** Bounds around a set of [lon, lat] points. */
function around(pts: LonLat[]): Bounds {
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

/** Suitability grid: suitable and marginal cells shaded, poor and excluded left clear. */
function useSuitabilityCells() {
  const s = useSiteStore((st) => st.suitability);
  return useMemo(() => {
    if (!s) return [];
    const out: { polygon: LonLat[]; cls: number }[] = [];
    for (let j = 0; j < s.ny; j++) {
      for (let i = 0; i < s.nx; i++) {
        const cls = s.classes[j][i];
        if (cls !== 2 && cls !== 3) continue;
        const lon = s.lon0 + i * s.dlon;
        const lat = s.lat0 + j * s.dlat;
        const [w, e, so, n] = [lon - s.dlon / 2, lon + s.dlon / 2, lat - s.dlat / 2, lat + s.dlat / 2];
        out.push({ polygon: [[w, so], [e, so], [e, n], [w, n]], cls });
      }
    }
    return out;
  }, [s]);
}

export default function ScreeningMap() {
  const layers = useSiteStore((s) => s.layers);
  const site = useSiteStore((s) => s.site);
  const drawing = useSiteStore((s) => s.drawing);
  const loading = useSiteStore((s) => s.loading);
  const startDrawing = useSiteStore((s) => s.startDrawing);
  const undoCorner = useSiteStore((s) => s.undoCorner);
  const finishDrawing = useSiteStore((s) => s.finishDrawing);
  const cancelDrawing = useSiteStore((s) => s.cancelDrawing);
  const setSite = useSiteStore((s) => s.setSite);
  const routeDrawing = useSiteStore((s) => s.routeDrawing);
  const undoRoutePoint = useSiteStore((s) => s.undoRoutePoint);
  const finishRoute = useSiteStore((s) => s.finishRoute);
  const cancelRoute = useSiteStore((s) => s.cancelRoute);
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...Object.entries(ROLE_STYLE).map(([k, v]) => [k, v.on]), ["suitability", true], ["turbines", useModeStore.getState().mode !== "own"]]),
  );
  const [panelOpen, setPanelOpen] = useState(wideScreen);
  const suitability = useSiteStore((s) => s.suitability);
  const topReasons = useMemo(
    () => [...(suitability?.reason_areas ?? [])].sort((a, b) => b.area_km2 - a.area_km2).slice(0, 5),
    [suitability],
  );

  const addCorner = useSiteStore((s) => s.addCorner);
  const addRoutePoint = useSiteStore((s) => s.addRoutePoint);
  const check = useSiteStore((s) => s.routeCheck);
  const cells = useSuitabilityCells();

  const bbox = layers?.region.bbox ?? [16.22, 54.45, 17.85, 55.2];
  const shown = (layers?.layers ?? []).filter((l) => ROLE_STYLE[l.role] && visible[l.role]);
  // Fit the region, or the checked export route once there is one
  const bounds: Bounds = check?.route.length ? around(check.route) : [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
  const fitKey = check?.route.length ? `route-${check.total_km}` : bbox.join(",");

  const crossings = check ? [...check.shipping, ...check.cables] : [];
  const routePath = routeDrawing ?? check?.route ?? [];
  const mapLayers = [
    visible.suitability &&
      new PolygonLayer({
        id: "suitability",
        data: cells,
        getPolygon: (d: (typeof cells)[number]) => d.polygon,
        getFillColor: (d: (typeof cells)[number]) => (d.cls === 3 ? rgba(SUITABLE, 0.38) : rgba(MARGINAL, 0.28)),
        stroked: false,
      }),
    ...shown.map((layer) => roleLayer(layer, ROLE_STYLE[layer.role])),
    visible.turbines &&
      new ScatterplotLayer({
        id: "sb510-turbines",
        data: TURBINE_POSITIONS,
        getPosition: (d: { lat: number; lon: number }) => [d.lon, d.lat],
        getRadius: 2.5,
        radiusUnits: "pixels",
        getFillColor: rgba("#f8fafc"),
        getLineColor: rgba("#0f172a"),
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1,
      }),
    site &&
      !drawing &&
      new PolygonLayer({
        id: "site",
        data: [{ polygon: site }],
        getPolygon: (d: { polygon: LonLat[] }) => d.polygon,
        getFillColor: rgba(SITE, 0.12),
        getLineColor: rgba(SITE),
        getLineWidth: 3,
        lineWidthUnits: "pixels",
        pickable: true,
      }),
    drawing &&
      drawing.length > 1 &&
      new PathLayer({
        id: "site-draft",
        data: [{ path: drawing }],
        getPath: (d: { path: LonLat[] }) => d.path,
        getColor: rgba(SITE),
        getWidth: 2,
        widthUnits: "pixels",
        getDashArray: [5, 5],
        extensions: DASH,
      }),
    drawing &&
      new ScatterplotLayer({
        id: "site-corners",
        data: drawing,
        getPosition: (d: LonLat) => d,
        getRadius: 5,
        radiusUnits: "pixels",
        getFillColor: rgba(SITE),
        getLineColor: WHITE,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
      }),
    // Export route: being drawn (dashed) or checked, with its landfall and crossings
    routePath.length > 1 &&
      new PathLayer({
        id: "route",
        data: [{ path: routePath, km: routeDrawing ? undefined : check?.total_km, auto: check?.auto }],
        getPath: (d: { path: LonLat[] }) => d.path,
        getColor: rgba(ROUTE_COLOR),
        getWidth: routeDrawing ? 2 : 3,
        widthUnits: "pixels",
        getDashArray: routeDrawing ? [5, 5] : [0, 0],
        extensions: DASH,
        pickable: !routeDrawing,
      }),
    new ScatterplotLayer({
      id: "route-points",
      data: routeDrawing
        ? routeDrawing.map((p) => ({ position: p, r: 4, fill: ROUTE_COLOR, line: "#ffffff", tip: undefined }))
        : [
            ...(check?.landfall ? [{ position: check.landfall, r: 6, fill: ROUTE_COLOR, line: "#ffffff", tip: "Landfall" }] : []),
            ...crossings.map((c) => ({
              position: c.at,
              r: 4,
              fill: "#ffffff",
              line: c.angle_deg < 45 ? "#f25c54" : "#334155",
              tip: `${c.name}: ${c.angle_deg.toFixed(0)}°`,
            })),
          ],
      getPosition: (d: { position: LonLat }) => d.position,
      getRadius: (d: { r: number }) => d.r,
      radiusUnits: "pixels",
      getFillColor: (d: { fill: string }) => rgba(d.fill),
      getLineColor: (d: { line: string }) => rgba(d.line),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 2,
      pickable: true,
    }),
  ];
  const tooltip = (info: PickingInfo): string | null => {
    const id = info.layer?.id;
    if (id === "site") return "Your candidate site";
    if (id === "route") {
      const d = info.object as { km?: number; auto?: boolean };
      return d.km != null ? `Export cable ${d.km.toFixed(1)} km (${d.auto ? "automatic" : "drawn"})` : null;
    }
    if (id === "route-points") return (info.object as { tip?: string }).tip ?? null;
    return roleTooltip(info);
  };

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-border-primary sm:h-[560px]" data-tour="site-map">
      <PlanningMap
        bounds={bounds}
        fitKey={fitKey}
        layers={mapLayers}
        getTooltip={tooltip}
        onClick={(info: PickingInfo) => {
          if (!info.coordinate) return;
          const p: LonLat = [Number(info.coordinate[0].toFixed(5)), Number(info.coordinate[1].toFixed(5))];
          if (drawing) addCorner(p);
          else if (routeDrawing) addRoutePoint(p);
        }}
        cursor={drawing || routeDrawing ? "crosshair" : undefined}
      />

      {/* Drawing toolbar */}
      <div
        className="absolute left-3 top-3 z-[1000] flex max-w-[calc(100%-7.5rem)] flex-wrap gap-1.5"
        data-tour="site-draw"
      >
        {routeDrawing ? (
          <>
            <span className="rounded-md bg-bg-secondary/95 px-2.5 py-1.5 text-xs text-text-secondary shadow">
              Click the route: sea, landfall, land ({routeDrawing.length})
            </span>
            <ToolButton onClick={undoRoutePoint} disabled={routeDrawing.length === 0} icon={<Undo2 size={13} />} label="Undo" />
            <ToolButton onClick={() => {
                finishRoute();
                void checkExportRoute();
              }} disabled={routeDrawing.length === 0} icon={<Check size={13} />} label="Finish" primary />
            <ToolButton onClick={cancelRoute} icon={<X size={13} />} label="Cancel" />
          </>
        ) : drawing ? (
          <>
            <span className="rounded-md bg-bg-secondary/95 px-2.5 py-1.5 text-xs text-text-secondary shadow">
              Click the map to add corners ({drawing.length})
            </span>
            <ToolButton onClick={undoCorner} disabled={drawing.length === 0} icon={<Undo2 size={13} />} label="Undo" />
            <ToolButton
              onClick={() => void finishDrawing()}
              disabled={drawing.length < 3}
              icon={<Check size={13} />}
              label="Finish"
              primary
            />
            <ToolButton onClick={cancelDrawing} icon={<X size={13} />} label="Cancel" />
          </>
        ) : (
          <>
            <ToolButton onClick={startDrawing} icon={<PenLine size={13} />} label={site ? "Redraw site" : "Draw site"} primary />
            <ToolButton
              onClick={() => void setSite(CASE_STUDY_SITE, CASE_STUDY_GRID_NODE)}
              icon={<MapPinned size={13} />}
              label="SB-510 boundary"
            />
            {site && <ToolButton onClick={() => void setSite(null)} icon={<RotateCcw size={13} />} label="Clear" />}
          </>
        )}
      </div>

      {/* Legend: screening result + constraint layers (toggles) */}
      <div
        className="pointer-events-none absolute right-3 top-3 z-[1000] flex max-h-[calc(100%-1.5rem)] flex-col items-end"
        data-tour="site-layers"
      >
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary/95 px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow"
        >
          <Layers size={13} /> Legend
        </button>
        {panelOpen && (
          <div className="pointer-events-auto mt-1.5 w-64 max-w-[75vw] space-y-2 overflow-y-auto rounded-md border border-border-primary bg-bg-secondary/95 p-2 text-xs shadow">
            <section aria-label="Screening result" className="space-y-1">
              <LegendHeading>{loading ? "Screening result (updating…)" : "Screening result"}</LegendHeading>
              <LegendToggle
                color={SUITABLE}
                label="Show the screening grid"
                checked={visible.suitability}
                onChange={(v) => setVisible({ ...visible, suitability: v })}
                swatch2={MARGINAL}
              />
              <LegendKey color={SUITABLE} fill={0.38} label="Suitable" note="no exclusion, good score" />
              <LegendKey color={MARGINAL} fill={0.28} label="Marginal" note="allowed, weaker score" />
              <LegendKey color="transparent" label="Poor" note="no shading: allowed but low score" />
              <LegendKey color="transparent" label="Excluded" note="no shading: the excluding layer shows" />
              {topReasons.length > 0 && (
                <ul className="ml-6 space-y-0.5 text-xs text-text-muted" aria-label="Main exclusion reasons">
                  {topReasons.map((r) => (
                    <li key={r.reason} className="flex justify-between gap-2">
                      <span className="truncate">{r.label}</span>
                      <span className="shrink-0 tabular-nums">{r.area_km2.toFixed(0)} km²</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label="Constraints" className="space-y-1 border-t border-border-primary pt-2">
              <LegendHeading>Constraints</LegendHeading>
              {Object.entries(ROLE_STYLE).map(([role, st]) => (
                <LegendToggle
                  key={role}
                  color={st.color}
                  label={st.label}
                  note={st.note}
                  dash={st.dash}
                  checked={!!visible[role]}
                  onChange={(v) => setVisible({ ...visible, [role]: v })}
                />
              ))}
              <LegendToggle
                color="#0f172a"
                label="SB-510 turbines"
                note="reference case study layout"
                checked={visible.turbines}
                onChange={(v) => setVisible({ ...visible, turbines: v })}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  disabled,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium shadow disabled:opacity-40",
        primary
          ? "bg-accent text-accent-ink hover:bg-accent-hover"
          : "border border-border-primary bg-bg-secondary/95 text-text-secondary hover:bg-bg-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function LegendHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">{children}</h4>;
}

/** Swatch: fill colour plus the layer's own outline and dash, so the key matches the map. */
export function Swatch({ color, fill = 0.2, dash, swatch2 }: { color: string; fill?: number; dash?: string; swatch2?: string }) {
  const alpha = Math.round(Math.min(1, fill) * 255)
    .toString(16)
    .padStart(2, "0");
  return (
    <svg width="18" height="12" className="shrink-0" aria-hidden>
      {swatch2 ? (
        <>
          <rect x="0" y="0" width="9" height="12" fill={color} />
          <rect x="9" y="0" width="9" height="12" fill={swatch2} />
        </>
      ) : (
        <rect
          x="1"
          y="1"
          width="16"
          height="10"
          rx="1.5"
          fill={color === "transparent" ? "none" : `${color}${alpha}`}
          stroke={color === "transparent" ? "#94a3b8" : color}
          strokeWidth="1.5"
          strokeDasharray={color === "transparent" ? "2 2" : dash}
        />
      )}
    </svg>
  );
}

function LegendKey({ color, fill, label, note }: { color: string; fill?: number; label: string; note: string }) {
  return (
    <div className="ml-6 flex items-center gap-2 text-text-secondary">
      <Swatch color={color} fill={fill} />
      <span>
        <span className="font-medium text-text-primary">{label}</span> <span className="text-text-muted">— {note}</span>
      </span>
    </div>
  );
}

function LegendToggle({
  color,
  swatch2,
  label,
  note,
  dash,
  checked,
  onChange,
}: {
  color: string;
  swatch2?: string;
  label: string;
  note?: string;
  dash?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-accent" />
      <span className="mt-0.5">
        <Swatch color={color} dash={dash} swatch2={swatch2} />
      </span>
      <span className="min-w-0">
        <span className="block text-text-primary">{label}</span>
        {note && <span className="block text-xs text-text-muted">{note}</span>}
      </span>
    </label>
  );
}
