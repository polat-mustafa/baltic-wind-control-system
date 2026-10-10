/**
 * The energisation replay on the map: the same frame as the single-line
 * diagram, drawn where the plant is — export cable 1 from the onshore
 * substation to the OSS, the 66 kV strings of section A and their turbines —
 * in the SLD's colours (live in its voltage colour, earthed magenta, dead
 * slate); what came live at this step in the accent, and two rings ripple out
 * from where the step's device is. Loaded lazily with the replay (MapLibre +
 * deck.gl, map/PlanningMap).
 */

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
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
const ACCENT = "#45c8d9";
const RING_MS = 2400;

/** Phase 0…1 of the ring ripple, ~30 fps; frozen at 0.5 with reduced motion. */
function useRipple(): number {
  const reduced = useReducedMotion() ?? false;
  const [t, setT] = useState(0.5);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 33) {
        last = now;
        setT((now % RING_MS) / RING_MS);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);
  return t;
}

export default function EnergisationMap({ frame, fresh }: { frame: TraceFrame; fresh: ReadonlySet<string> }) {
  const zoneColor = (zone: string, kv: 66 | 220) => {
    const s = frame.network.zones[zone];
    if (s === "live" && fresh.has(zone)) return rgba(ACCENT);
    return rgba(s === "live" ? (kv === 66 ? SCADA_COLORS.VOLTAGE_66KV : SCADA_COLORS.VOLTAGE_220KV) : COLOR[s ?? "dead"]);
  };
  const ripple = useRipple();
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

  // Where the step's device is: the onshore end, a string (its turbines) or the OSS
  const focusAt = useMemo((): [number, number][] => {
    const id = frame.equipment_id;
    if (!id) return [];
    const str = /(?:STR|GRP)-(\d+)/.exec(id);
    if (str) {
      const ids = new Set(fleet.strings[Number(str[1]) - 1] ?? []);
      return fleet.turbines.filter((t) => ids.has(t.id)).map((t) => [t.lon, t.lat]);
    }
    if (/-ON-/.test(id)) return geo.shore ? [[geo.shore.lon, geo.shore.lat]] : [];
    return [[fleet.oss.lon, fleet.oss.lat]];
  }, [frame.equipment_id, fleet, geo.shore]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const released = (n: number) => frame.states[`WTG-GRP-${pad(n)}`] === "closed";

  const layers = [
    geo.route.length > 1 &&
      new PathLayer({
        id: "export",
        data: [{ path: geo.route }],
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: zoneColor("CABLE1", 220),
        getWidth: zones.CABLE1 === "live" ? 4 : 2.5,
        widthUnits: "pixels",
        pickable: true,
        updateTriggers: { getColor: frame.step_id, getWidth: zones.CABLE1 },
      }),
    new PathLayer({
      id: "strings",
      data: geo.cables,
      getPath: (d: (typeof geo.cables)[number]) => d.path,
      getColor: (d: (typeof geo.cables)[number]) => zoneColor(`STR${d.string}`, 66),
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
        { position: [fleet.oss.lon, fleet.oss.lat], zone: "OSS220", name: "OSS 220 kV" },
        ...(geo.shore ? [{ position: [geo.shore.lon, geo.shore.lat], zone: "ONS220", name: "Onshore 220 kV" }] : []),
      ],
      getPosition: (d: { position: [number, number] }) => d.position,
      getFillColor: (d: { zone: string }) => zoneColor(d.zone, 220),
      getLineColor: rgba("#e4ecf3"),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      getRadius: 6,
      radiusUnits: "pixels",
      pickable: true,
      updateTriggers: { getFillColor: frame.step_id },
    }),
    // two rings rippling out from the step's device, half a period apart (radiusScale / opacity: no attribute rebuild)
    ...[0, 0.5].map(
      (off, k) =>
        new ScatterplotLayer({
          id: `ring-${k}`,
          data: focusAt,
          getPosition: (p: [number, number]) => p,
          getRadius: 1,
          radiusUnits: "pixels",
          radiusScale: 7 + 22 * ((ripple + off) % 1),
          opacity: 1 - ((ripple + off) % 1),
          stroked: true,
          filled: false,
          getLineColor: rgba(ACCENT),
          lineWidthUnits: "pixels",
          getLineWidth: 2,
        }),
    ),
  ];

  const tooltip = (info: PickingInfo): string | null => {
    if (info.layer?.id === "export") return `Export cable 1 · ${zones.CABLE1 ?? "dead"}`;
    if (info.layer?.id === "substations") {
      const d = info.object as { name: string; zone: string };
      return `${d.name} · ${zones[d.zone] ?? "dead"}`;
    }
    return null;
  };

  return (
<PlanningMap bounds={geo.bounds} fitKey={fleet.key} layers={layers} getTooltip={tooltip} dataCredit={null} />
  );
}
