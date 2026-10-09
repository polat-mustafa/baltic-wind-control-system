/**
 * The energisation replay on the map: the same frame as the single-line
 * diagram, drawn where the plant is — export cable 1 from the onshore
 * substation to the OSS, the 66 kV strings of section A and their turbines —
 * in the SLD's colours (live in its voltage colour, earthed magenta, dead
 * slate). Loaded lazily with the replay (MapLibre + deck.gl, map/PlanningMap).
 */

import { useMemo } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { EXPORT_CABLE_GEO, ONSHORE_GEO } from "../../constants/windFarmLayout";
import { cableTree } from "../../lib/arrayCables";
import { useFleet } from "../../lib/fleet";
import type { TraceFrame, ZoneStatus } from "../../types/commissioning";
import { rgba } from "../map/deckUtils";
import PlanningMap, { type Bounds } from "../map/PlanningMap";

const COLOR: Record<ZoneStatus, string> = { live: "", earthed: SCADA_COLORS.EARTHED, dead: SCADA_COLORS.DE_ENERGIZED };
const zoneColor = (s: ZoneStatus | undefined, kv: 66 | 220) =>
  rgba(s === "live" ? (kv === 66 ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.VOLTAGE_220KV) : COLOR[s ?? "dead"]);

export default function EnergisationMap({ frame }: { frame: TraceFrame }) {
  const fleet = useFleet();
  const sb510 = fleet.source === "sb510";
  const zones = frame.network.zones;

  const geo = useMemo(() => {
    const tree = cableTree(fleet);
    const shore = sb510 ? ONSHORE_GEO : fleet.grid;
    const route: [number, number][] = sb510
      ? EXPORT_CABLE_GEO.map((p) => [p.lon, p.lat])
      : shore
        ? [
            [fleet.oss.lon, fleet.oss.lat],
            [shore.lon, shore.lat],
          ]
        : [];
    const pts = [...fleet.turbines.map((t) => [t.lon, t.lat]), ...route];
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    const bounds: Bounds = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    const cables = tree.segments.map((s) => ({ string: s.stringNumber, path: tree.path(s).map(([la, lo]) => [lo, la] as [number, number]) }));
    const stringOf = new Map(fleet.strings.flatMap((ids, i) => ids.map((id) => [id, i + 1] as const)));
    return { route, shore, bounds, cables, stringOf };
  }, [fleet, sb510]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const released = (n: number) => frame.states[`WTG-GRP-${pad(n)}`] === "closed";

  const layers = [
    geo.route.length > 1 &&
      new PathLayer({
        id: "export",
        data: [{ path: geo.route }],
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: zoneColor(zones.CABLE1, 220),
        getWidth: zones.CABLE1 === "live" ? 4 : 2.5,
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: zones.CABLE1, getWidth: zones.CABLE1 },
      }),
    new PathLayer({
      id: "strings",
      data: geo.cables,
      getPath: (d: (typeof geo.cables)[number]) => d.path,
      getColor: (d: (typeof geo.cables)[number]) => zoneColor(zones[`STR${d.string}`], 66),
      getWidth: (d: (typeof geo.cables)[number]) => (zones[`STR${d.string}`] === "live" ? 2.5 : 1.5),
      widthUnits: "pixels",
      updateTriggers: { getColor: frame.step_id, getWidth: frame.step_id },
    }),
    new ScatterplotLayer({
      id: "turbines",
      data: fleet.turbines,
      getPosition: (t: { lat: number; lon: number }) => [t.lon, t.lat],
      getFillColor: (t: { id: string }) => (released(geo.stringOf.get(t.id) ?? 0) ? rgba(SCADA_COLORS.VOLTAGE_66KV) : rgba("#0a1520")),
      getLineColor: rgba(SCADA_COLORS.DE_ENERGIZED),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1,
      getRadius: 3.5,
      radiusUnits: "pixels",
      updateTriggers: { getFillColor: frame.step_id },
    }),
    new ScatterplotLayer({
      id: "substations",
      data: [
        { position: [fleet.oss.lon, fleet.oss.lat], zone: zones.OSS220, name: "OSS 220 kV" },
        ...(geo.shore ? [{ position: [geo.shore.lon, geo.shore.lat], zone: zones.ONS220, name: "Onshore 220 kV" }] : []),
      ],
      getPosition: (d: { position: [number, number] }) => d.position,
      getFillColor: (d: { zone: ZoneStatus | undefined }) => zoneColor(d.zone, 220),
      getLineColor: rgba("#e4ecf3"),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      getRadius: 6,
      radiusUnits: "pixels",
      pickable: true,
      updateTriggers: { getFillColor: frame.step_id },
    }),
  ];

  const tooltip = (info: PickingInfo): string | null => {
    if (info.layer?.id === "export") return `Export cable 1 · ${zones.CABLE1 ?? "dead"}`;
    if (info.layer?.id === "substations") {
      const d = info.object as { name: string; zone?: ZoneStatus };
      return `${d.name} · ${d.zone ?? "dead"}`;
    }
    return null;
  };

  return (
    <figure className="relative h-56 overflow-hidden rounded-md border border-border-primary" aria-label="The plant on the map at this step">
      <PlanningMap bounds={geo.bounds} fitKey={fleet.key} layers={layers} getTooltip={tooltip} />
    </figure>
  );
}
