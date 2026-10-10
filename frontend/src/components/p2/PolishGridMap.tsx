/**
 * The Polish transmission system (KSE) the farm connects to: PSE's 400 and
 * 220 kV lines and substations, the interconnectors to the neighbours and the
 * SwePol HVDC link, with the farm's export route to its grid node on top.
 *
 * Data: OpenStreetMap lines prebuilt for PyPSA-Eur and PSE substations from
 * OpenStreetMap (backend/scripts/fetch_pl_grid.py → data/plGrid.json, loaded
 * with this map), cross-checked with ENTSO-E's 2024 grid map print.
 */

import { useMemo } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { EXPORT_CABLE_GEO } from "../../constants/windFarmLayout";
import { farmTitle, useFleet } from "../../lib/fleet";
import { rgba } from "../map/deckUtils";
import { COUNTRY, DC_COLOR as DC, kseLayers, kseTooltip, usePlGrid, type GridLine } from "../map/kseLayers";
import PlanningMap, { type Bounds } from "../map/PlanningMap";

const POLAND: Bounds = [
  [14.1, 48.95],
  [24.2, 55.0],
];

export default function PolishGridMap() {
  const grid = usePlGrid();
  const fleet = useFleet();
  const sb510 = fleet.source === "sb510";

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
    ...kseLayers(grid),
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
    const kse = kseTooltip(info);
    if (kse) return kse;
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
