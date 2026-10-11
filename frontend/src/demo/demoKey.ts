/**
 * Static demo (GitHub Pages, no backend): every API response the pages ask for
 * with their default inputs is recorded once (e2e-demo/record.spec.ts) into
 * frontend/demo-api/<file>.json; the demo build (VITE_DEMO=1) reads them back
 * in services/apiClient.ts. The file name is the same function of
 * (method, URL, body) on both sides, so a request either hits its recording or
 * is honestly reported as "computed live in the full version".
 */

/** FNV-1a 32-bit: tiny, deterministic, identical in Node and the browser. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** "/api/v1/grid/loadflow?x=1" + POST body → "grid_loadflow-1a2b3c4d.json" (readable prefix, exact hash). */
export function demoFile(method: string, url: string, body?: string | null): string {
  const path = url.split("?")[0].replace(/^\/api\/v\d+\//, "");
  const slug = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60) || "root";
  return `${slug}-${fnv1a(`${method.toUpperCase()} ${url} ${body ?? ""}`)}.json`;
}

// `?.`: the recorder imports this file in Node, where import.meta.env does not exist
export const DEMO = import.meta.env?.VITE_DEMO === "1";

/** Shown wherever a page asks for something that was not recorded (a changed input, a new scenario). */
export const DEMO_MISS =
  "Static demo: this calculation runs on the backend. Clone the repository and run `docker compose up` to compute it live.";
