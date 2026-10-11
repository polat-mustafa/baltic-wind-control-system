/**
 * Shared HTTP client for all API service modules.
 *
 * Centralises fetch + error handling so individual service files
 * only declare endpoint-specific functions. Vite dev proxy forwards
 * /api → localhost:8000; in production nginx handles the proxy.
 */

import { DEMO, DEMO_MISS, demoFile } from "../demo/demoKey";

/**
 * FastAPI `detail` → readable text. Validation errors (422) arrive as a list
 * of `{loc, msg}` objects; passing that to `new Error()` printed "[object Object]".
 */
export function formatErrorDetail(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: (string | number)[]; msg?: string }) => {
        const field = (d.loc ?? []).filter((p) => p !== "body").join(".");
        return field ? `${field}: ${d.msg}` : (d.msg ?? JSON.stringify(d));
      })
      .join("; ");
  }
  return detail == null ? `HTTP ${status}` : JSON.stringify(detail);
}

/** HTTP error with its status code (a network failure throws a plain TypeError instead). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Extra headers per URL — the own project's farm on the grid endpoints (lib/project/farmHeader.ts). */
let extraHeaders: (url: string) => Record<string, string> = () => ({});
export function setRequestHeaders(fn: (url: string) => Record<string, string>): void {
  extraHeaders = fn;
}

/** Static demo build: the recorded response, or an honest "runs on the backend" error (demo/demoKey.ts). */
async function demoRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const file = demoFile(init?.method ?? "GET", url, init?.body as string | undefined);
  const res = await fetch(`${import.meta.env.BASE_URL}demo-api/${file}`, { signal: init?.signal });
  // a host may answer a missing file with its HTML fallback page instead of a 404
  if (!res.ok || !res.headers.get("content-type")?.includes("json")) throw new ApiError(DEMO_MISS, 503);
  return res.json() as Promise<T>;
}

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (DEMO) return demoRequest<T>(url, init);
  // init first, headers merged after: a caller's own headers add to, not replace, the defaults
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...extraHeaders(url), ...(init?.headers as Record<string, string>) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(formatErrorDetail(body?.detail, res.status), res.status);
  }
  return (res.status === 204 ? undefined : res.json()) as Promise<T>;
}

export function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}
