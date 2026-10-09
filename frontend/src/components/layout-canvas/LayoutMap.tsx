/**
 * Layout canvas map (MapLibre + deck.gl over OpenStreetMap, see map/PlanningMap): the site boundary, open-data constraints, draggable
 * turbines (top-view glyphs coloured by position status, IDs from zoom 11)
 * and offshore substation, array cables coloured by section, optionally the
 * wakes for one wind direction, and a legend.
 *
 * Dragging a turbine publishes its position once per animation frame
 * (`useDrag`) so the live card can show the yield change; the layout itself
 * is committed on drag end.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { IconLayer, LineLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import { Layers } from "lucide-react";

import { ARRAY_SECTIONS, type CableResult } from "../../lib/layout/cables";
import { MIN_SPACING_D } from "../../lib/layout/evaluate";
import type { LonLat } from "../../lib/layout/geometry";
import { wakeConePoly } from "../../utils/wakeModel";
import { useLayerStore } from "../../store/layerStore";
import { useProjectStore } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import { rgba, svgIcon } from "../map/deckUtils";
import PlanningMap, { type Bounds } from "../map/PlanningMap";
import { LegendHeading, Swatch } from "../site/ScreeningMap";
import { roleLayer, roleTooltip } from "../site/mapLayers";
import { ROLE_STYLE, wideScreen } from "../site/mapStyles";
import { ossGlyph, SECTION_COLOR, STATUS_STYLE, turbineGlyph, useDrag, type TurbineStatus, type TurbineView } from "./shared";

const CONSTRAINT_ROLES = ["msp_energy", "protected", "shipping", "restricted", "owf", "cable"];
/** Turbine IDs are drawn from this zoom level on (MapLibre zoom). */
const LABEL_ZOOM = 11;
const SITE = "#45c8d9";

