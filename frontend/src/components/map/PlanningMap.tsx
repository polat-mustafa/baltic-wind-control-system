/**
 * Base for the planning maps (Site screening, Layout, energisation replay):
 * MapLibre with the OpenStreetMap vector base (OpenFreeMap; raster OSM until it
 * loads) — towns, ports and the coast matter when choosing a site — in the
 * Control Room's sea / land colours, and
 * deck.gl drawing the data on top (same DeckGL-as-root pattern as the Control
 * Room map).
 *
 * The map fits `bounds` whenever `fitKey` changes. Zoom buttons sit bottom
 * right; the OSM / data attribution bottom left. Items dragged from a palette
 * (HTML drag and drop, `DROP_TYPE` data = item kind) land via `onDropItem`.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Map as MapLibre } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { WebMercatorViewport, type Layer, type MapViewState, type PickingInfo } from "@deck.gl/core";
import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibreWorker";
import { Minus, Plus } from "lucide-react";

import { useLayerStore } from "../../store/layerStore";
import { PALETTES } from "../landing/mapContextLayers";
import { DROP_TYPE, osmStyle, recolourVector, useVectorStyle } from "./deckUtils";
import MapCredits from "./MapCredits";

export type Bounds = [[number, number], [number, number]];

/** Planning zoom range: country to a single turbine. Below ~4 the world wraps and the base map can lose the data layers. */
const MIN_ZOOM = 4;
const MAX_ZOOM = 17;

export interface RasterOverlay {
  id: string;
  /** Tile URL template; a WMS GetMap with bbox={bbox-epsg-3857}&width=256&height=256. */
  tiles: string;
  opacity?: number;
}

export interface PlanningMapProps {
  bounds: Bounds;
  /** Refit to `bounds` when this changes (not on every new array). */
  fitKey: string;
  layers: (Layer | false | null | undefined)[];
  getTooltip?: (info: PickingInfo) => string | null;
  onClick?: (info: PickingInfo) => void;
  onZoom?: (zoom: number) => void;
  /** Pan with the mouse; off while hovering something draggable. */
  dragPan?: boolean;
  onDragStart?: (info: PickingInfo) => void;
  onDrag?: (info: PickingInfo) => void;
  onDragEnd?: (info: PickingInfo) => void;
  onHover?: (info: PickingInfo) => void;
  cursor?: string;
  /** A palette item (`DROP_TYPE`) dropped on the map at lon/lat. */
  onDropItem?: (kind: string, at: [number, number]) => void;
  /** Sources of the data layers, credited after the base map; null for none. */
  dataCredit?: string | null;
  /** Raster overlays on the base map, under the data (e.g. a WMS with {bbox-epsg-3857} tiles). */
  overlays?: RasterOverlay[];
  children?: ReactNode;
}

const NO_OVERLAYS: RasterOverlay[] = [];

export default function PlanningMap({
  bounds,
  fitKey,
  layers,
  getTooltip,
  onClick,
  onZoom,
  dragPan = true,
  onDragStart,
  onDrag,
  onDragEnd,
  onHover,
  cursor,
  onDropItem,
  dataCredit = "EMODnet, EEA, Marine Regions",
  overlays = NO_OVERLAYS,
  children,
}: PlanningMapProps) {
  const theme = useLayerStore((s) => s.mapTheme);
  const dark = theme === "hmi";
  const pal = PALETTES[theme];
  const vector = useVectorStyle(theme);
  const style = useMemo(() => {
    const base = vector ? recolourVector(vector, pal.land, pal.sea) : osmStyle(dark);
    if (!overlays.length) return base;
    return {
      ...base,
      sources: {
        ...base.sources,
        ...Object.fromEntries(overlays.map((o) => [o.id, { type: "raster" as const, tiles: [o.tiles], tileSize: 256 }])),
      },
      layers: [...base.layers, ...overlays.map((o) => ({ id: o.id, type: "raster" as const, source: o.id, paint: { "raster-opacity": o.opacity ?? 0.7 } }))],
    };
  }, [vector, pal, dark, overlays]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<MapViewState | null>(null);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 10 || height < 10) return false;
      const v = new WebMercatorViewport({ width, height }).fitBounds(boundsRef.current, { padding: 28 });
      setViewState({ longitude: v.longitude, latitude: v.latitude, zoom: v.zoom, pitch: 0, bearing: 0, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM });
      return true;
    };
    if (fit()) return;
    const ro = new ResizeObserver(() => fit() && ro.disconnect());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitKey]);

  const zoom = viewState?.zoom;
  useEffect(() => {
    if (zoom != null) onZoom?.(zoom);
  }, [zoom, onZoom]);
  // Instant step: a deck.gl transition fed back through the controlled view state could loop
  // (React "maximum update depth") and leave the MapLibre base behind the data layers.
  const zoomBy = (dz: number) => setViewState((v) => v && { ...v, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom + dz)) });
  const button =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary bg-bg-secondary text-text-secondary hover:text-text-primary";

  return (
    <div
      ref={boxRef}
      className="absolute inset-0"
      style={{ background: pal.sea }}
      onDragOver={(e) => {
        if (onDropItem && e.dataTransfer.types.includes(DROP_TYPE)) e.preventDefault();
      }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData(DROP_TYPE);
        const el = boxRef.current;
        if (!onDropItem || !kind || !viewState || !el) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const [lon, lat] = new WebMercatorViewport({ ...viewState, width: r.width, height: r.height }).unproject([e.clientX - r.left, e.clientY - r.top]);
        onDropItem(kind, [lon, lat]);
      }}
    >
      {viewState && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
          controller={{ dragRotate: false, touchRotate: false, keyboard: false, dragPan }}
          layers={layers.filter(Boolean) as Layer[]}
          onClick={onClick}
          onHover={onHover}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          getTooltip={(info: PickingInfo) => {
            const text = getTooltip?.(info);
            return text
              ? {
                  text,
                  style: {
                    background: dark ? "#172a3d" : "#f4f3ee",
                    color: dark ? "#e4ecf3" : "#121817",
                    border: `1px solid ${dark ? "#2c4760" : "#121817"}`,
                    borderRadius: "4px",
                    padding: "6px 8px",
                    fontSize: "12px",
                  },
                }
              : null;
          }}
          getCursor={({ isHovering, isDragging }: { isHovering: boolean; isDragging: boolean }) =>
            cursor ?? (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")
          }
        >
          <MapLibre mapStyle={style} attributionControl={false} />
        </DeckGL>
      )}
      {/* phones: mid-right edge, the fixed Tutor button sits on the bottom-right corner */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 max-sm:bottom-auto max-sm:top-1/2 max-sm:-translate-y-1/2">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" className={button}>
          <Plus size={15} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" className={button}>
          <Minus size={15} />
        </button>
      </div>
      <MapCredits data={dataCredit ?? undefined} className="bottom-0 left-0 rounded-tr max-sm:bottom-1 max-sm:left-1 max-sm:rounded" />
      {children}
    </div>
  );
}
