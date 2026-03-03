/**
 * Shared HTTP client for all API service modules.
 *
 * Centralises fetch + error handling so individual service files
 * only declare endpoint-specific functions. Vite dev proxy forwards
 * /api → localhost:8000; in production nginx handles the proxy.
 */

export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}
