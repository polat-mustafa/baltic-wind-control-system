/**
 * Screening map: open-data layers, the suitability grid (green = suitable,
 * amber = marginal; excluded cells stay clear so the layer that excludes
 * them shows through) and the candidate site the user draws.
 *
 * Drawing: "Draw site" → click the map to add corners → Finish (≥ 3).
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
import { CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";

type LatLng = [number, number];
const ll = ([lon, lat]: LonLat): LatLng => [lat, lon];

interface RoleStyle {
  label: string;
  color: string;
  fill: number;
  dash?: string;
  on: boolean;
}

/** Map styling per layer role. Suitability owns green; nothing else uses it. */
const ROLE_STYLE: Record<string, RoleStyle> = {
  protected: { label: "Natura 2000", color: "#a855f7", fill: 0.18, on: true },
  shipping: { label: "Shipping priority (MSP)", color: "#3b82f6", fill: 0.14, dash: "6 4", on: true },
  owf: { label: "Wind farm areas", color: "#f97316", fill: 0.18, on: true },
  restricted: { label: "Military / munitions", color: "#ef4444", fill: 0.12, dash: "3 3", on: true },
  territorial: { label: "12 nm territorial sea", color: "#64748b", fill: 0.1, dash: "8 6", on: true },
  eez: { label: "EEZ boundary", color: "#334155", fill: 0, dash: "2 6", on: false },
  cable: { label: "Subsea cables", color: "#e11d48", fill: 0, on: true },
  grid: { label: "Grid connection", color: "#0f766e", fill: 1, on: true },
};

const SUITABLE = "#16a34a";
const MARGINAL = "#d97706";

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
  const map = useMapEvents({
    click(e) {
      if (drawing) addCorner([Number(e.latlng.lng.toFixed(5)), Number(e.latlng.lat.toFixed(5))]);
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = drawing ? "crosshair" : "";
  }, [map, drawing]);
  return null;
}

const LayerShapes = memo(function LayerShapes({
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
              <Tooltip sticky>{f.name}</Tooltip>
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
            <Tooltip>{f.name}</Tooltip>
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
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries([...Object.entries(ROLE_STYLE).map(([k, v]) => [k, v.on]), ["suitability", true], ["turbines", true]]),
  );
  const [panelOpen, setPanelOpen] = useState(false);
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
        {drawing ? (
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
              onClick={() => void setSite(CASE_STUDY_SITE)}
              icon={<MapPinned size={13} />}
              label="SB-510 boundary"
            />
            {site && <ToolButton onClick={() => void setSite(null)} icon={<RotateCcw size={13} />} label="Clear" />}
          </>
        )}
      </div>

      {/* Layer panel + legend */}
      <div
        className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end"
        data-tour="site-layers"
      >
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
          className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary/95 px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow"
        >
          <Layers size={13} /> Layers
        </button>
        {panelOpen && (
          <div className="pointer-events-auto mt-1.5 w-56 max-w-[70vw] space-y-1 rounded-md border border-border-primary bg-bg-secondary/95 p-2 text-[11px] shadow">
            <LegendToggle
              color={SUITABLE}
              label={loading ? "Suitable / marginal (updating…)" : "Suitable / marginal"}
              checked={visible.suitability}
              onChange={(v) => setVisible({ ...visible, suitability: v })}
              swatch2={MARGINAL}
            />
            {Object.entries(ROLE_STYLE).map(([role, st]) => (
              <LegendToggle
                key={role}
                color={st.color}
                label={st.label}
                dashed={!!st.dash}
                checked={!!visible[role]}
                onChange={(v) => setVisible({ ...visible, [role]: v })}
              />
            ))}
            <LegendToggle
              color="#f8fafc"
              label="SB-510 turbines"
              checked={visible.turbines}
              onChange={(v) => setVisible({ ...visible, turbines: v })}
            />
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

function LegendToggle({
  color,
  swatch2,
  label,
  dashed,
  checked,
  onChange,
}: {
  color: string;
  swatch2?: string;
  label: string;
  dashed?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-text-secondary">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      <span
        className={cn("inline-block h-3 w-4 rounded-sm border", dashed && "border-dashed")}
        style={{ borderColor: color, background: swatch2 ? `linear-gradient(90deg, ${color} 50%, ${swatch2} 50%)` : `${color}33` }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </label>
  );
}
