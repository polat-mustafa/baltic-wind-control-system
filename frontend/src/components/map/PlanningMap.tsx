/**
 * Base for the planning maps (Site screening, Layout): MapLibre with the
 * OpenStreetMap raster tiles as the base — towns, ports and the coast matter
 * when choosing a site — recoloured for Baltic Night in the dark theme, and
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
import { Minus, Plus } from "lucide-react";

import { useLayerStore } from "../../store/layerStore";
import { DROP_TYPE, osmStyle } from "./deckUtils";

export type Bounds = [[number, number], [number, number]];

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
  children?: ReactNode;
}

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
  children,
}: PlanningMapProps) {
  const dark = useLayerStore((s) => s.mapTheme) === "hmi";
  const style = useMemo(() => osmStyle(dark), [dark]);
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
      setViewState({ longitude: v.longitude, latitude: v.latitude, zoom: v.zoom, pitch: 0, bearing: 0 });
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
  const zoomBy = (dz: number) => setViewState((v) => v && { ...v, zoom: Math.max(4, Math.min(17, v.zoom + dz)), transitionDuration: 250 });
  const button =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border-secondary bg-bg-secondary text-text-secondary hover:text-text-primary";

  return (
    <div
      ref={boxRef}
      className="absolute inset-0"
      style={{ background: dark ? "#0a1520" : "#e8e4da" }}
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
                    background: dark ? "#172a3d" : "#f7edd4",
                    color: dark ? "#e4ecf3" : "#2b2118",
                    border: `1px solid ${dark ? "#2c4760" : "#2b2118"}`,
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
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoom in" className={button}>
          <Plus size={15} />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Zoom out" className={button}>
          <Minus size={15} />
        </button>
      </div>
      <div className="pointer-events-auto absolute bottom-0 left-0 z-10 rounded-tr bg-bg-secondary/80 px-1.5 py-0.5 text-xs text-text-muted">
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          OpenStreetMap
        </a>{" "}
        contributors · Data: EMODnet, EEA, Marine Regions
      </div>
      {children}
    </div>
  );
}
