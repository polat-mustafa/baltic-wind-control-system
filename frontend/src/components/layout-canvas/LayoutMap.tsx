/**
 * Layout canvas map: the site boundary, open-data constraints, draggable
 * turbines (top-view glyphs coloured by position status, IDs from zoom 12)
 * and offshore substation, array cables coloured by section, optionally the
 * wakes for one wind direction, and a legend.
 *
 * Dragging a turbine publishes its position once per animation frame
 * (`useDrag`) so the live card can show the yield change; the layout itself
 * is committed on drag end.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import L from "leaflet";
import { MapContainer, Polygon, Polyline, Marker, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import { Layers } from "lucide-react";

import { ARRAY_SECTIONS, type CableResult } from "../../lib/layout/cables";
import { MIN_SPACING_D } from "../../lib/layout/evaluate";
import type { LonLat } from "../../lib/layout/geometry";
import { wakeConePoly } from "../../utils/wakeModel";
import { useProjectStore } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import { LayerShapes, LegendHeading, Swatch } from "../site/ScreeningMap";
import { ROLE_STYLE, wideScreen } from "../site/mapStyles";
import { ossGlyph, SECTION_COLOR, STATUS_STYLE, turbineGlyph, useDrag, type TurbineStatus, type TurbineView } from "./shared";

const CONSTRAINT_ROLES = ["msp_energy", "protected", "shipping", "restricted", "owf", "cable"];
/** Turbine IDs are drawn from this zoom level on. */
const LABEL_ZOOM = 12;

const iconCache = new Map<string, L.DivIcon>();
function turbineIcon(status: TurbineStatus, selected: boolean, label: string | null): L.DivIcon {
  const key = `${status}-${selected}-${label ?? ""}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = selected ? 26 : 20;
    const text = label
      ? `<div style="position:absolute;left:50%;top:${size}px;transform:translateX(-50%);font:600 10px/1 system-ui,sans-serif;color:#0f172a;white-space:nowrap;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff">${label}</div>`
      : "";
    icon = L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="position:relative;width:${size}px;height:${size}px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))">${turbineGlyph(STATUS_STYLE[status].color, size, selected)}${text}</div>`,
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const ossIcon = L.divIcon({
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `<div style="filter:drop-shadow(0 1px 1px rgba(0,0,0,.4))">${ossGlyph(24)}</div>`,
});

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

function FitSite({ site }: { site: LonLat[] }) {
  const map = useMap();
  const key = site.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (site.length >= 3) map.fitBounds(site.map(([lon, lat]) => [lat, lon] as [number, number]), { padding: [24, 24] });
  }, [map, key]); // fit only when the site changes
  return null;
}

function Clicks({ onZoom }: { onZoom: (z: number) => void }) {
  const addMode = useProjectStore((s) => s.addMode);
  const addTurbine = useProjectStore((s) => s.addTurbine);
  const select = useProjectStore((s) => s.select);
  const map = useMapEvents({
    click(e) {
      if (addMode) addTurbine([e.latlng.lng, e.latlng.lat]);
      else select(null);
    },
    zoomend: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    map.getContainer().style.cursor = addMode ? "crosshair" : "";
  }, [map, addMode]);
  return null;
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
              <Swatch color="#0ea5e9" fill={0.04} /> site boundary
            </div>
            {wakes && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Swatch color="#38bdf8" fill={0.3} /> wakes (first 3 km, one direction)
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
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);
  const [zoom, setZoom] = useState(11);

  const constraints = (layers?.layers ?? []).filter((l) => CONSTRAINT_ROLES.includes(l.role));
  const pos = (k: number): [number, number] => (k < 0 && oss ? [oss[1], oss[0]] : [turbines[k].lat, turbines[k].lon]);

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-border-primary sm:h-[560px]" data-tour="layout-map">
      <MapContainer center={[55.06, 16.53]} zoom={11} className="h-full w-full" preferCanvas zoomControl={false}>
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Data: EMODnet, EEA, Marine Regions'
        />
        <FitSite site={site} />
        <Clicks onZoom={setZoom} />
        {constraints.map((layer) => (
          <LayerShapes key={layer.id} layer={layer} style={ROLE_STYLE[layer.role]} renderer={renderer} />
        ))}
        <Polygon
          positions={site.map(([lon, lat]) => [lat, lon] as [number, number])}
          pathOptions={{ color: "#0ea5e9", weight: 2.5, fillOpacity: 0.04 }}
          interactive={false}
        />
        {wakeFrom != null &&
          turbines.map((t) => (
            <Polygon
              key={`w-${t.id}`}
              positions={wakeConePoly(t.lat, t.lon, wakeFrom, 3000)}
              pathOptions={{ color: "#38bdf8", weight: 0, fillColor: "#38bdf8", fillOpacity: 0.16 }}
              renderer={renderer}
              interactive={false}
            />
          ))}
        {cables?.edges.map((e) =>
          e.to < 0 && !oss ? null : (
            <Polyline
              key={`c-${e.from}`}
              positions={[pos(e.from), pos(e.to)]}
              pathOptions={{ color: SECTION_COLOR[e.section?.id ?? "over"], weight: e.load >= 5 ? 3.5 : 2.5 }}
              renderer={renderer}
            >
              <Tooltip sticky>
                {e.section ? e.section.label : "Over capacity"} · {e.load} turbine{e.load > 1 ? "s" : ""} · {(e.lengthM / 1000).toFixed(2)} km
              </Tooltip>
            </Polyline>
          ),
        )}
        {turbines.map((t) => (
          <Marker
            key={t.id}
            position={[t.lat, t.lon]}
            icon={turbineIcon(t.status, t.id === selected, zoom >= LABEL_ZOOM ? t.id : null)}
            draggable
            keyboard={false}
            eventHandlers={{
              click: () => select(t.id),
              drag: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                queueDrag(t.id, [p.lng, p.lat]);
              },
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                endDrag();
                moveTurbine(t.id, [p.lng, p.lat]);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <b>{t.id}</b>
              {t.note && <> · {t.note}</>}
            </Tooltip>
          </Marker>
        ))}
        {oss && (
          <Marker
            position={[oss[1], oss[0]]}
            icon={ossIcon}
            draggable
            keyboard={false}
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                setOss([p.lng, p.lat]);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              Offshore substation (drag to move)
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
      <Legend wakes={wakeFrom != null} />
      {card && <div className="pointer-events-none absolute left-3 top-3 z-[1000] w-64 max-w-[calc(100%-7.5rem)]">{card}</div>}
    </div>
  );
}
