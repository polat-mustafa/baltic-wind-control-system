/** Types, colours, glyphs and the live-drag store shared by the layout page and its (lazy) map. */

import { create } from "zustand";

import type { TurbineStatus } from "../../lib/layout/evaluate";
import type { LonLat } from "../../lib/layout/geometry";

export type { TurbineStatus };

export interface TurbineView {
  id: string;
  lon: number;
  lat: number;
  status: TurbineStatus;
  note: string;
}

export const SECTION_COLOR: Record<string, string> = {
  "500": "#0ea5e9",
  "630": "#6366f1",
  "800": "#a855f7",
  "1000": "#d946ef",
  over: "#f25c54",
};

/** Turbine fill per position status; the legend text says what each means. */
export const STATUS_STYLE: Record<TurbineStatus, { color: string; label: string }> = {
  ok: { color: "#f8fafc", label: "OK" },
  close: { color: "#f59e0b", label: "closer than 4 D to a neighbour" },
  outside: { color: "#f25c54", label: "outside the site boundary" },
  excluded: { color: "#ec4899", label: "in a constraint area" },
  basin: { color: "#a8a29e", label: "outside the plan's energy basins" },
};

/** Top view of a turbine: disc in the status colour, three blades, hub; sky ring when selected. */
export function turbineGlyph(color: string, size = 20, selected = false): string {
  const ring = selected ? '<circle r="10.6" fill="none" stroke="#0ea5e9" stroke-width="2.2"/>' : "";
  const blades = [90, 210, 330]
    .map((a) => {
      const r = (a * Math.PI) / 180;
      return `<line x1="0" y1="0" x2="${(6.2 * Math.cos(r)).toFixed(2)}" y2="${(-6.2 * Math.sin(r)).toFixed(2)}"/>`;
    })
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="-12 -12 24 24" aria-hidden="true">${ring}<circle r="8.2" fill="${color}" stroke="#0f172a" stroke-width="1.4"/><g stroke="#0f172a" stroke-width="1.7" stroke-linecap="round">${blades}</g><circle r="1.6" fill="#0f172a"/></svg>`;
}

/** Offshore substation: jacket platform (four legs) with a topside and a lightning mark. */
export function ossGlyph(size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><g fill="#0f172a"><circle cx="3.5" cy="3.5" r="2"/><circle cx="20.5" cy="3.5" r="2"/><circle cx="3.5" cy="20.5" r="2"/><circle cx="20.5" cy="20.5" r="2"/></g><rect x="4" y="4" width="16" height="16" rx="1.5" fill="#facc15" stroke="#0f172a" stroke-width="1.6"/><path d="M13 6.5 8.5 13h3l-1 4.5L15.5 11h-3z" fill="#0f172a"/></svg>`;
}

/** The turbine being dragged and where it is now (rAF-throttled), for the live card. */
export const useDrag = create<{ id: string | null; p: LonLat | null }>(() => ({ id: null, p: null }));
