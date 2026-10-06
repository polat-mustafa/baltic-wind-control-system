/**
 * Hand-over preview on the Control Room map: the learner's layout project
 * (turbines, OSS, array cable tree by section) drawn over the live SB-510
 * farm, which the operation simulators stay calibrated to.
 */

import { useEffect, useRef } from "react";
import { CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

import { SITE_BOUNDARY_GEO } from "../../constants/windFarmLayout";

import { useFarmPlan } from "../../hooks/useFarmPlan";
import { SECTION_COLOR } from "../layout-canvas/shared";

const COLOR = "#e879f9";

export default function MyProjectLayer() {
  const farm = useFarmPlan();
  const map = useMap();
  const own = farm.source === "project";
  const fitted = useRef(false);
  // once, when the layer is switched on: show the reference farm and the project together
  useEffect(() => {
    if (!own || fitted.current) return;
    fitted.current = true;
    const b = L.latLngBounds(SITE_BOUNDARY_GEO.map(([lat, lon]) => L.latLng(lat, lon)));
    for (const t of farm.turbines) b.extend([t.lat, t.lon]);
    b.extend([farm.oss[1], farm.oss[0]]);
    // top padding clears the KPI strip drawn over the map
    map.fitBounds(b, { paddingTopLeft: [32, 130], paddingBottomRight: [32, 32] });
  }, [own, map, farm]);
  if (!own) return null;
  const at = new Map(farm.turbines.map((t) => [t.id, [t.lat, t.lon] as [number, number]]));
  const oss: [number, number] = [farm.oss[1], farm.oss[0]];
  return (
    <>
      {farm.turbines.map((t) => (
        <Polyline
          key={`c-${t.id}`}
          positions={[[t.lat, t.lon], t.upstream === "OSS" ? oss : (at.get(t.upstream) ?? oss)]}
          pathOptions={{ color: SECTION_COLOR[t.section ?? "over"], weight: 2, opacity: 0.85, dashArray: "6 4", interactive: false }}
        />
      ))}
      {farm.turbines.map((t) => (
        <CircleMarker key={t.id} center={[t.lat, t.lon]} radius={5} pathOptions={{ color: COLOR, weight: 2, fillColor: "#1e1b4b", fillOpacity: 0.85 }}>
          <Tooltip direction="top" offset={[0, -4]}>
            Your project · {t.id} · string {t.string} ({t.bay})
          </Tooltip>
        </CircleMarker>
      ))}
      <CircleMarker center={oss} radius={8} pathOptions={{ color: COLOR, weight: 3, fillColor: "#facc15", fillOpacity: 0.9 }}>
        <Tooltip direction="top" offset={[0, -6]}>
          Your project · offshore substation · {farm.strings.length} feeder bays
        </Tooltip>
      </CircleMarker>
    </>
  );
}
