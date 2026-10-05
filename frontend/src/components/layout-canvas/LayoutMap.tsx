/**
 * Layout canvas map: the site boundary, open-data constraints, draggable
 * turbines and offshore substation, array cables coloured by section and,
 * optionally, the wakes for one wind direction.
 */

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Polygon, Polyline, Marker, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";

import type { CableResult } from "../../lib/layout/cables";
import type { LonLat } from "../../lib/layout/geometry";
import { wakeConePoly } from "../../utils/wakeModel";
import { useProjectStore } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import { LayerShapes } from "../site/ScreeningMap";
import { ROLE_STYLE } from "../site/mapStyles";
import { SECTION_COLOR, type TurbineStatus, type TurbineView } from "./shared";

const STATUS_COLOR: Record<TurbineStatus, string> = {
  ok: "#f8fafc",
  close: "#f59e0b",
  outside: "#ef4444",
  excluded: "#ef4444",
};

const CONSTRAINT_ROLES = ["protected", "shipping", "restricted", "owf", "cable"];

const iconCache = new Map<string, L.DivIcon>();
function turbineIcon(status: TurbineStatus, selected: boolean): L.DivIcon {
  const key = `${status}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const size = selected ? 16 : 12;
    icon = L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${STATUS_COLOR[status]};border:2px solid ${
        selected ? "#0ea5e9" : "#0f172a"
      };box-shadow:0 1px 2px rgba(0,0,0,.4)"></div>`,
    });
    iconCache.set(key, icon);
  }
  return icon;
}

const ossIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: '<div style="width:18px;height:18px;background:#facc15;border:2px solid #0f172a;transform:rotate(45deg);box-shadow:0 1px 2px rgba(0,0,0,.4)"></div>',
});

function FitSite({ site }: { site: LonLat[] }) {
  const map = useMap();
  const key = site.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (site.length >= 3) map.fitBounds(site.map(([lon, lat]) => [lat, lon] as [number, number]), { padding: [24, 24] });
  }, [map, key]); // fit only when the site changes
  return null;
}

function Clicks() {
  const addMode = useProjectStore((s) => s.addMode);
  const addTurbine = useProjectStore((s) => s.addTurbine);
  const select = useProjectStore((s) => s.select);
  const map = useMapEvents({
    click(e) {
      if (addMode) addTurbine([e.latlng.lng, e.latlng.lat]);
      else select(null);
    },
  });
  useEffect(() => {
    map.getContainer().style.cursor = addMode ? "crosshair" : "";
  }, [map, addMode]);
  return null;
}

export default function LayoutMap({
  site,
  turbines,
  cables,
  wakeFrom,
}: {
  site: LonLat[];
  turbines: TurbineView[];
  cables: CableResult | null;
  wakeFrom: number | null;
}) {
  const layers = useSiteStore((s) => s.layers);
  const oss = useProjectStore((s) => s.oss);
  const selected = useProjectStore((s) => s.selected);
  const moveTurbine = useProjectStore((s) => s.moveTurbine);
  const select = useProjectStore((s) => s.select);
  const setOss = useProjectStore((s) => s.setOss);
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), []);

  const constraints = (layers?.layers ?? []).filter((l) => CONSTRAINT_ROLES.includes(l.role));
  const pos = (k: number): [number, number] => (k < 0 && oss ? [oss[1], oss[0]] : [turbines[k].lat, turbines[k].lon]);

  return (
    <div className="relative h-[460px] overflow-hidden rounded-lg border border-border-primary sm:h-[560px]" data-tour="layout-map">
      <MapContainer center={[54.8, 16.4]} zoom={11} className="h-full w-full" preferCanvas zoomControl={false}>
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Data: EMODnet, EEA, Marine Regions'
        />
        <FitSite site={site} />
        <Clicks />
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
            icon={turbineIcon(t.status, t.id === selected)}
            draggable
            keyboard={false}
            eventHandlers={{
              click: () => select(t.id),
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                moveTurbine(t.id, [p.lng, p.lat]);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <b>{t.id}</b> · {t.note}
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
            <Tooltip direction="top" offset={[0, -8]}>
              Offshore substation (drag to move)
            </Tooltip>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