const iconCache = new Map<string, ReturnType<typeof svgIcon>>();
function turbineIcon(status: TurbineStatus, selected: boolean) {
  const key = `${status}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = selected ? 26 : 20;
    icon = svgIcon(turbineGlyph(STATUS_STYLE[status].color, size, selected), size);
    iconCache.set(key, icon);
  }
  return icon;
}
const OSS_ICON = svgIcon(ossGlyph(24), 24);

let frame = 0;
let pending: { id: string; p: LonLat } | null = null;
/** Publish the dragged position at most once per animation frame. */
function queueDrag(id: string, p: LonLat) {
  pending = { id, p };
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (pending) useDrag.setState(pending);
    });
}
function endDrag() {
  cancelAnimationFrame(frame);
  frame = 0;
  pending = null;
  useDrag.setState({ id: null, p: null });
}

function Legend({ wakes }: { wakes: boolean }) {
  const [open, setOpen] = useState(wideScreen);
  const layers = useSiteStore((s) => s.layers);
  const roles = CONSTRAINT_ROLES.filter((r) => layers?.layers.some((l) => l.role === r));
  const glyph = (html: string) => <span className="flex w-[18px] shrink-0 justify-center" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex max-h-[calc(100%-1.5rem)] flex-col items-end" data-tour="layout-legend">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border-primary bg-bg-secondary/95 px-2.5 py-1.5 text-xs font-medium text-text-secondary shadow"
      >
        <Layers size={13} /> Legend
      </button>
      {open && (
        <div className="pointer-events-auto mt-1.5 w-60 max-w-[75vw] space-y-2 overflow-y-auto rounded-md border border-border-primary bg-bg-secondary/95 p-2 text-xs shadow">
          <section aria-label="Turbines" className="space-y-1">
            <LegendHeading>Turbines</LegendHeading>
            {(Object.keys(STATUS_STYLE) as TurbineStatus[]).map((k) => (
              <div key={k} className="flex items-center gap-2 text-text-secondary">
                {glyph(turbineGlyph(STATUS_STYLE[k].color, 16))}
                {k === "close" ? `closer than ${MIN_SPACING_D} D to a neighbour` : STATUS_STYLE[k].label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-text-secondary">
              {glyph(turbineGlyph(STATUS_STYLE.ok.color, 18, true))}
              selected · IDs from zoom {LABEL_ZOOM}
            </div>
            <div className="flex items-center gap-2 text-text-secondary">
              {glyph(ossGlyph(16))}
              offshore substation (drag to move)
            </div>
          </section>
          <section aria-label="Array cables and site" className="space-y-1 border-t border-border-primary pt-2">
            <LegendHeading>Array cables · site</LegendHeading>
            {[...ARRAY_SECTIONS.map((s) => ({ id: s.id, label: s.label })), { id: "over", label: "over capacity" }].map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-text-secondary">
                <span className="flex w-[18px] shrink-0 justify-center">
                  <span className="inline-block h-1 w-4 rounded" style={{ background: SECTION_COLOR[s.id] }} />
                </span>
                {s.label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-text-secondary">
              <Swatch color={SITE} fill={0.04} /> site boundary
            </div>
            {wakes && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Swatch color={SITE} fill={0.3} /> wakes (first 3 km, one direction)
              </div>
            )}
          </section>
          {roles.length > 0 && (
            <section aria-label="Constraints" className="space-y-1 border-t border-border-primary pt-2">
              <LegendHeading>Constraints</LegendHeading>
              {roles.map((r) => (
                <div key={r} className="flex items-start gap-2 text-text-secondary">
                  <span className="mt-0.5">
                    <Swatch color={ROLE_STYLE[r].color} fill={ROLE_STYLE[r].fill} dash={ROLE_STYLE[r].dash} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-text-primary">{ROLE_STYLE[r].label}</span>
                    <span className="block text-xs text-text-muted">{ROLE_STYLE[r].note}</span>
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function LayoutMap({
  site,
  turbines,
  cables,
  wakeFrom,
  card,
}: {
  site: LonLat[];
  turbines: TurbineView[];
  cables: CableResult | null;
  wakeFrom: number | null;
  /** Overlay in the top-left corner (the turbine card). */
  card?: ReactNode;
}) {
  const layers = useSiteStore((s) => s.layers);
  const oss = useProjectStore((s) => s.oss);
  const selected = useProjectStore((s) => s.selected);
  const moveTurbine = useProjectStore((s) => s.moveTurbine);
  const select = useProjectStore((s) => s.select);
  const setOss = useProjectStore((s) => s.setOss);
  const addMode = useProjectStore((s) => s.addMode);
  const addTurbine = useProjectStore((s) => s.addTurbine);
  const dark = useLayerStore((s) => s.mapTheme) === "hmi";
  const [zoom, setZoom] = useState(11);
  // Something draggable under the pointer (map panning is off), and what is being dragged where
  const [overDraggable, setOverDraggable] = useState(false);
  const [drag, setDrag] = useState<{ id: string; p: LonLat } | null>(null);

  const constraints = (layers?.layers ?? []).filter((l) => CONSTRAINT_ROLES.includes(l.role));
  const shown = useMemo(
    () => turbines.map((t) => (drag && drag.id === t.id ? { ...t, lon: drag.p[0], lat: drag.p[1] } : t)),
    [turbines, drag],
  );
  const ossAt: LonLat | null = drag?.id === "OSS" ? drag.p : oss;
  const pos = (k: number): LonLat => (k < 0 && ossAt ? ossAt : [shown[k].lon, shown[k].lat]);

  const bounds: Bounds = useMemo(() => {
    const pts = site.length >= 3 ? site : [[16.43, 55.0], [16.63, 55.12]];
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
  }, [site]);
  const fitKey = site.map((p) => p.join(",")).join(";"); // fit only when the site changes

  const draggableId = (info: PickingInfo): string | null =>
    info.layer?.id === "turbines" ? (info.object as TurbineView).id : info.layer?.id === "oss" ? "OSS" : null;
  const onHover = useCallback((info: PickingInfo) => setOverDraggable(!!info.object && (info.layer?.id === "turbines" || info.layer?.id === "oss")), []);

  const mapLayers = [
    ...constraints.map((layer) => roleLayer(layer, ROLE_STYLE[layer.role])),
    new PolygonLayer({
      id: "site",
      data: [{ polygon: site }],
      getPolygon: (d: { polygon: LonLat[] }) => d.polygon,
      getFillColor: rgba(SITE, 0.04),
      getLineColor: rgba(SITE),
      getLineWidth: 2.5,
      lineWidthUnits: "pixels",
    }),
    wakeFrom != null &&
      new PolygonLayer({
        id: "wakes",
        data: shown,
        getPolygon: (t: TurbineView) => wakeConePoly(t.lat, t.lon, wakeFrom, 3000).map(([la, lo]) => [lo, la]),
        getFillColor: rgba(SITE, 0.16),
        stroked: false,
        updateTriggers: { getPolygon: wakeFrom },
      }),
    cables &&
      new LineLayer({
        id: "cables",
        data: cables.edges.filter((e) => e.to >= 0 || ossAt),
        getSourcePosition: (e: CableResult["edges"][number]) => pos(e.from),
        getTargetPosition: (e: CableResult["edges"][number]) => pos(e.to),
        getColor: (e: CableResult["edges"][number]) => rgba(SECTION_COLOR[e.section?.id ?? "over"]),
        getWidth: (e: CableResult["edges"][number]) => (e.load >= 5 ? 3.5 : 2.5),
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getSourcePosition: [shown, ossAt], getTargetPosition: [shown, ossAt] },
      }),
    new IconLayer({
      id: "turbines",
      data: shown,
      getPosition: (t: TurbineView) => [t.lon, t.lat],
      getIcon: (t: TurbineView) => turbineIcon(t.status, t.id === selected),
      getSize: (t: TurbineView) => (t.id === selected ? 26 : 20),
      sizeUnits: "pixels",
      pickable: true,
      updateTriggers: { getIcon: selected, getSize: selected },
    }),
    zoom >= LABEL_ZOOM &&
      new TextLayer({
        id: "turbine-ids",
        data: shown,
        getPosition: (t: TurbineView) => [t.lon, t.lat],
        getText: (t: TurbineView) => t.id,
        getSize: 12,
        getColor: dark ? [228, 236, 243, 255] : [15, 23, 42, 255],
        outlineWidth: 3,
        outlineColor: dark ? [10, 21, 32, 255] : [255, 255, 255, 255],
        fontSettings: { sdf: true },
        fontFamily: "IBM Plex Mono, monospace",
        characterSet: "auto",
        getPixelOffset: [0, 18],
        updateTriggers: { getColor: dark },
      }),
    ossAt &&
      new IconLayer({
        id: "oss",
        data: [{ position: ossAt }],
        getPosition: (d: { position: LonLat }) => d.position,
        getIcon: () => OSS_ICON,
        getSize: 24,
        sizeUnits: "pixels",
        pickable: true,
      }),
  ];

  const tooltip = (info: PickingInfo): string | null => {
    const id = info.layer?.id;
    if (id === "turbines") {
      const t = info.object as TurbineView;
      return t.note ? `${t.id} · ${t.note}` : t.id;
    }
    if (id === "oss") return "Offshore substation (drag to move)";
    if (id === "cables") {
      const e = info.object as CableResult["edges"][number];
      return `${e.section ? e.section.label : "Over capacity"} · ${e.load} turbine${e.load > 1 ? "s" : ""} · ${(e.lengthM / 1000).toFixed(2)} km`;
    }
    return roleTooltip(info);
  };

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-border-primary sm:h-[560px]" data-tour="layout-map">
      <PlanningMap
        bounds={bounds}
        fitKey={fitKey}
        layers={mapLayers}
        getTooltip={drag ? undefined : tooltip}
        onZoom={setZoom}
        dragPan={!overDraggable && !drag}
        onHover={onHover}
        onClick={(info: PickingInfo) => {
          if (info.layer?.id === "turbines") return select((info.object as TurbineView).id);
          if (addMode && info.coordinate) addTurbine([info.coordinate[0], info.coordinate[1]]);
          else if (!info.object) select(null);
        }}
        onDragStart={(info: PickingInfo) => {
          const id = draggableId(info);
          if (id && info.coordinate) setDrag({ id, p: [info.coordinate[0], info.coordinate[1]] });
        }}
        onDrag={(info: PickingInfo) => {
          if (!drag || !info.coordinate) return;
          const p: LonLat = [info.coordinate[0], info.coordinate[1]];
          setDrag({ id: drag.id, p });
          if (drag.id !== "OSS") queueDrag(drag.id, p);
        }}
        onDragEnd={() => {
          if (!drag) return;
          if (drag.id === "OSS") setOss(drag.p);
          else {
            endDrag();
            moveTurbine(drag.id, drag.p);
          }
          setDrag(null);
        }}
        cursor={addMode ? "crosshair" : drag ? "grabbing" : undefined}
      />
      <Legend wakes={wakeFrom != null} />
      {card && <div className="pointer-events-none absolute left-3 top-3 z-[1000] w-64 max-w-[calc(100%-7.5rem)]">{card}</div>}
    </div>
  );
}
