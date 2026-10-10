/** Small deck.gl / MapLibre helpers shared by the planning maps and the Control Room. */

import type { StyleSpecification } from "maplibre-gl";

/** "#rrggbb" + opacity 0…1 → deck.gl RGBA. */
export function rgba(hex: string, a = 1): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(a * 255)];
}

/** Dash pattern string ("6 4") → deck.gl dash array, [0, 0] = solid. */
export function dashArray(dash?: string): [number, number] {
  const [a, b] = (dash ?? "").split(" ").map(Number);
  return a && b ? [a, b] : [0, 0];
}

/** SVG markup → IconLayer icon (adds the xmlns a data URL needs). */
export function svgIcon(svg: string, size: number) {
  const xml = svg.includes("xmlns") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`, width: size * 2, height: size * 2, anchorY: size };
}

/** Drag-and-drop data type of palette items dropped on a PlanningMap; the data is the item kind. */
export const DROP_TYPE = "application/x-offshoreforge-item";

/** OSM raster base (also the Control Room's). Dark: brightness inverted and hue turned back, so sea and land keep their hues on a navy ground. */
export function osmStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19 },
    },
    layers: [
      { id: "ground", type: "background", paint: { "background-color": dark ? "#0a1520" : "#e8e4da" } },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: dark
          ? { "raster-brightness-min": 0.86, "raster-brightness-max": 0.07, "raster-hue-rotate": 180, "raster-saturation": -0.45, "raster-contrast": 0.08 }
          : { "raster-saturation": -0.25 },
      },
    ],
  };
}
