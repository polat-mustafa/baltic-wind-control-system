/**
 * Screening map: open-data layers, the suitability grid (green = suitable,
 * yellow = marginal; poor and excluded cells stay clear so the layer that
 * excludes them shows through) and the candidate site the user draws.
 *
 * Drawing: "Draw site" → click the map to add corners → Finish (≥ 3).
 * Legend: open by default from the sm breakpoint, collapsible on phones.
 */

import { memo, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { Layers, PenLine, RotateCcw, Undo2, X, Check, MapPinned } from "lucide-react";

import { TURBINE_POSITIONS } from "../../constants/windFarmLayout";
import { cn } from "../../lib/utils";
import type { LayerInfo, LonLat } from "../../services/siteApi";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";
import { checkExportRoute } from "../../lib/site/exportRoute";
import { ROLE_STYLE, wideScreen, type RoleStyle } from "./mapStyles";

type LatLng = [number, number];
const ll = ([lon, lat]: LonLat): LatLng => [lat, lon];

const SUITABLE = "#16a34a";
// Yellow, not amber: real wind farms are orange and the two must not be confused.
const MARGINAL = "#eab308";


function FitBounds({ bbox }: { bbox: [number, number, number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([
      [bbox[1], bbox[0]],
      [bbox[3], bbox[2]],
    ]);
  }, [map, bbox]);
  return null;
}

function DrawClicks() {
  const drawing = useSiteStore((s) => s.drawing);
  const addCorner = useSiteStore((s) => s.addCorner);
  const routeDrawing = useSiteStore((s) => s.routeDrawing);
  const addRoutePoint = useSiteStore((s) => s.addRoutePoint);
  const map = useMapEvents({
    click(e) {
      const p: LonLat = [Number(e.latlng.lng.toFixed(5)), Number(e.latlng.lat.toFixed(5))];
      if (drawing) addCorner(p);
      else if (routeDrawing) addRoutePoint(p);
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = drawing || routeDrawing ? "crosshair" : "";
  }, [map, drawing, routeDrawing]);
  return null;
}

const ROUTE_COLOR = "#c2410c";

/** The export route being drawn (dashed) or the checked one, with its landfall. */
function ExportRouteShapes() {
  const drawingRoute = useSiteStore((s) => s.routeDrawing);
  const check = useSiteStore((s) => s.routeCheck);
  const map = useMap();
  useEffect(() => {
    if (check?.route.length) map.fitBounds(check.route.map(ll), { padding: [40, 40] });
  }, [map, check]);
  if (drawingRoute) {
    return (
      <>
        {drawingRoute.length > 1 && <Polyline positions={drawingRoute.map(ll)} pathOptions={{ color: ROUTE_COLOR, weight: 2, dashArray: "5 5" }} />}
        {drawingRoute.map((p, i) => (
          <CircleMarker key={i} center={ll(p)} radius={4} pathOptions={{ color: "#fff", weight: 2, fillColor: ROUTE_COLOR, fillOpacity: 1 }} />
        ))}
      </>
    );
  }
  if (!check) return null;
  return (
    <>
      <Polyline positions={check.route.map(ll)} pathOptions={{ color: ROUTE_COLOR, weight: 3 }}>
        <Tooltip sticky>
          Export cable {check.total_km.toFixed(1)} km ({check.auto ? "automatic" : "drawn"})
        </Tooltip>
      </Polyline>
      {check.landfall && (
        <CircleMarker center={ll(check.landfall)} radius={6} pathOptions={{ color: "#fff", weight: 2, fillColor: ROUTE_COLOR, fillOpacity: 1 }}>
          <Tooltip>Landfall</Tooltip>
        </CircleMarker>
      )}
      {[...check.shipping, ...check.cables].map((c, i) => (
        <CircleMarker
          key={`x${i}`}
          center={ll(c.at)}
          radius={4}
          pathOptions={{ color: c.angle_deg < 45 ? "#dc2626" : "#334155", weight: 2, fillColor: "#fff", fillOpacity: 1 }}
        >
          <Tooltip>
            {c.name}: {c.angle_deg.toFixed(0)}°
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

/** Tooltip text: the feature name plus capacity / status when the data has them. */
function featureLabel(f: LayerInfo["features"][number]): string {
  const p = f.properties;
  const extra = [
    typeof p.use === "string" ? `${p.use} port` : "",
    typeof p.power_mw === "number" ? `${p.power_mw} MW` : "",
    typeof p.status === "string" ? p.status : "",
  ].filter(Boolean);
  return extra.length ? `${f.name} (${extra.join(", ")})` : f.name;
}

export const LayerShapes = memo(function LayerShapes({
  layer,
  style,
  renderer,
}: {
  layer: LayerInfo;
  style: RoleStyle;
  renderer: L.Renderer;
}) {
  return (
    <>
      {layer.features.map((f, i) => {
        const g = f.geometry;
        if (g.type === "Polygon") {
          return (
            <Polygon
              key={`${layer.id}-${i}`}
              positions={g.coordinates.map((ring) => ring.map(ll))}
              pathOptions={{
                color: style.color,
                weight: 1.2,
                fillColor: style.color,
                fillOpacity: style.fill,
                dashArray: style.dash,
              }}
              renderer={renderer}
            >
              <Tooltip sticky>{featureLabel(f)}</Tooltip>
            </Polygon>
          );
        }
        if (g.type === "LineString") {
          return (
            <Polyline
              key={`${layer.id}-${i}`}
              positions={g.coordinates.map(ll)}
              pathOptions={{ color: style.color, weight: 2, dashArray: style.dash }}
              renderer={renderer}
            >
              <Tooltip sticky>{f.name}</Tooltip>
            </Polyline>
          );
        }
        return (
          <CircleMarker
            key={`${layer.id}-${i}`}
            center={ll(g.coordinates)}
            radius={6}
            pathOptions={{ color: "#fff", weight: 2, fillColor: style.color, fillOpacity: 1 }}
          >
            <Tooltip>{featureLabel(f)}</Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
});

function SuitabilityCells({ renderer }: { renderer: L.Renderer }) {
  const s = useSiteStore((st) => st.suitability);
  const cells = useMemo(() => {
    if (!s) return [];
    const out: { key: string; bounds: [LatLng, LatLng]; cls: number; score: number | null }[] = [];
    for (let j = 0; j < s.ny; j++) {
      for (let i = 0; i < s.nx; i++) {
        const cls = s.classes[j][i];
        if (cls !== 2 && cls !== 3) continue;
        const lon = s.lon0 + i * s.dlon;
        const lat = s.lat0 + j * s.dlat;
        out.push({
          key: `${j}-${i}`,
          bounds: [
            [lat - s.dlat / 2, lon - s.dlon / 2],
            [lat + s.dlat / 2, lon + s.dlon / 2],
          ],
          cls,
          score: s.scores[j][i],
        });
      }
    }
    return out;
  }, [s]);
  return (
    <>
      {cells.map((c) => (
        <Rectangle
          key={c.key}
          bounds={c.bounds}
          pathOptions={{
            stroke: false,
            fillColor: c.cls === 3 ? SUITABLE : MARGINAL,
            fillOpacity: c.cls === 3 ? 0.38 : 0.28,
          }}
          renderer={renderer}
          interactive={false}
        />
      ))}
    </>
  );
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
    Object.fromEntries([...Object.entries(ROLE_STYLE).map(([k, v]) => [k, v.on]), ["suitability", true], ["turbines", true]]),
  );
  const [panelOpen, setPanelOpen] = useState(wideScreen);
  const suitability = useSiteStore((s) => s.suitability);
  const topReasons = useMemo(
    () => [...(suitability?.reason_areas ?? [])].sort((a, b) => b.area_km2 - a.area_km2).slice(0, 5),
    [suitability],
  );
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);

  const bbox = layers?.region.bbox ?? [16.22, 54.45, 17.85, 55.2];
  const shown = (layers?.layers ?? []).filter((l) => ROLE_STYLE[l.role] && visible[l.role]);

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-border-primary sm:h-[560px]" data-tour="site-map">
      <MapContainer
        center={[(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2]}
        zoom={9}
        className="h-full w-full"
        preferCanvas
        attributionControl
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Data: EMODnet, EEA, Marine Regions'
        />
        <FitBounds bbox={bbox} />
        <DrawClicks />
        <ExportRouteShapes />
        {visible.suitability && <SuitabilityCells renderer={renderer} />}
        {shown.map((layer) => (
          <LayerShapes key={layer.id} layer={layer} style={ROLE_STYLE[layer.role]} renderer={renderer} />
        ))}
        {visible.turbines &&
          TURBINE_POSITIONS.map((t) => (
            <CircleMarker
              key={t.id}
              center={[t.lat, t.lon]}
              radius={2.5}
              pathOptions={{ color: "#0f172a", weight: 1, fillColor: "#f8fafc", fillOpacity: 1 }}
              interactive={false}
            />
          ))}
        {site && !drawing && (
          <Polygon
            positions={site.map(ll)}
            pathOptions={{ color: "#0ea5e9", weight: 3, fillColor: "#0ea5e9", fillOpacity: 0.12 }}
          >
            <Tooltip sticky>Your candidate site</Tooltip>
          </Polygon>
        )}
        {drawing && drawing.length > 0 && (
          <>
            <Polyline positions={drawing.map(ll)} pathOptions={{ color: "#0ea5e9", weight: 2, dashArray: "5 5" }} />
            {drawing.map((p, i) => (
              <CircleMarker
                key={i}
                center={ll(p)}
                radius={5}
                pathOptions={{ color: "#fff", weight: 2, fillColor: "#0ea5e9", fillOpacity: 1 }}
              />
            ))}
          </>
        )}
      </MapContainer>

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
          <div className="pointer-events-auto mt-1.5 w-64 max-w-[75vw] space-y-2 overflow-y-auto rounded-md border border-border-primary bg-bg-secondary/95 p-2 text-[11px] shadow">
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
                <ul className="ml-6 space-y-0.5 text-[10px] text-text-muted" aria-label="Main exclusion reasons">
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
          ? "bg-accent text-white hover:bg-accent-hover"
          : "border border-border-primary bg-bg-secondary/95 text-text-secondary hover:bg-bg-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function LegendHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{children}</h4>;
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
        {note && <span className="block text-[10px] text-text-muted">{note}</span>}
      </span>
    </label>
  );
}
