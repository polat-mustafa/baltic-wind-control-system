/**
 * The Polish transmission system (KSE) as deck.gl layers, shared by the HV Grid
 * map and the Site & Permits screening map: PSE's 400 / 220 kV lines and
 * substations, the interconnectors and the SwePol HVDC link.
 *
 * Data: backend/scripts/fetch_pl_grid.py → data/plGrid.json (OpenStreetMap via
 * PyPSA-Eur + Overpass, ODbL), loaded on first use.
 */

import { useEffect, useState } from "react";
import type { PickingInfo } from "@deck.gl/core";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { rgba } from "./deckUtils";

export interface GridLine {
  c: [number, number][];
  kv: number;
  kind: "AC" | "DC";
  circuits: number;
  km: number;
  to?: string;
  status?: string;
}
export interface Station {
  name: string;
  kv: number[];
  c: [number, number];
  status?: string;
}
export interface PlGrid {
  source: string;
  license: string;
  retrieved: string;
  lines: GridLine[];
  stations: Station[];
  entsoe_check?: { map: string; named: number; stations: number };
}

export const DC_COLOR = "#c38cf0";
export const COUNTRY: Record<string, string> = { DE: "Germany", CZ: "Czechia", SK: "Slovakia", UA: "Ukraine", LT: "Lithuania", SE: "Sweden" };
const lineColor = (l: GridLine) => (l.kind === "DC" ? DC_COLOR : l.kv >= 380 ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.VOLTAGE_220KV);

let pending: Promise<PlGrid> | null = null;
/** The KSE data, loaded once (its own chunk). */
export function usePlGrid(): PlGrid | null {
  const [grid, setGrid] = useState<PlGrid | null>(null);
  useEffect(() => {
    let live = true;
    pending ??= import("../../data/plGrid.json").then((m) => m.default as unknown as PlGrid);
    void pending.then((g) => live && setGrid(g));
    return () => {
      live = false;
    };
  }, []);
  return grid;
}

/** Lines (interconnectors and HVDC wider) and substations; `scale` thins them on a busy map. */
export function kseLayers(grid: PlGrid, scale = 1) {
  return [
    new PathLayer<GridLine>({
      id: "kse-lines",
      data: grid.lines,
      getPath: (l) => l.c,
      getColor: (l) => rgba(lineColor(l)),
      getWidth: (l) => scale * (l.to || l.kind === "DC" ? 3.5 : l.circuits > 1 ? 2.5 : 1.6),
      widthUnits: "pixels",
      capRounded: true,
      jointRounded: true,
      pickable: true,
    }),
    new ScatterplotLayer<Station>({
      id: "kse-stations",
      data: grid.stations,
      getPosition: (s) => s.c,
      getRadius: (s) => scale * (s.kv[0] >= 400 ? 4 : 3),
      radiusUnits: "pixels",
      getFillColor: rgba("#e4ecf3"),
      getLineColor: (s) => rgba(s.kv[0] >= 400 ? SCADA_COLORS.VOLTAGE_400KV : SCADA_COLORS.VOLTAGE_220KV),
      stroked: true,
      lineWidthUnits: "pixels",
      getLineWidth: 1.5,
      pickable: true,
    }),
  ];
}

/** Tooltip of a KSE line or substation; null for anything else. */
export function kseTooltip(info: PickingInfo): string | null {
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
  return null;
}
