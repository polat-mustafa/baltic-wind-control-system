/** Small deck.gl helpers shared by the planning maps. */

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
