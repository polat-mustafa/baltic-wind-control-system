/**
 * The Polish transmission system (KSE) the farm connects to: PSE's 400 and
 * 220 kV lines and substations, the interconnectors to the neighbours and the
 * SwePol HVDC link, with the farm's export route to its grid node on top.
 *
 * Data: OpenStreetMap lines prebuilt for PyPSA-Eur and PSE substations from
 * OpenStreetMap (backend/scripts/fetch_pl_grid.py → data/plGrid.json, loaded
 * with this map), cross-checked with ENTSO-E's 2024 grid map print.
 */

import { useEffect, useMemo, useState } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { EXPORT_CABLE_GEO } from "../../constants/windFarmLayout";
import { farmTitle, useFleet } from "../../lib/fleet";
import { rgba } from "../map/deckUtils";
import PlanningMap, { type Bounds } from "../map/PlanningMap";

interface GridLine {
  c: [number, number][];
  kv: number;
  kind: "AC" | "DC";
  circuits: number;
  km: number;
  to?: string;
  status?: string;
}
interface Station {
  name: string;
  kv: number[];
  c: [number, number];
  status?: string;
}
interface PlGrid {
  source: string;
  license: string;
  retrieved: string;
  lines: GridLine[];
  stations: Station[];
  entsoe_check?: { map: string; named: number; stations: number };
}

const POLAND: Bounds = [
  [14.1, 48.95],
  [24.2, 55.0],
];
const DC = "#c38cf0";
const lineColor = (l: GridLine) => (l.kind === "DC" ? DC : l.kv >= 380 ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.VOLTAGE_220KV);
const COUNTRY: Record<string, string> = { DE: "Germany", CZ: "Czechia", SK: "Slovakia", UA: "Ukraine", LT: "Lithuania", SE: "Sweden" };

export default function PolishGridMap() {
  const [grid, setGrid] = useState<PlGrid | null>(null);
  const fleet = useFleet();
  const sb510 = fleet.source === "sb510";

  useEffect(() => {
    let live = true;
    void import("../../data/plGrid.json").then((m) => live && setGrid(m.default as unknown as PlGrid));
    return () => {
      live = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!grid) return null;
    const km = (f: (l: GridLine) => boolean) => grid.lines.filter(f).reduce((s, l) => s + l.km, 0);
    const links = grid.lines.filter((l) => l.to);
    const byCountry = Object.entries(
      links.reduce<Record<string, number>>((a, l) => ({ ...a, [l.to!]: (a[l.to!] ?? 0) + l.circuits }), {}),
    );
    return { km400: km((l) => l.kind === "AC" && l.kv >= 380), km220: km((l) => l.kind === "AC" && l.kv === 220), byCountry };
  }, [grid]);

  // The farm's export route to its grid node (SB-510: the real route to Krzemienica)
  const route: [number, number][] = sb510
    ? EXPORT_CABLE_GEO.map((p) => [p.lon, p.lat])
    : fleet.grid
      ? [
          [fleet.oss.lon, fleet.oss.lat],
          [fleet.grid.lon, fleet.grid.lat],
        ]
      : [];
  const node = fleet.grid;
  const farm = farmTitle(fleet);

  const layers = grid && [
    new PathLayer<GridLine>({
      id: "kse-lines",
      data: grid.lines,
      getPath: (l) => l.c,
      getColor: (l) => rgba(lineColor(l)),
      getWidth: (l) => (l.to || l.kind === "DC" ? 3.5 : l.circuits > 1 ? 2.5 : 1.6),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: true,
    }),
    new ScatterplotLayer<Station>({
      id: "kse-stations",
      data: grid.stations,
      getPosition: (s) => s.c,
      getRadius: (s) => (s.kv[0] >= 400 ? 4 : 3),
      radiusUnits: "pixels",
      getFillColor: rgba("#e4ecf3"),
      getLineColor: (s) => rgba(s.kv[0] >= 400 ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.VOLTAGE_220KV),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      pickable: true,
    }),
    route.length > 1 &&
      new PathLayer({
        id: "farm-route",
        data: [{ path: route }],
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: rgba("#45c8d9"),
        getWidth: 3.5,
        widthUnits: "pixels",
        pickable: true,
      }),
    node &&
      new ScatterplotLayer({
        id: "farm-node",
        data: [node],
        getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
        getRadius: 7,
        radiusUnits: "pixels",
        getFillColor: rgba("#45c8d9"),
        getLineColor: rgba("#032029"),
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        pickable: true,
      }),
  ];

  const tooltip = (info: PickingInfo): string | null => {
    const id = info.layer?.id;
    if (!info.object) return null;
    if (id === "kse-lines") {
      const l = info.object as GridLine;
      const what = l.kind === "DC" ? `${l.kv} kV HVDC link` : `${l.kv} kV line${l.circuits > 1 ? ` × ${l.circuits}` : ""}`;
      return `${what} · ${l.km.toFixed(0)} km${l.to ? ` · interconnector to ${COUNTRY[l.to] ?? l.to}` : ""}${l.status ? ` · ${l.status}` : ""}`;
    }
    if (id === "kse-stations") {
      const s = info.object as Station;
      return s.status ? `${s.name} · ${s.status}` : s.name;
    }
    if (id === "farm-route") return `${farm} export route`;
    if (id === "farm-node") return `${(info.object as { name: string }).name} · ${farm} connects here`;
    return null;
  };

  return (
    <section className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-4" aria-labelledby="kse-title">
      <div>
        <h3 id="kse-title" className="text-base font-semibold text-text-primary">
          Polish transmission system (KSE): where the farm connects
        </h3>
        <p className="text-xs text-text-muted">
          PSE&apos;s 400 and 220 kV network, the interconnectors to the neighbours and the SwePol HVDC link. Hover a line or a substation.
        </p>
      </div>
      <figure className="relative h-[420px] overflow-hidden rounded-md border border-border-primary sm:h-[520px]" aria-label="Map of the Polish transmission system">
        {layers ? (
          <PlanningMap bounds={POLAND} fitKey="pl" layers={layers} getTooltip={tooltip} dataCredit={null} />
        ) : (
          <div className="h-full bg-bg-secondary" aria-busy="true" />
        )}
      </figure>
      {grid && summary && (
        <div className="space-y-1 text-xs text-text-secondary">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Key color={SCADA_COLORS.VOLTAGE_400KV} label={`400 kV · ≈ ${Math.round(summary.km400).toLocaleString("en")} km`} />
            <Key color={SCADA_COLORS.VOLTAGE_220KV} label={`220 kV · ≈ ${Math.round(summary.km220).toLocaleString("en")} km`} />
            <Key color={DC} label="HVDC SwePol" />
            <Key color="#45c8d9" label={`${farm} export route`} />
            <span>{grid.stations.length} PSE substations</span>
          </div>
          <p>
            <span className="font-medium text-text-primary">Interconnectors (circuits): </span>
            {summary.byCountry.map(([c, n]) => `${COUNTRY[c] ?? c} ${n}`).join(" · ")}
          </p>
          <p className="text-text-muted">
            <span>{grid.source}</span>{" "}
            {grid.entsoe_check && (
              <span>
                {grid.entsoe_check.named} of {grid.entsoe_check.stations} substations are named on the ENTSO-E map print; the rest lie south of its 50° N edge or are newer.
              </span>
            )}{" "}
            <span>
              {grid.license} · retrieved {grid.retrieved}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-1 w-4 rounded-full" style={{ background: color }} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
